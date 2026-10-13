import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_PHONE_NUMBER_ID: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),
  META_GRAPH_API_VERSION: z.string().default("v24.0"),
  ADMIN_PHONE: z.string().default("+5491100000000"),
  BUSINESS_WHATSAPP: z.string().optional(),
  APP_TIMEZONE: z.string().default("America/Argentina/Buenos_Aires"),
  CANCELLATION_POLICY_HOURS: z.coerce.number().default(24),
  PAYMENT_REMINDER_RUN_HOUR: z.coerce.number().default(9),
  PORT: z.coerce.number().default(3000)
});

export const env = envSchema.parse(process.env);
