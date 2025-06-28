import { randomBytes } from "crypto";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const deploymentIdGenerator = () =>
  `dp_${randomBytes(16).toString("base64url")}`;

export type StdioTransportInfo = {
  type: "stdio";
};

export type ServerTransportInfo = {
  type: "streamable_http" | "sse";
  endpoint: string;
};

export type TransportInfo = StdioTransportInfo | ServerTransportInfo;

export const DeploymentTable = sqliteTable(
  "Deployment",
  {
    id: text().primaryKey().notNull().$default(deploymentIdGenerator),

    status: text({ enum: ["running", "stopped"] }).notNull(),

    container_id: text().notNull(),
    network_id: text().notNull(),
    image: text().notNull(),

    username: text().notNull(),
    uid: integer().notNull(),
    gid: integer().notNull(),

    max_memory: integer(),
    max_cpus: real(),

    metadata: text({ mode: "json" })
      .notNull()
      .default({})
      .$type<Record<string, any>>(),

    // we wil update this as it comes in from the process
    stderr: text().notNull().default(""),

    transport: text({
      mode: "json",
    })
      .$type<TransportInfo>()
      .notNull(),

    // will automatically pause the container after this many seconds of inactivity
    pause_after_seconds: integer(),

    // will automatically delete the Deployment after this many seconds of inactivity
    delete_after_seconds: integer(),

    // Generated columns
    pause_at: integer({ mode: "timestamp_ms" }),
    delete_at: integer({ mode: "timestamp_ms" }),

    created_at: integer({ mode: "timestamp_ms" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    last_interaction_at: integer({ mode: "timestamp_ms" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("pause_at").on(table.pause_at),
    index("delete_at").on(table.delete_at),
  ],
);
