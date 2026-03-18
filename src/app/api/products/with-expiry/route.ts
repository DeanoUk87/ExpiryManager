import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productExpiry } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/products/with-expiry
// Returns all products with their expiry batches in a single DB query
// instead of N+1 individual fetches — much faster for large catalogues
export async function GET() {
  try {
    // Fetch both tables in parallel
    const [allProducts, allExpiries] = await Promise.all([
      db.select().from(products).orderBy(products.name),
      db.select().from(productExpiry).orderBy(productExpiry.expiryDate),
    ]);

    // Group expiries by productId in a Map
    const expiryMap = new Map<number, typeof allExpiries>();
    for (const expiry of allExpiries) {
      const list = expiryMap.get(expiry.productId) ?? [];
      list.push(expiry);
      expiryMap.set(expiry.productId, list);
    }

    const result = allProducts.map((p) => ({
      ...p,
      expiries: expiryMap.get(p.id) ?? [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch products with expiry:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
