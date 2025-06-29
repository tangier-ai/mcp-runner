import { randomBytes } from "crypto";

export const API_KEY =
  process.env.API_KEY || randomBytes(32).toString("base64url");
