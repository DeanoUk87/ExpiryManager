import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "@/db";
import { shopifySessions } from "@/db/schema";

const APP_URL = process.env.SHOPIFY_APP_URL!;
const API_KEY = process.env.SHOPIFY_API_KEY!;
const API_SECRET = process.env.SHOPIFY_API_SECRET!;

function redirect(path: string) {
  // Always redirect to the public HTTPS URL so the browser lands correctly
  return new NextResponse(null, {
    status: 302,
    headers: { Location: `${APP_URL}${path}` },
  });
}

function verifyHmac(query: URLSearchParams): boolean {
  const hmac = query.get("hmac");
  if (!hmac) return false;

  const params: string[] = [];
  query.forEach((value, key) => {
    if (key !== "hmac") params.push(`${key}=${value}`);
  });
  params.sort();
  const message = params.join("&");

  const digest = crypto
    .createHmac("sha256", API_SECRET)
    .update(message)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const shop = searchParams.get("shop");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const hmac = searchParams.get("hmac");

  if (!shop || !code || !state || !hmac) {
    return redirect(`/connect?error=${encodeURIComponent("Missing required OAuth parameters.")}`);
  }

  if (!verifyHmac(searchParams)) {
    return redirect(`/connect?error=${encodeURIComponent("HMAC verification failed.")}`);
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("shopify_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return redirect(`/connect?error=${encodeURIComponent("State mismatch. Please try again.")}`);
  }
  cookieStore.delete("shopify_oauth_state");

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: API_KEY, client_secret: API_SECRET, code }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", err);
      return redirect(`/connect?error=${encodeURIComponent("Token exchange failed.")}`);
    }

    const { access_token, scope } = await tokenRes.json() as { access_token: string; scope: string };

    const sessionId = `offline_${shop}`;
    await db
      .insert(shopifySessions)
      .values({ id: sessionId, shop, state, isOnline: false, scope, accessToken: access_token })
      .onConflictDoUpdate({
        target: shopifySessions.id,
        set: { scope, accessToken: access_token, state },
      });

    console.log(`✅ OAuth complete for shop: ${shop}`);
    return redirect("/");
  } catch (error) {
    console.error("OAuth callback error:", error);
    return redirect(`/connect?error=${encodeURIComponent("Authentication failed. Please try again.")}`);
  }
}
