import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "@/db";
import { shopifySessions } from "@/db/schema";

const API_KEY = process.env.SHOPIFY_API_KEY!;
const API_SECRET = process.env.SHOPIFY_API_SECRET!;

// Verify the HMAC signature Shopify sends with the callback
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

// GET /api/auth/callback
// Shopify redirects here after the merchant approves the app.
// We exchange the code for a permanent access token and store it.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const shop = searchParams.get("shop");
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const hmac = searchParams.get("hmac");

  // Use request.nextUrl.origin for all internal redirects so the proxy
  // doesn't reject them (it strips https -> http internally)
  const origin = request.nextUrl.origin;

  if (!shop || !code || !state || !hmac) {
    return NextResponse.redirect(`${origin}/connect?error=${encodeURIComponent("Missing required OAuth parameters.")}`);
  }

  // Verify HMAC signature from Shopify
  if (!verifyHmac(searchParams)) {
    return NextResponse.redirect(`${origin}/connect?error=${encodeURIComponent("HMAC verification failed.")}`);
  }

  // Verify state matches what we stored in the cookie (CSRF protection)
  const cookieStore = await cookies();
  const storedState = cookieStore.get("shopify_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${origin}/connect?error=${encodeURIComponent("State mismatch. Please try again.")}`);
  }
  cookieStore.delete("shopify_oauth_state");

  try {
    // Exchange the authorisation code for a permanent offline access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: API_KEY, client_secret: API_SECRET, code }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", err);
      return NextResponse.redirect(`${origin}/connect?error=${encodeURIComponent("Token exchange failed.")}`);
    }

    const { access_token, scope } = await tokenRes.json() as { access_token: string; scope: string };

    // Persist as an offline session keyed by shop
    const sessionId = `offline_${shop}`;
    await db
      .insert(shopifySessions)
      .values({ id: sessionId, shop, state, isOnline: false, scope, accessToken: access_token })
      .onConflictDoUpdate({
        target: shopifySessions.id,
        set: { scope, accessToken: access_token, state },
      });

    console.log(`✅ OAuth complete for shop: ${shop}`);
    return NextResponse.redirect(`${origin}/`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(`${origin}/connect?error=${encodeURIComponent("Authentication failed. Please try again.")}`);
  }
}
