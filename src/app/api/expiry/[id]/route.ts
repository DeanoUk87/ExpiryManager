import { NextResponse } from "next/server";
import { db } from "@/db";
import { productExpiry } from "@/db/schema";
import { eq } from "drizzle-orm";

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

    await db.delete(productExpiry).where(eq(productExpiry.id, expiryId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete expiry record:", error);
    return NextResponse.json({ error: "Failed to delete expiry record" }, { status: 500 });
  }
}
