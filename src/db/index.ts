import { createDatabase } from "@kilocode/app-builder-db";
import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

// Lazy initialization: only create the database client when first accessed at runtime.
// This prevents build-time failures when DB_URL/DB_TOKEN env vars are not set.
let _db: SqliteRemoteDatabase<typeof schema> | null = null;

function getDb(): SqliteRemoteDatabase<typeof schema> {
  if (!_db) {
    _db = createDatabase(schema);
  }
  return _db;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: SqliteRemoteDatabase<typeof schema> = new Proxy({} as any, {
  get(_target, prop: string | symbol) {
    const instance = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (instance as any)[prop];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
