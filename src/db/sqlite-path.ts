import { srcRoot } from "@/src-root";
import { resolve } from "path";

// if the /dist gets added to the path, we remove it
export const sqlitePath =
  process.env.NODE_ENV === "production"
    ? process.env.DB_PATH || "/var/mcp-runner/app.db"
    : resolve(srcRoot, "../app.db").replace("/dist", "");
