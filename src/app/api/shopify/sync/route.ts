export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/shopify";
import { db } from "@/db";
import { products, productExpiry } from "@/db/schema";
import { eq } from "drizzle-orm";

const SHOP = process.env.SHOPIFY_STORE_DOMAIN ?? "neonailuk.myshopify.com";

const PRODUCTS_QUERY = `
  query GetProducts($cursor: String) {
    products(first: 50, after: $cursor, query: "status:active") {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          variants(first: 1) {
            edges {
              node {
                id
                sku
              }
            }
          }
          expiryDate: metafield(namespace: "custom", key: "expiry_date") {
            value
          }
          expiryQty: metafield(namespace: "custom", key: "qty") {
            value
          }
        }
      }
    }
  }
`;

interface ShopifyProduct {
  id: string;
  title: string;
  variants: { edges: { node: { id: string; sku: string } }[] };
  expiryDate: { value: string } | null;
  expiryQty: { value: string } | null;
}

interface ProductsQueryResponse {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: ShopifyProduct }[];
  };
}

export async function POST() {
  try {
    const client = await getAdminClient(SHOP);
    if (!client) {
      return NextResponse.json(
        { error: "Not connected to Shopify. Please connect first.", installUrl: `/connect` },
        { status: 401 }
      );
    }

    let cursor: string | null = null;
    let hasNextPage = true;
    let synced = 0;
    let withMetafields = 0;

    while (hasNextPage) {
      // v13 API: client.request(query, { variables })
      const result = await client.request<ProductsQueryResponse>(PRODUCTS_QUERY, {
        variables: { cursor },
      });

      const gqlData = result.data as ProductsQueryResponse;
      const { edges, pageInfo }: ProductsQueryResponse["products"] = gqlData.products;
      hasNextPage = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;

      for (const { node } of edges) {
        const shopifyProductId = node.id;
        const shopifyVariantId = node.variants.edges[0]?.node.id ?? null;
        const sku = node.variants.edges[0]?.node.sku ?? "";
        const name = node.title;

        // Upsert product by shopify_product_id
        const existing = await db
          .select()
          .from(products)
          .where(eq(products.shopifyProductId, shopifyProductId));

        let productId: number;

        if (existing.length > 0) {
          await db
            .update(products)
            .set({ name, sku, shopifyVariantId, updatedAt: new Date() })
            .where(eq(products.shopifyProductId, shopifyProductId));
          productId = existing[0].id;
        } else {
          const [inserted] = await db
            .insert(products)
            .values({ shopifyProductId, shopifyVariantId, sku, name })
            .returning();
          productId = inserted.id;
        }

        // Import existing Shopify metafield values as an expiry batch (once only)
        const expiryDateVal = node.expiryDate?.value ?? null;
        const expiryQtyVal = node.expiryQty?.value ? parseInt(node.expiryQty.value) : null;

        if (expiryDateVal && expiryQtyVal !== null && !isNaN(expiryQtyVal)) {
          withMetafields++;
          const existingExpiry = await db
            .select()
            .from(productExpiry)
            .where(eq(productExpiry.productId, productId));

          const alreadyHasThisDate = existingExpiry.some((e) => e.expiryDate === expiryDateVal);

          if (!alreadyHasThisDate) {
            await db.insert(productExpiry).values({
              productId,
              expiryDate: expiryDateVal,
              quantity: expiryQtyVal,
              notes: "Imported from Shopify metafield",
            });
          }
        }

        synced++;
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      withMetafields,
      message: `Synced ${synced} products (${withMetafields} had existing expiry metafields imported).`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Shopify sync error:", message);
    return NextResponse.json({ error: "Sync failed.", detail: message }, { status: 500 });
  }
}
