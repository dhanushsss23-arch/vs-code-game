import { z } from "zod";

const databaseUrlSchema = z.string().url().refine(
  (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
  "DATABASE_URL must use PostgreSQL",
);

export function getDatabaseUrl(): string {
  return databaseUrlSchema.parse(process.env.DATABASE_URL);
}

export function getSecret(name: "SESSION_SECRET" | "AUTH_RATE_LIMIT_SECRET"): string {
  const secret = z
    .string()
    .min(32)
    .refine((value) => !value.startsWith("replace-with-"), "Replace the example secret before starting")
    .parse(process.env[name]);
  return secret;
}
