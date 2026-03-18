import "@shopify/shopify-api/adapters/node";
import {
  shopifyApi,
  ApiVersion,
  Session,
  DeliveryMethod,
} from "@shopify/shopify-api";
import { db } from "@/db";
import { shopifySessions } from "@/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// DB-backed session storage
// ---------------------------------------------------------------------------
const dbSessionStorage = {
  async storeSession(session: Session): Promise<boolean> {
    try {
      await db
        .insert(shopifySessions)
        .values({
          id: session.id,
          shop: session.shop,
          state: session.state,
          isOnline: session.isOnline,
          scope: session.scope,
          expires: session.expires ?? null,
          accessToken: session.accessToken,
          userId: session.onlineAccessInfo?.associated_user?.id ?? null,
          firstName: session.onlineAccessInfo?.associated_user?.first_name ?? null,
          lastName: session.onlineAccessInfo?.associated_user?.last_name ?? null,
          email: session.onlineAccessInfo?.associated_user?.email ?? null,
          accountOwner: session.onlineAccessInfo?.associated_user?.account_owner ?? false,
          locale: session.onlineAccessInfo?.associated_user?.locale ?? null,
          collaborator: session.onlineAccessInfo?.associated_user?.collaborator ?? false,
          emailVerified: session.onlineAccessInfo?.associated_user?.email_verified ?? false,
        })
        .onConflictDoUpdate({
          target: shopifySessions.id,
          set: {
            shop: session.shop,
            state: session.state,
            isOnline: session.isOnline,
            scope: session.scope,
            expires: session.expires ?? null,
            accessToken: session.accessToken,
            userId: session.onlineAccessInfo?.associated_user?.id ?? null,
            firstName: session.onlineAccessInfo?.associated_user?.first_name ?? null,
            lastName: session.onlineAccessInfo?.associated_user?.last_name ?? null,
            email: session.onlineAccessInfo?.associated_user?.email ?? null,
            accountOwner: session.onlineAccessInfo?.associated_user?.account_owner ?? false,
            locale: session.onlineAccessInfo?.associated_user?.locale ?? null,
            collaborator: session.onlineAccessInfo?.associated_user?.collaborator ?? false,
            emailVerified: session.onlineAccessInfo?.associated_user?.email_verified ?? false,
          },
        });
      return true;
    } catch {
      return false;
    }
  },

  async loadSession(id: string): Promise<Session | undefined> {
    const rows = await db
      .select()
      .from(shopifySessions)
      .where(eq(shopifySessions.id, id));
    if (!rows.length) return undefined;
    const row = rows[0];
    const session = new Session({
      id: row.id,
      shop: row.shop,
      state: row.state,
      isOnline: row.isOnline,
    });
    session.scope = row.scope ?? undefined;
    session.expires = row.expires ?? undefined;
    session.accessToken = row.accessToken ?? undefined;
    return session;
  },

  async deleteSession(id: string): Promise<boolean> {
    await db.delete(shopifySessions).where(eq(shopifySessions.id, id));
    return true;
  },

  async deleteSessions(ids: string[]): Promise<boolean> {
    for (const id of ids) {
      await db.delete(shopifySessions).where(eq(shopifySessions.id, id));
    }
    return true;
  },

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const rows = await db
      .select()
      .from(shopifySessions)
      .where(eq(shopifySessions.shop, shop));
    return rows.map((row) => {
      const session = new Session({
        id: row.id,
        shop: row.shop,
        state: row.state,
        isOnline: row.isOnline,
      });
      session.scope = row.scope ?? undefined;
      session.expires = row.expires ?? undefined;
      session.accessToken = row.accessToken ?? undefined;
      return session;
    });
  },
};

// ---------------------------------------------------------------------------
// Shopify API singleton
// ---------------------------------------------------------------------------
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: (process.env.SHOPIFY_SCOPES ?? "read_products,write_products").split(","),
  hostName: (process.env.SHOPIFY_APP_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, ""),
  apiVersion: ApiVersion.January25,
  isEmbeddedApp: false,
  sessionStorage: dbSessionStorage,
});

// ---------------------------------------------------------------------------
// Helper: get the stored offline session for a shop
// ---------------------------------------------------------------------------
export async function getOfflineSession(shop: string): Promise<Session | undefined> {
  const sessionId = shopify.session.getOfflineId(shop);
  return dbSessionStorage.loadSession(sessionId);
}

// ---------------------------------------------------------------------------
// Helper: get a GraphQL client for a shop
// ---------------------------------------------------------------------------
export async function getAdminClient(shop: string) {
  const session = await getOfflineSession(shop);
  if (!session?.accessToken) return null;
  return new shopify.clients.Graphql({ session });
}
