import { env } from "../config/env.js";
import { createPrismaClient } from "../config/prisma.js";
import { MetaWhatsAppProvider, MockWhatsAppProvider } from "../providers/external-services.js";
import { PrismaSessionRepository } from "../repositories/session.repository.js";
import { nextBuenosAiresDailyRun } from "../utils/date.js";
import { logger } from "../utils/logger.js";
import { runPaymentRemindersJob } from "./payment-reminders.job.js";
import { runSessionRemindersJob } from "./session-reminders.job.js";

export function startLocalScheduler() {
  scheduleNextPaymentReminderRun();
}

function createScheduledWhatsAppProvider() {
  return env.META_ACCESS_TOKEN && env.META_PHONE_NUMBER_ID
    ? new MetaWhatsAppProvider()
    : new MockWhatsAppProvider();
}

function scheduleNextPaymentReminderRun(now = new Date()) {
  const nextRun = nextBuenosAiresDailyRun(now, env.PAYMENT_REMINDER_RUN_HOUR);
  const delay = nextRun.getTime() - now.getTime();

  logger.info("Payment reminder job scheduled", {
    nextRun: nextRun.toISOString()
  });

  setTimeout(async () => {
    await runScheduledPaymentReminders();
    scheduleNextPaymentReminderRun();
  }, delay);
}

async function runScheduledPaymentReminders() {
  const prisma = createPrismaClient();
  try {
    const result = await runPaymentRemindersJob({
      sessions: new PrismaSessionRepository(prisma),
      whatsApp: createScheduledWhatsAppProvider()
    });
    const sessionReminderResult = await runSessionRemindersJob({
      sessions: new PrismaSessionRepository(prisma),
      whatsApp: createScheduledWhatsAppProvider()
    });
    logger.info("Payment reminder job finished", {
      checked: result.checked,
      sent: result.sent.length
    });
    logger.info("Session reminder job finished", {
      checked: sessionReminderResult.checked,
      sent: sessionReminderResult.sent.length
    });
  } catch (error) {
    logger.error("Payment reminder job failed", {
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await prisma.$disconnect();
  }
}
