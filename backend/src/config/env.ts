import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default(process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  FIELD_ENCRYPTION_KEY: z.string().min(32).default("recaudex-local-field-key-change-me"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.6-flash"),
  GEMINI_FALLBACK_MODEL: z.string().default("gemini-3.5-flash-lite"),
  GEMINI_PRO_MODEL: z.string().default("gemini-3.1-pro-preview"),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(4096).default(900),
  AI_THINKING_BUDGET: z.coerce.number().int().min(0).max(4096).default(256),
  AI_DEEP_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(512).max(8192).default(1800),
  AI_DEEP_THINKING_BUDGET: z.coerce.number().int().min(256).max(8192).default(2048),
  AI_DEEP_DAILY_TOKEN_BUDGET: z.coerce.number().int().min(5000).default(50000),
  AI_HISTORY_MESSAGES: z.coerce.number().int().min(2).max(30).default(10),
  AI_MAX_TOOL_TURNS: z.coerce.number().int().min(1).max(8).default(4),
  AI_DAILY_TOKEN_BUDGET: z.coerce.number().int().min(10000).default(250000),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(30000),
  CORS_ORIGINS: z.string().default("http://localhost:5173")
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Configuración inválida: ${details}`);
}

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
