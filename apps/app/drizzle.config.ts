import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env.local");
} catch {}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.APP_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
  },
  strict: true,
  verbose: true,
});
