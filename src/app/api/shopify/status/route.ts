export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getOfflineSession } from "@/lib/shopify";

const SHOP = process.env.SHOPIFY_STORE_DOMAIN ?? "neonailuk.myshopify.com";

// GET /api/shopify/status
// Returns whether the app is connected (has a stored access token)
export async function GET() {
  try {
    const session = await getOfflineSession(SHOP);
    const connected = !!(session?.accessToken);
    return NextResponse.json({
      connected,
      shop: SHOP,
      installUrl: `/api/auth?shop=${SHOP}`,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json({ connected: false, shop: SHOP, installUrl: `/api/auth?shop=${SHOP}` });
  }
}
