export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { reminderRules } from "@/db/schema";

export async function GET() {
  try {
    const rules = await db.select().from(reminderRules).orderBy(reminderRules.daysBeforeExpiry);
    return NextResponse.json(rules);
  } catch (error) {
    console.error("Failed to fetch reminder rules:", error);
    return NextResponse.json({ error: "Failed to fetch reminder rules" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, daysBeforeExpiry, isActive, emailEnabled, emailAddress } = body;

    if (!name || daysBeforeExpiry === undefined) {
      return NextResponse.json({ error: "Name and days before expiry are required" }, { status: 400 });
    }

    if (daysBeforeExpiry <= 0) {
      return NextResponse.json({ error: "Days before expiry must be a positive number" }, { status: 400 });
    }

    const [newRule] = await db
      .insert(reminderRules)
      .values({
        name,
        daysBeforeExpiry: parseInt(daysBeforeExpiry),
        isActive: isActive !== false,
        emailEnabled: emailEnabled === true,
        emailAddress: emailAddress || null,
      })
      .returning();

    return NextResponse.json(newRule, { status: 201 });
  } catch (error) {
    console.error("Failed to create reminder rule:", error);
    return NextResponse.json({ error: "Failed to create reminder rule" }, { status: 500 });
  }
}
