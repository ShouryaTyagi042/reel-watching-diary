/** Applies the generated Drizzle SQL migrations to data/diary.db. */
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { openDb } from "../src/db/connect";

const { sqlite, db } = openDb();
migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
sqlite.close();
console.log("✔ migrations applied → data/diary.db");
