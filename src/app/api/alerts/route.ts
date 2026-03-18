import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productExpiry, reminderRules, alertAcknowledgements } from "@/db/schema";
import { eq, and, lte, gte, notInArray, inArray } from "drizzle-orm";

export interface AlertItem {
  ruleId: number;
  ruleName: string;
  daysBeforeExpiry: number;
  productId: number;
  productExpiryId: number;
  sku: string;
  productName: string;
  expiryDate: string;
  quantity: number;
  daysUntilExpiry: number;
  acknowledged: boolean;
}

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    // Get all active reminder rules
    const activeRules = await db
      .select()
      .from(reminderRules)
      .where(eq(reminderRules.isActive, true));

    if (activeRules.length === 0) {
      return NextResponse.json([]);
    }

    // Get all non-expired expiry records (expiry date >= today)
    const allExpiries = await db
      .select({
        expiryId: productExpiry.id,
        productId: productExpiry.productId,
        expiryDate: productExpiry.expiryDate,
        quantity: productExpiry.quantity,
        sku: products.sku,
        productName: products.name,
      })
      .from(productExpiry)
      .innerJoin(products, eq(productExpiry.productId, products.id))
      .where(gte(productExpiry.expiryDate, todayStr));

    // Get acknowledgements
    const acks = await db.select().from(alertAcknowledgements);
    const ackedSet = new Set(acks.map((a) => `${a.ruleId}-${a.productExpiryId}`));

    const alerts: AlertItem[] = [];

    for (const rule of activeRules) {
      const cutoffDate = new Date(today);
      cutoffDate.setDate(cutoffDate.getDate() + rule.daysBeforeExpiry);
      const cutoffStr = cutoffDate.toISOString().split("T")[0];

      for (const expiry of allExpiries) {
        if (expiry.expiryDate <= cutoffStr) {
          const expiryDateObj = new Date(expiry.expiryDate + "T00:00:00");
          const diffMs = expiryDateObj.getTime() - today.getTime();
          const daysUntilExpiry = Math.round(diffMs / (1000 * 60 * 60 * 24));
          const key = `${rule.id}-${expiry.expiryId}`;

          alerts.push({
            ruleId: rule.id,
            ruleName: rule.name,
            daysBeforeExpiry: rule.daysBeforeExpiry,
            productId: expiry.productId,
            productExpiryId: expiry.expiryId,
            sku: expiry.sku,
            productName: expiry.productName,
            expiryDate: expiry.expiryDate,
            quantity: expiry.quantity,
            daysUntilExpiry,
            acknowledged: ackedSet.has(key),
          });
        }
      }
    }

    // Sort by days until expiry (most urgent first)
    alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    return NextResponse.json(alerts);
  } catch (error) {
    console.error("Failed to fetch alerts:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}
