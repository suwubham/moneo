import { z } from "zod";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const opt = z.preprocess(blank, z.string().optional());

const schema = z.object({
  environment: z.enum(["development", "preview", "production", "test"]).default("development"),

  // Neon and the Vercel integration inject DATABASE_URL; APP_DATABASE_URL wins when both are set.
  databaseUrl: opt,
  // Previews migrate their own branch on build and refuse to run against this host.
  productionDbHost: opt,

  // Gemini on Vertex AI. An empty project turns every AI feature off; the rest of the app keeps working.
  gcpProject: opt,
  gcpLocation: z.preprocess(blank, z.string().default("global")),
  // Service account key as JSON. Empty falls back to Application Default Credentials (gcloud login locally).
  googleCredentialsJson: opt,
  aiModel: z.preprocess(blank, z.string().default("gemini-3.6-flash")),
  aiHourlyLimit: z.preprocess(blank, z.coerce.number().int().positive().default(60)),

  siteUrl: z.preprocess(blank, z.url().default("http://localhost:3030")),
  webUrl: z.preprocess(blank, z.url().default("http://localhost:3031")),
});

export type Settings = z.infer<typeof schema>;

export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  return schema.parse({
    environment: blank(env.APP_ENVIRONMENT) ?? (env.NODE_ENV === "test" ? "test" : undefined),
    databaseUrl: blank(env.APP_DATABASE_URL) ?? env.DATABASE_URL,
    productionDbHost: env.APP_PRODUCTION_DB_HOST,
    gcpProject: env.GOOGLE_CLOUD_PROJECT,
    gcpLocation: env.GOOGLE_CLOUD_LOCATION,
    googleCredentialsJson: env.APP_GOOGLE_CREDENTIALS_JSON,
    aiModel: env.APP_AI_MODEL,
    aiHourlyLimit: env.APP_AI_HOURLY_LIMIT,
    siteUrl: env.APP_SITE_URL,
    webUrl: env.APP_WEB_URL,
  });
}

export const settings = loadSettings();

export const isProduction = settings.environment === "production";
export const aiEnabled = Boolean(settings.gcpProject);
