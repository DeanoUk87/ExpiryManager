import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

const APP_URL = process.env.SHOPIFY_APP_URL!;
const API_KEY = process.env.SHOPIFY_API_KEY!;
const SCOPES = process.env.SHOPIFY_SCOPES ?? "read_products,write_products";

function redirect(url: string) {
  return new NextResponse(null, {
    status: 302,
    headers: { Location: url },
  });
}

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop");

  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop)) {
    return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 });
  }

  const state = crypto.randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: false, // container is HTTP internally
    sameSite: "lax",
    maxAge: 600,
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

  return redirect(authUrl);
}
