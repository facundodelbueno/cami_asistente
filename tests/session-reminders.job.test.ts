import { describe, expect, it } from "vitest";
import { MockWhatsAppProvider } from "../src/providers/external-services.js";
import type { SessionRepository } from "../src/repositories/session.repository.js";
import {
  buildSessionReminderText,
  isSessionReminderDue,
  runSessionRemindersJob
} from "../src/jobs/session-reminders.job.js";
import type { Session, SessionStatus } from "../src/types/domain.js";

describe("session reminder scheduling", () => {
  it("sends Sunday reminders for Monday paid sessions", async () => {
    const session = makeSession({
      scheduledAt: new Date("2026-10-19T21:00:00.000Z"),
      status: "PAID",
      meetUrl: "https://meet.google.com/mock-test"
    });
    const sessions = new FakeSessionRepository([session]);
    const whatsApp = new MockWhatsAppProvider();

    const result = await runSessionRemindersJob({
      sessions,
      whatsApp,
      now: new Date("2026-10-18T21:05:00.000Z")
    });

    expect(result.sent).toHaveLength(1);
    expect(whatsApp.sent[0].text).toContain("Te dejo nuevamente el link");
    expect(session.sessionReminderSentAt?.toISOString()).toBe("2026-10-18T21:05:00.000Z");
  });

  it("does not send before the day-before window", async () => {
    const session = makeSession({
      scheduledAt: new Date("2026-10-19T21:00:00.000Z"),
      status: "PAID",
      meetUrl: "https://meet.google.com/mock-test"
    });

    expect(isSessionReminderDue(session, new Date("2026-10-18T20:59:00.000Z"))).toBe(false);
  });

  it("does not send duplicates", async () => {
    const session = makeSession({
      scheduledAt: new Date("2026-10-19T21:00:00.000Z"),
      status: "PAID",
      meetUrl: "https://meet.google.com/mock-test",
      sessionReminderSentAt: new Date("2026-10-18T21:05:00.000Z")
    });
    const sessions = new FakeSessionRepository([session]);
    const whatsApp = new MockWhatsAppProvider();

    const result = await runSessionRemindersJob({
      sessions,
      whatsApp,
      now: new Date("2026-10-18T22:00:00.000Z")
    });

    expect(result.checked).toBe(0);
    expect(result.sent).toHaveLength(0);
  });

  it("does not send if the session is not paid or has no link", async () => {
    const pending = makeSession({
      scheduledAt: new Date("2026-10-19T21:00:00.000Z"),
      status: "PAYMENT_PENDING",
      meetUrl: "https://meet.google.com/mock-test"
    });
    const paidWithoutLink = makeSession({
      id: "session-2",
      scheduledAt: new Date("2026-10-19T21:00:00.000Z"),
      status: "PAID"
    });
    const sessions = new FakeSessionRepository([pending, paidWithoutLink]);
    const whatsApp = new MockWhatsAppProvider();

    const result = await runSessionRemindersJob({
      sessions,
      whatsApp,
      now: new Date("2026-10-18T22:00:00.000Z")
    });

    expect(result.checked).toBe(0);
    expect(result.sent).toHaveLength(0);
  });

  it("builds the client-facing session reminder in Cami's voice", () => {
    const text = buildSessionReminderText(
      makeSession({
        scheduledAt: new Date("2026-10-19T21:00:00.000Z"),
        status: "PAID",
        meetUrl: "https://meet.google.com/mock-test"
      })
    );

    expect(text).toContain("Hola Juan");
    expect(text).toContain("mañana tenemos sesión 19/10 a las 18:00");
    expect(text).toContain("https://meet.google.com/mock-test");
  });
});

function makeSession(input: {
  id?: string;
  scheduledAt: Date;
  status: SessionStatus;
  meetUrl?: string;
  sessionReminderSentAt?: Date;
}): Session {
  return {
    id: input.id ?? "session-1",
    clientId: "client-1",
    scheduledAt: input.scheduledAt,
    durationMinutes: 60,
    price: 30000,
    status: input.status,
    meetUrl: input.meetUrl,
    sessionReminderSentAt: input.sessionReminderSentAt,
    client: {
      id: "client-1",
      firstName: "Juan",
      lastName: "Perez",
      phone: "+5491111111111",
      defaultSessionPrice: 30000,
      defaultSessionDuration: 60,
      active: true
    }
  };
}

class FakeSessionRepository implements SessionRepository {
  constructor(private readonly sessions: Session[]) {}

  async create(): Promise<Session> {
    throw new Error("Not implemented");
  }

  async updateStatus(): Promise<Session> {
    throw new Error("Not implemented");
  }

  async findUpcoming(): Promise<Session[]> {
    throw new Error("Not implemented");
  }

  async findPendingPaymentReminderCandidates(): Promise<Session[]> {
    throw new Error("Not implemented");
  }

  async markPaymentReminderSent(): Promise<Session> {
    throw new Error("Not implemented");
  }

  async findSessionReminderCandidates(now = new Date()) {
    return this.sessions.filter(
      (session) =>
        session.scheduledAt >= now &&
        ["PAID", "CONFIRMED"].includes(session.status) &&
        Boolean(session.meetUrl) &&
        !session.sessionReminderSentAt
    );
  }

  async markSessionReminderSent(id: string, sentAt: Date) {
    const session = this.sessions.find((item) => item.id === id);
    if (!session) throw new Error("Session not found");
    session.sessionReminderSentAt = sentAt;
    return session;
  }

  async findNextByClient(): Promise<Session | null> {
    throw new Error("Not implemented");
  }

  async findNextPaymentPendingByClient(): Promise<Session | null> {
    throw new Error("Not implemented");
  }

  async markPaidWithMeeting(): Promise<Session> {
    throw new Error("Not implemented");
  }

  async findLastByClient(): Promise<Session | null> {
    throw new Error("Not implemented");
  }

  async findById(): Promise<Session | null> {
    throw new Error("Not implemented");
  }
}
