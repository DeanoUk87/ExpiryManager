export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { shopifySessions } from "@/db/schema";
import { eq } from "drizzle-orm";

const APP_URL = process.env.SHOPIFY_APP_URL!;
const API_KEY = process.env.SHOPIFY_API_KEY!;
const API_SECRET = process.env.SHOPIFY_API_SECRET!;

function verifyHmac(query: URLSearchParams): boolean {
  const hmac = query.get("hmac");
  if (!hmac) return false;
  const params: string[] = [];
  query.forEach((value, key) => {
    if (key !== "hmac") params.push(`${key}=${value}`);
  });
  params.sort();
  const message = params.join("&");
  const digest = crypto.createHmac("sha256", API_SECRET).update(message).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

// Use a JS-based redirect so the browser navigates client-side.
// Server-side 302 Location headers get intercepted by the Kilo proxy.
function jsRedirect(url: string) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8">
    <script>window.location.replace(${JSON.stringify(url)});</script>
    </head><body>Redirecting...</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const shop = searchParams.get("shop");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const hmac = searchParams.get("hmac");

  if (!shop || !code || !state || !hmac) {
    return jsRedirect(`${APP_URL}/connect?error=${encodeURIComponent("Missing required OAuth parameters.")}`);
  }

  if (!verifyHmac(searchParams)) {
    return jsRedirect(`${APP_URL}/connect?error=${encodeURIComponent("HMAC verification failed.")}`);
  }

  // Verify state from DB (stored as state_{state} when generating the auth URL)
  const stateRows = await db
    .select()
    .from(shopifySessions)
    .where(eq(shopifySessions.id, `state_${state}`));

  if (!stateRows.length) {
    return jsRedirect(`${APP_URL}/connect?error=${encodeURIComponent("State not found. Please try again.")}`);
  }

  // Clean up the temporary state record
  await db.delete(shopifySessions).where(eq(shopifySessions.id, `state_${state}`));

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: API_KEY, client_secret: API_SECRET, code }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", err);
      return jsRedirect(`${APP_URL}/connect?error=${encodeURIComponent("Token exchange failed.")}`);
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
    return jsRedirect(`${APP_URL}/`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    return jsRedirect(`${APP_URL}/connect?error=${encodeURIComponent("Authentication failed. Please try again.")}`);
  }
}
