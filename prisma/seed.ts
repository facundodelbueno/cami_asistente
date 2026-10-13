import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function withoutSslMode(connectionString: string) {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  return url.toString();
}

const adapter = process.env.DATABASE_URL
  ? new PrismaPg({
      connectionString: withoutSslMode(process.env.DATABASE_URL),
      ssl: { rejectUnauthorized: false }
    })
  : undefined;

const prisma = adapter ? new PrismaClient({ adapter }) : new PrismaClient();

async function main() {
  const clients = [
    {
      firstName: "Juan",
      lastName: "Perez",
      phone: "+5491111111111",
      email: "juan.perez@example.com",
      defaultSessionPrice: 30000,
      defaultSessionDuration: 60
    },
    {
      firstName: "Maria",
      lastName: "Gomez",
      phone: "+5491122222222",
      email: "maria.gomez@example.com",
      defaultSessionPrice: 30000,
      defaultSessionDuration: 60
    },
    {
      firstName: "Pedro",
      lastName: "Lopez",
      phone: "+5491133333333",
      email: null,
      defaultSessionPrice: 28000,
      defaultSessionDuration: 50
    }
  ];

  for (const client of clients) {
    await prisma.client.upsert({
      where: { phone: client.phone },
      update: client,
      create: client
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
