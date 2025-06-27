import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "path";
import { db } from "./db";
import { srcRoot } from "./src-root";

export const migrateDb = () =>
  migrate(db, {
    migrationsFolder: resolve(srcRoot, "db", "kit"),
  });
