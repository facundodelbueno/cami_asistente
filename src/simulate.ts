import { env } from "./config/env.js";
import { createPrismaClient } from "./config/prisma.js";
import { PrismaClientRepository } from "./repositories/client.repository.js";
import { PrismaSessionRepository } from "./repositories/session.repository.js";
import { AdminCommandParserService } from "./services/admin-command-parser.service.js";
import { SessionService } from "./services/session.service.js";
import { AdminMessageService } from "./services/admin-message.service.js";
import { ClientMessageService } from "./services/client-message.service.js";
import { MessageRouterService } from "./services/message-router.service.js";

const args = parseArgs(process.argv.slice(2));
const prisma = createPrismaClient();

async function main() {
  const clients = new PrismaClientRepository(prisma);
  const sessions = new PrismaSessionRepository(prisma);
  const sessionService = new SessionService(clients, sessions);
  const adminMessages = new AdminMessageService(new AdminCommandParserService(), sessionService);
  const router = new MessageRouterService(adminMessages, new ClientMessageService());

  const result = await router.route({
    from: args.from ?? env.ADMIN_PHONE,
    text: args.text
  });

  console.log(result.text);
}

function parseArgs(argv: string[]) {
  const parsed: { from?: string; text?: string } = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--from") parsed.from = argv[index + 1];
    if (argv[index] === "--text") parsed.text = argv[index + 1];
  }
  if (!parsed.text) {
    throw new Error('Uso: npm run simulate -- --from "+549..." --text "Agendá a Juan mañana a las 18"');
  }
  return parsed;
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error.message);
    await prisma.$disconnect();
    process.exit(1);
  });
