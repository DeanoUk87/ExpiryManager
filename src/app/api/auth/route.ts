import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const APP_URL = process.env.SHOPIFY_APP_URL!;
const API_KEY = process.env.SHOPIFY_API_KEY!;
const SCOPES = process.env.SHOPIFY_SCOPES ?? "read_products,write_products";

// GET /api/auth?shop=neonailuk.myshopify.com
// Builds the Shopify OAuth URL manually and redirects the merchant to it.
// We do this manually rather than using shopify.auth.begin because that method
// expects a Node.js IncomingMessage, not a Next.js App Router Request.
export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop");

  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  // Validate shop domain format
  if (!/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop)) {
    return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 });
  }

  // Generate a random nonce to protect against CSRF
  const state = crypto.randomBytes(16).toString("hex");

  // Store state in a cookie so we can verify it on callback
  const cookieStore = await cookies();
  cookieStore.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const redirectUri = `${APP_URL}/api/auth/callback`;

  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${API_KEY}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}` +
    `&grant_options[]=`;

  return NextResponse.redirect(authUrl);
}
