import crypto from "crypto";

export const sessionIdGenerator = () => {
  return crypto.randomBytes(64).toString("base64url");
};
