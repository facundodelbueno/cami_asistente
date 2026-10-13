import { createPrismaClient } from "../config/prisma.js";
import { MockWhatsAppProvider } from "../providers/external-services.js";
import { PrismaSessionRepository } from "../repositories/session.repository.js";
import { runPaymentRemindersJob } from "./payment-reminders.job.js";

const prisma = createPrismaClient();
const whatsApp = new MockWhatsAppProvider();

const result = await runPaymentRemindersJob({
  sessions: new PrismaSessionRepository(prisma),
  whatsApp
});

console.log(JSON.stringify(result, null, 2));
await prisma.$disconnect();
