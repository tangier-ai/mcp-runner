import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "path";
import { db } from "./db";
import { srcRoot } from "./src-root";

export const migrateDb = () =>
  migrate(db, {
    // remove dist dir if exists because it is in the src/ directory (migrations are not built by tsc)
    migrationsFolder: resolve(srcRoot, "../drizzle"),
  });
