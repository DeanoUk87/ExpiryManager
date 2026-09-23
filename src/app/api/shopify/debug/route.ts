export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getOfflineSession, getAdminClient } from "@/lib/shopify";

const SHOP = process.env.SHOPIFY_STORE_DOMAIN ?? "neonailuk.myshopify.com";

export async function GET() {
  try {
    const session = await getOfflineSession(SHOP);

    if (!session) {
      return NextResponse.json({ error: "No session found in DB", shop: SHOP });
    }

    const sessionInfo = {
      id: session.id,
      shop: session.shop,
      hasToken: !!session.accessToken,
      tokenPrefix: session.accessToken?.slice(0, 8) + "...",
      scope: session.scope,
    };

    const client = await getAdminClient(SHOP);
    if (!client) {
      return NextResponse.json({ session: sessionInfo, error: "Could not create GraphQL client" });
    }

    // v13 uses client.request(query, options) not client.query()
    const result = await client.request(`{ shop { name myshopifyDomain } }`);

    return NextResponse.json({
      session: sessionInfo,
      shopifyResponse: result.data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
