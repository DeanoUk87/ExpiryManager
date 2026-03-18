import { NextRequest, NextResponse } from "next/server";
import { shopify } from "@/lib/shopify";

// GET /api/auth?shop=neonailuk.myshopify.com
// Kicks off the OAuth flow - redirects to Shopify consent screen
export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop");

  if (!shop) {
    return NextResponse.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  try {
    const sanitizedShop = shopify.utils.sanitizeShop(shop, true);
    if (!sanitizedShop) {
      return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 });
    }

    const authRoute = await shopify.auth.begin({
      shop: sanitizedShop,
      callbackPath: "/api/auth/callback",
      isOnline: false,
      rawRequest: request,
    });

    return NextResponse.redirect(authRoute);
  } catch (error) {
    console.error("OAuth begin error:", error);
    return NextResponse.json({ error: "Failed to start OAuth flow" }, { status: 500 });
  }
}
