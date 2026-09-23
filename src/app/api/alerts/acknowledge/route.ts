export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { alertAcknowledgements } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ruleId, productExpiryId } = body;

    if (!ruleId || !productExpiryId) {
      return NextResponse.json({ error: "ruleId and productExpiryId are required" }, { status: 400 });
    }

    // Check if already acknowledged
    const existing = await db
      .select()
      .from(alertAcknowledgements)
      .where(
        and(
          eq(alertAcknowledgements.ruleId, ruleId),
          eq(alertAcknowledgements.productExpiryId, productExpiryId)
        )
      );

    if (existing.length > 0) {
      return NextResponse.json({ message: "Already acknowledged" });
    }

    const [ack] = await db
      .insert(alertAcknowledgements)
      .values({ ruleId, productExpiryId })
      .returning();

    return NextResponse.json(ack, { status: 201 });
  } catch (error) {
    console.error("Failed to acknowledge alert:", error);
    return NextResponse.json({ error: "Failed to acknowledge alert" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { ruleId, productExpiryId } = body;

    if (!ruleId || !productExpiryId) {
      return NextResponse.json({ error: "ruleId and productExpiryId are required" }, { status: 400 });
    }

    await db
      .delete(alertAcknowledgements)
      .where(
        and(
          eq(alertAcknowledgements.ruleId, ruleId),
          eq(alertAcknowledgements.productExpiryId, productExpiryId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to unacknowledge alert:", error);
    return NextResponse.json({ error: "Failed to unacknowledge alert" }, { status: 500 });
  }
}
