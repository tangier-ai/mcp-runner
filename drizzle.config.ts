import { sqlitePath } from "@/db/sqlite-path";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./src/db/kit",
  schema: "./src/db/schema",
  dialect: "sqlite",
  dbCredentials: {
    url: sqlitePath,
  },
});
