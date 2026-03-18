import { NextResponse } from "next/server";
import { db } from "@/db";
import { productExpiry } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeExpiryMetafieldsToShopify } from "@/lib/shopifyWriteback";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const expiryId = parseInt(id);
    const body = await request.json();
    const { expiryDate, quantity, notes } = body;

    if (!expiryDate || quantity === undefined) {
      return NextResponse.json({ error: "Expiry date and quantity are required" }, { status: 400 });
    }

    const [updated] = await db
      .update(productExpiry)
      .set({ expiryDate, quantity: parseInt(quantity), notes: notes || null, updatedAt: new Date() })
      .where(eq(productExpiry.id, expiryId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Expiry record not found" }, { status: 404 });
    }

    // Write-back to Shopify metafields (best-effort)
    writeExpiryMetafieldsToShopify(updated.productId).catch(console.error);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update expiry record:", error);
    return NextResponse.json({ error: "Failed to update expiry record" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const expiryId = parseInt(id);

    // Get product ID before deleting so we can write-back
    const [existing] = await db
      .select()
      .from(productExpiry)
      .where(eq(productExpiry.id, expiryId));

    await db.delete(productExpiry).where(eq(productExpiry.id, expiryId));

    // Write-back to Shopify metafields (best-effort)
    if (existing) {
      writeExpiryMetafieldsToShopify(existing.productId).catch(console.error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete expiry record:", error);
    return NextResponse.json({ error: "Failed to delete expiry record" }, { status: 500 });
  }
}
