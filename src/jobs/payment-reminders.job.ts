import { getPaymentReminderAt } from "../utils/date.js";
import type { WhatsAppProvider } from "../providers/external-services.js";
import type { SessionRepository } from "../repositories/session.repository.js";
import type { Session } from "../types/domain.js";
import { formatShortDateTimeAr } from "../utils/date.js";

export { getPaymentReminderAt };

export type PaymentReminderJobResult = {
  checked: number;
  sent: Array<{
    sessionId: string;
    clientPhone: string;
    text: string;
  }>;
};

export async function runPaymentRemindersJob(input: {
  sessions: SessionRepository;
  whatsApp: WhatsAppProvider;
  now?: Date;
  reminderHour?: number;
}): Promise<PaymentReminderJobResult> {
  const now = input.now ?? new Date();
  const candidates = await input.sessions.findPendingPaymentReminderCandidates(now);
  const sent: PaymentReminderJobResult["sent"] = [];

  for (const session of candidates) {
    const reminderAt = getPaymentReminderAt(session.scheduledAt, input.reminderHour ?? 10);
    if (reminderAt > now) continue;
    if (!session.client?.phone) continue;

    const text = buildPaymentReminderText(session);
    await input.whatsApp.sendMessage({
      to: session.client.phone,
      text
    });
    await input.sessions.markPaymentReminderSent(session.id, now);
    sent.push({
      sessionId: session.id,
      clientPhone: session.client.phone,
      text
    });
  }

  return {
    checked: candidates.length,
    sent
  };
}

export function buildPaymentReminderText(session: Session) {
  const firstName = session.client?.firstName ?? "";
  return [
    `Hola ${firstName} 😊`.trim(),
    `Te recuerdo que tenemos sesión ${formatShortDateTimeAr(session.scheduledAt)}.`,
    "",
    "Cuando puedas, enviame el comprobante por acá para dejarla confirmada.",
    "",
    "También te recuerdo que las cancelaciones o reprogramaciones son con al menos 24 hs de anticipación."
  ].join("\n");
}
