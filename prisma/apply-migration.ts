import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const migrationName = process.argv[2];
if (!migrationName) {
  throw new Error("Usage: node dist/prisma/apply-migration.js <migration-folder-name>");
}

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

const migrationPath = resolve("prisma", "migrations", migrationName, "migration.sql");
const migrationSql = await readFile(migrationPath, "utf8");

await client.connect();
try {
  await client.query(migrationSql);
  console.log(`Migration applied: ${migrationName}`);
} finally {
  await client.end();
}
