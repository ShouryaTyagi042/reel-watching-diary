import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "./schema";

const DB_PATH = process.env.DIARY_DB ?? path.join(process.cwd(), "data", "diary.db");

// Next dev reloads modules on every edit; cache the connection on globalThis so
// we don't leak file handles.
const g = globalThis as unknown as { __diaryDb?: Database.Database };
const sqlite = g.__diaryDb ?? new Database(DB_PATH, { fileMustExist: false });
if (!g.__diaryDb) {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  g.__diaryDb = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { schema };
