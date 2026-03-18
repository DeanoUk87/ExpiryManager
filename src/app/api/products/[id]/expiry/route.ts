import { NextResponse } from "next/server";
import { db } from "@/db";
import { productExpiry, products } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);

    const expiries = await db
      .select()
      .from(productExpiry)
      .where(eq(productExpiry.productId, productId))
      .orderBy(productExpiry.expiryDate);

    return NextResponse.json(expiries);
  } catch (error) {
    console.error("Failed to fetch expiry records:", error);
    return NextResponse.json({ error: "Failed to fetch expiry records" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);
    const body = await request.json();
    const { expiryDate, quantity, notes } = body;

    if (!expiryDate || quantity === undefined) {
      return NextResponse.json({ error: "Expiry date and quantity are required" }, { status: 400 });
    }

    if (quantity < 0) {
      return NextResponse.json({ error: "Quantity must be non-negative" }, { status: 400 });
    }

    const [newExpiry] = await db
      .insert(productExpiry)
      .values({
        productId,
        expiryDate,
        quantity: parseInt(quantity),
        notes: notes || null,
      })
      .returning();

    return NextResponse.json(newExpiry, { status: 201 });
  } catch (error) {
    console.error("Failed to add expiry record:", error);
    return NextResponse.json({ error: "Failed to add expiry record" }, { status: 500 });
  }
}
