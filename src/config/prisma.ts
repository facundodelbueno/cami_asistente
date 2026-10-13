import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env.js";
import { withoutSslMode } from "../utils/database-url.js";

export function createPrismaClient() {
  if (!env.DATABASE_URL) {
    return new PrismaClient();
  }

  const adapter = new PrismaPg({
    connectionString: withoutSslMode(env.DATABASE_URL),
    ssl: { rejectUnauthorized: false }
  });

  return new PrismaClient({ adapter });
}
