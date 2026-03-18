import { NextRequest, NextResponse } from "next/server";
import { shopify } from "@/lib/shopify";

// GET /api/auth/callback
// Shopify redirects here after merchant approves the app
export async function GET(request: NextRequest) {
  try {
    const callbackResponse = await shopify.auth.callback({
      rawRequest: request,
    });

    const { session } = callbackResponse;

    console.log(`✅ OAuth complete for shop: ${session.shop}, token stored.`);

    // Redirect to the app home
    return NextResponse.redirect(
      new URL("/", process.env.SHOPIFY_APP_URL ?? request.nextUrl.origin)
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/connect?error=${encodeURIComponent("Authentication failed. Please try again.")}`,
        process.env.SHOPIFY_APP_URL ?? request.nextUrl.origin
      )
    );
  }
}
