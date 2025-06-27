import { srcRoot } from "@/src-root";
import { resolve } from "path";

// if the /dist gets added to the path, we remove it
export const sqlitePath = resolve(srcRoot, "../app.db").replace("/dist", "");
