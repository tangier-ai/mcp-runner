import { schema } from "@/db/schema";
import { sqlitePath } from "@/db/sqlite-path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const sqlite = new Database(sqlitePath);

export const db = drizzle({ client: sqlite, schema });
