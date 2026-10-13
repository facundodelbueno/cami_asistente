import type { WhatsAppProvider } from "../providers/external-services.js";
import type { SessionRepository } from "../repositories/session.repository.js";
import type { Session } from "../types/domain.js";
import { formatShortDateTimeAr } from "../utils/date.js";

export type SessionReminderJobResult = {
  checked: number;
  sent: Array<{
    sessionId: string;
    clientPhone: string;
    text: string;
  }>;
};

export async function runSessionRemindersJob(input: {
  sessions: SessionRepository;
  whatsApp: WhatsAppProvider;
  now?: Date;
}): Promise<SessionReminderJobResult> {
  const now = input.now ?? new Date();
  const candidates = await input.sessions.findSessionReminderCandidates(now);
  const sent: SessionReminderJobResult["sent"] = [];

  for (const session of candidates) {
    if (!isSessionReminderDue(session, now)) continue;
    if (!session.client?.phone || !session.meetUrl) continue;

    const text = buildSessionReminderText(session);
    await input.whatsApp.sendMessage({
      to: session.client.phone,
      text
    });
    await input.sessions.markSessionReminderSent(session.id, now);
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

export function isSessionReminderDue(session: Session, now: Date) {
  const reminderAt = new Date(session.scheduledAt);
  reminderAt.setUTCDate(reminderAt.getUTCDate() - 1);
  return reminderAt <= now;
}

export function buildSessionReminderText(session: Session) {
  const firstName = session.client?.firstName ?? "";
  return [
    `Hola ${firstName} 😊`.trim(),
    `Te recuerdo que mañana tenemos sesión ${formatShortDateTimeAr(session.scheduledAt)}.`,
    "",
    "Te dejo nuevamente el link:",
    session.meetUrl ?? "",
    "",
    "Nos vemos mañana."
  ].join("\n");
}
