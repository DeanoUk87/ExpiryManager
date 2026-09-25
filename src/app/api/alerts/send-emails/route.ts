export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/db";
import { products, productExpiry, reminderRules, alertAcknowledgements } from "@/db/schema";
import { eq, gte } from "drizzle-orm";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const CRON_SECRET = process.env.CRON_SECRET ?? "";
const APP_URL = process.env.SHOPIFY_APP_URL ?? "https://631bc6fe-a22a-4e72-a8b5-6b39e25987db.builder.kiloapps.io";

// Shared logic: compute which alerts are active for each email-enabled rule.
// Returns a map of emailAddress -> list of alert rows to include in the email.
async function computeEmailAlerts() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const activeRules = await db
    .select()
    .from(reminderRules)
    .where(eq(reminderRules.isActive, true));

  const emailRules = activeRules.filter((r) => r.emailEnabled && r.emailAddress);
  if (emailRules.length === 0) return new Map<string, AlertRow[]>();

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

  const acks = await db.select().from(alertAcknowledgements);
  const ackedSet = new Set(acks.map((a) => `${a.ruleId}-${a.productExpiryId}`));

  // Group by email address so one email per address covers all applicable rules
  const byEmail = new Map<string, AlertRow[]>();

  for (const rule of emailRules) {
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() + rule.daysBeforeExpiry);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];

    for (const expiry of allExpiries) {
      if (expiry.expiryDate <= cutoffStr) {
        const key = `${rule.id}-${expiry.expiryId}`;
        if (ackedSet.has(key)) continue; // skip acknowledged alerts

        const expiryDateObj = new Date(expiry.expiryDate + "T00:00:00");
        const daysUntil = Math.round((expiryDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const email = rule.emailAddress!;
        const rows = byEmail.get(email) ?? [];
        rows.push({
          ruleName: rule.name,
          daysBeforeExpiry: rule.daysBeforeExpiry,
          productName: expiry.productName,
          sku: expiry.sku,
          expiryDate: expiry.expiryDate,
          quantity: expiry.quantity,
          daysUntil,
        });
        byEmail.set(email, rows);
      }
    }
  }

  return byEmail;
}

interface AlertRow {
  ruleName: string;
  daysBeforeExpiry: number;
  productName: string;
  sku: string;
  expiryDate: string;
  quantity: number;
  daysUntil: number;
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function urgencyLabel(days: number) {
  if (days <= 0) return "🔴 EXPIRED";
  if (days <= 7) return "🔴 Critical";
  if (days <= 14) return "🟠 Urgent";
  if (days <= 30) return "🟡 Warning";
  return "🟢 Upcoming";
}

function buildEmailHtml(alerts: AlertRow[], recipientEmail: string): string {
  // Sort: most urgent first
  const sorted = [...alerts].sort((a, b) => a.daysUntil - b.daysUntil);

  const rows = sorted
    .map(
      (a) => `
      <tr style="border-bottom:1px solid #374151;">
        <td style="padding:10px 12px;color:#f9fafb;font-weight:500;">${a.productName}</td>
        <td style="padding:10px 12px;color:#9ca3af;font-family:monospace;font-size:13px;">${a.sku}</td>
        <td style="padding:10px 12px;color:#d1d5db;">${formatDate(a.expiryDate)}</td>
        <td style="padding:10px 12px;color:#d1d5db;text-align:center;">${a.quantity}</td>
        <td style="padding:10px 12px;text-align:center;">${urgencyLabel(a.daysUntil)}</td>
      </tr>`
    )
    .join("");

  const expiredCount = sorted.filter((a) => a.daysUntil <= 0).length;
  const criticalCount = sorted.filter((a) => a.daysUntil > 0 && a.daysUntil <= 7).length;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#111827;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111827;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#10b981;border-radius:12px 12px 0 0;padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size:20px;font-weight:700;color:#fff;">Expiry Manager</span>
                  <p style="margin:4px 0 0;color:#d1fae5;font-size:14px;">Daily expiry alert digest</p>
                </td>
                <td align="right">
                  <span style="background:rgba(0,0,0,0.2);color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;">
                    ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Summary -->
        <tr>
          <td style="background:#1f2937;padding:20px 32px;border-left:1px solid #374151;border-right:1px solid #374151;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="33%" align="center" style="padding:8px;">
                  <div style="font-size:28px;font-weight:700;color:#fff;">${sorted.length}</div>
                  <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Total Alerts</div>
                </td>
                <td width="33%" align="center" style="padding:8px;border-left:1px solid #374151;border-right:1px solid #374151;">
                  <div style="font-size:28px;font-weight:700;color:#f87171;">${expiredCount}</div>
                  <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Expired</div>
                </td>
                <td width="33%" align="center" style="padding:8px;">
                  <div style="font-size:28px;font-weight:700;color:#fb923c;">${criticalCount}</div>
                  <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Critical (≤7 days)</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Table -->
        <tr>
          <td style="background:#111827;border:1px solid #374151;border-top:none;border-radius:0 0 12px 12px;overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <thead>
                <tr style="background:#1f2937;">
                  <th style="padding:10px 12px;text-align:left;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Product</th>
                  <th style="padding:10px 12px;text-align:left;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">SKU</th>
                  <th style="padding:10px 12px;text-align:left;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Expiry Date</th>
                  <th style="padding:10px 12px;text-align:center;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Qty</th>
                  <th style="padding:10px 12px;text-align:center;color:#6b7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:24px 0;text-align:center;">
            <a href="${APP_URL}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
              View Dashboard
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="text-align:center;padding-bottom:24px;">
            <p style="color:#4b5563;font-size:12px;margin:0;">
              Sent to ${recipientEmail} · Expiry Manager for neonailuk.myshopify.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// POST /api/alerts/send-emails
// Called by an external cron (e.g. cron-job.org) once per day.
// Requires Authorization: Bearer <CRON_SECRET> header.
export async function POST(request: Request) {
  // Validate cron secret to prevent unauthorised triggering
  if (CRON_SECRET) {
    const authHeader = request.headers.get("Authorization") ?? "";
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const byEmail = await computeEmailAlerts();

    if (byEmail.size === 0) {
      return NextResponse.json({ sent: 0, message: "No active email alerts to send." });
    }

    const results: { email: string; alertCount: number; success: boolean; error?: string }[] = [];

    for (const [email, alerts] of byEmail) {
      const alertCount = alerts.length;
      try {
        await resend.emails.send({
          from: "Expiry Manager <alerts@neonailuk.co.uk>",
          to: email,
          subject: `Expiry Alert: ${alertCount} product${alertCount !== 1 ? "s" : ""} need attention — ${new Date().toLocaleDateString("en-GB")}`,
          html: buildEmailHtml(alerts, email),
        });
        results.push({ email, alertCount, success: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ email, alertCount, success: false, error: msg });
      }
    }

    const sent = results.filter((r) => r.success).length;
    return NextResponse.json({ sent, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Email send error:", message);
    return NextResponse.json({ error: "Failed to send emails", detail: message }, { status: 500 });
  }
}

// GET /api/alerts/send-emails
// Preview: returns the list of alerts that WOULD be emailed, without sending.
// Useful for testing the cron logic without actually sending.
export async function GET(request: Request) {
  if (CRON_SECRET) {
    const authHeader = request.headers.get("Authorization") ?? "";
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const byEmail = await computeEmailAlerts();
    const preview: Record<string, { alertCount: number; alerts: AlertRow[] }> = {};
    for (const [email, alerts] of byEmail) {
      preview[email] = { alertCount: alerts.length, alerts };
    }
    return NextResponse.json({ wouldSendTo: byEmail.size, preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to compute alerts", detail: message }, { status: 500 });
  }
}
