import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/shopify";
import { db } from "@/db";
import { products, productExpiry } from "@/db/schema";
import { eq } from "drizzle-orm";

const SHOP = process.env.SHOPIFY_STORE_DOMAIN ?? "neonailuk.myshopify.com";

// GraphQL query - fetches products with their SKU (from first variant)
// and the two custom metafields: custom.expiry_date and custom.qty
const PRODUCTS_QUERY = `
  query GetProducts($cursor: String) {
    products(first: 50, after: $cursor) {
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
        { error: "Not connected to Shopify. Please install the app first.", installUrl: `/api/auth?shop=${SHOP}` },
        { status: 401 }
      );
    }

    let cursor: string | null = null;
    let hasNextPage = true;
    let synced = 0;
    let withMetafields = 0;

    while (hasNextPage) {
      const rawResponse = await client.query({
        data: { query: PRODUCTS_QUERY, variables: { cursor } },
      });

      interface GqlBody { data: ProductsQueryResponse }
      const body = rawResponse.body as unknown as GqlBody;
      const { edges, pageInfo }: ProductsQueryResponse["products"] = body.data.products;
      hasNextPage = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;

      for (const { node } of edges) {
        const shopifyProductId = node.id; // gid://shopify/Product/123456
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
          // Update name/sku/variant if changed
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

        // If Shopify metafields have data, import them as an expiry batch
        // Only import if there's no existing expiry batch from Shopify already
        // (to avoid duplicating on subsequent syncs)
        const expiryDateVal = node.expiryDate?.value ?? null;
        const expiryQtyVal = node.expiryQty?.value ? parseInt(node.expiryQty.value) : null;

        if (expiryDateVal && expiryQtyVal !== null && !isNaN(expiryQtyVal)) {
          withMetafields++;
          // Check if an expiry batch with this exact date already exists for this product
          const existingExpiry = await db
            .select()
            .from(productExpiry)
            .where(eq(productExpiry.productId, productId));

          const alreadyHasThisDate = existingExpiry.some(
            (e) => e.expiryDate === expiryDateVal
          );

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
    console.error("Shopify sync error:", error);
    return NextResponse.json({ error: "Sync failed. Check server logs." }, { status: 500 });
  }
}
