export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const allProducts = await db.select().from(products).orderBy(products.name);
    return NextResponse.json(allProducts);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sku, name, shopifyProductId, shopifyVariantId } = body;

    if (!sku || !name) {
      return NextResponse.json({ error: "SKU and name are required" }, { status: 400 });
    }

    const [newProduct] = await db
      .insert(products)
      .values({
        sku,
        name,
        shopifyProductId: shopifyProductId || null,
        shopifyVariantId: shopifyVariantId || null,
      })
      .returning();

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
