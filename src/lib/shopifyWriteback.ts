import { getAdminClient } from "@/lib/shopify";
import { db } from "@/db";
import { products, productExpiry } from "@/db/schema";
import { eq } from "drizzle-orm";

const SHOP = process.env.SHOPIFY_STORE_DOMAIN ?? "neonailuk.myshopify.com";

const SET_METAFIELDS_MUTATION = `
  mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        key
        namespace
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * After any change to expiry batches for a product, re-calculate the
 * earliest upcoming expiry date and total qty, then write both back to
 * Shopify metafields: custom.expiry_date and custom.qty
 */
export async function writeExpiryMetafieldsToShopify(productId: number): Promise<void> {
  try {
    // Get the product's Shopify ID
    const productRows = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));

    if (!productRows.length || !productRows[0].shopifyProductId) return;

    const shopifyProductId = productRows[0].shopifyProductId;

    // Get all future (non-expired) expiry batches for this product
    const today = new Date().toISOString().split("T")[0];
    const allExpiries = await db
      .select()
      .from(productExpiry)
      .where(eq(productExpiry.productId, productId));

    const futureExpiries = allExpiries
      .filter((e) => e.expiryDate >= today)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    // Earliest upcoming expiry date and total qty across all future batches
    const earliestDate = futureExpiries.length > 0 ? futureExpiries[0].expiryDate : "";
    const totalQty = allExpiries.reduce((sum, e) => sum + e.quantity, 0);

    const client = await getAdminClient(SHOP);
    if (!client) return; // Not connected - skip write-back silently

    // v13 API: client.request(query, { variables })
    await client.request(SET_METAFIELDS_MUTATION, {
      variables: {
        metafields: [
          {
            ownerId: shopifyProductId,
            namespace: "custom",
            key: "expiry_date",
            value: earliestDate,
            type: "date",
          },
          {
            ownerId: shopifyProductId,
            namespace: "custom",
            key: "qty",
            value: String(totalQty),
            type: "number_integer",
          },
        ],
      },
    });

    console.log(`✅ Wrote metafields back to Shopify for product ${shopifyProductId}: date=${earliestDate}, qty=${totalQty}`);
  } catch (error) {
    // Write-back is best-effort — don't fail the main operation
    console.error("Metafield write-back error:", error);
  }
}
