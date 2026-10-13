import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required.");
}

const url = new URL(connectionString);
url.searchParams.delete("sslmode");

const client = new pg.Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false }
});

const migrationPath = resolve("prisma", "migrations", "20261005200000_initial", "migration.sql");
const migrationSql = await readFile(migrationPath, "utf8");

await client.connect();
try {
  await client.query(migrationSql);
  console.log("Initial migration applied.");
} finally {
  await client.end();
}
