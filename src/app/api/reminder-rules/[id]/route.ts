import { NextResponse } from "next/server";
import { db } from "@/db";
import { reminderRules } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ruleId = parseInt(id);
    const body = await request.json();
    const { name, daysBeforeExpiry, isActive, emailEnabled, emailAddress } = body;

    if (!name || daysBeforeExpiry === undefined) {
      return NextResponse.json({ error: "Name and days before expiry are required" }, { status: 400 });
    }

    const [updated] = await db
      .update(reminderRules)
      .set({
        name,
        daysBeforeExpiry: parseInt(daysBeforeExpiry),
        isActive: isActive !== false,
        emailEnabled: emailEnabled === true,
        emailAddress: emailAddress || null,
      })
      .where(eq(reminderRules.id, ruleId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Reminder rule not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update reminder rule:", error);
    return NextResponse.json({ error: "Failed to update reminder rule" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ruleId = parseInt(id);

    await db.delete(reminderRules).where(eq(reminderRules.id, ruleId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete reminder rule:", error);
    return NextResponse.json({ error: "Failed to delete reminder rule" }, { status: 500 });
  }
}
