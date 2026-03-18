import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { shopifySessions } from "@/db/schema";
import { eq } from "drizzle-orm";

const APP_URL = process.env.SHOPIFY_APP_URL!;
const API_KEY = process.env.SHOPIFY_API_KEY!;
const SCOPES = process.env.SHOPIFY_SCOPES ?? "read_products,write_products";

// GET /api/shopify/auth-url
// Returns the Shopify OAuth URL as JSON so the client can navigate to it
// using window.location.href — avoids server-side redirect which the proxy intercepts
export async function GET(_request: NextRequest) {
  const shop = "neonailuk.myshopify.com";
  const state = crypto.randomBytes(16).toString("hex");

  // Store state in DB temporarily (keyed by state value itself)
  await db
    .insert(shopifySessions)
    .values({
      id: `state_${state}`,
      shop,
      state,
      isOnline: false,
    })
    .onConflictDoUpdate({
      target: shopifySessions.id,
      set: { state },
    });

  const redirectUri = `${APP_URL}/api/auth/callback`;

  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${API_KEY}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}` +
    `&grant_options[]=`;

  return NextResponse.json({ authUrl, state });
}
