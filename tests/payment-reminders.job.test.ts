import { describe, expect, it } from "vitest";
import {
  buildPaymentReminderText,
  getPaymentReminderAt,
  runPaymentRemindersJob
} from "../src/jobs/payment-reminders.job.js";
import { MockWhatsAppProvider } from "../src/providers/external-services.js";
import type { SessionRepository } from "../src/repositories/session.repository.js";
import type { Session, SessionStatus } from "../src/types/domain.js";
import { nextBuenosAiresDailyRun } from "../src/utils/date.js";

describe("payment reminder scheduling", () => {
  it("schedules Monday sessions on the previous Friday", () => {
    const mondaySession = new Date("2026-10-12T21:00:00.000Z");
    const reminder = getPaymentReminderAt(mondaySession, 10);

    expect(reminder.toISOString()).toBe("2026-10-09T13:00:00.000Z");
  });

  it("keeps Thursday sessions two days before", () => {
    const thursdaySession = new Date("2026-10-08T21:00:00.000Z");
    const reminder = getPaymentReminderAt(thursdaySession, 10);

    expect(reminder.toISOString()).toBe("2026-10-06T13:00:00.000Z");
  });

  it("sends due payment reminders and marks them as sent", async () => {
    const session = makeSession({
      scheduledAt: new Date("2026-10-19T21:00:00.000Z")
    });
    const sessions = new FakeSessionRepository([session]);
    const whatsApp = new MockWhatsAppProvider();

    const result = await runPaymentRemindersJob({
      sessions,
      whatsApp,
      now: new Date("2026-10-16T13:05:00.000Z")
    });

    expect(result.checked).toBe(1);
    expect(result.sent).toHaveLength(1);
    expect(whatsApp.sent[0]).toMatchObject({
      to: "+5491111111111"
    });
    expect(whatsApp.sent[0].text).toContain("Te recuerdo que tenemos sesión");
    expect(session.paymentReminderSentAt?.toISOString()).toBe("2026-10-16T13:05:00.000Z");
  });

  it("does not send payment reminders before they are due", async () => {
    const session = makeSession({
      scheduledAt: new Date("2026-10-19T21:00:00.000Z")
    });
    const sessions = new FakeSessionRepository([session]);
    const whatsApp = new MockWhatsAppProvider();

    const result = await runPaymentRemindersJob({
      sessions,
      whatsApp,
      now: new Date("2026-10-16T12:59:00.000Z")
    });

    expect(result.sent).toHaveLength(0);
    expect(whatsApp.sent).toHaveLength(0);
    expect(session.paymentReminderSentAt).toBeUndefined();
  });

  it("does not send duplicate payment reminders", async () => {
    const session = makeSession({
      scheduledAt: new Date("2026-10-19T21:00:00.000Z"),
      paymentReminderSentAt: new Date("2026-10-16T13:05:00.000Z")
    });
    const sessions = new FakeSessionRepository([session]);
    const whatsApp = new MockWhatsAppProvider();

    const result = await runPaymentRemindersJob({
      sessions,
      whatsApp,
      now: new Date("2026-10-16T14:00:00.000Z")
    });

    expect(result.checked).toBe(0);
    expect(result.sent).toHaveLength(0);
  });

  it("builds the client-facing message in Cami's voice", () => {
    const text = buildPaymentReminderText(
      makeSession({
        scheduledAt: new Date("2026-10-19T21:00:00.000Z")
      })
    );

    expect(text).toContain("Hola Juan");
    expect(text).toContain("tenemos sesión 19/10 a las 18:00");
    expect(text).toContain("enviame el comprobante");
    expect(text).toContain("24 hs de anticipación");
  });

  it("schedules the local runner at 9 AM Argentina", () => {
    const beforeNine = nextBuenosAiresDailyRun(new Date("2026-10-06T11:00:00.000Z"), 9);
    const afterNine = nextBuenosAiresDailyRun(new Date("2026-10-06T13:00:00.000Z"), 9);

    expect(beforeNine.toISOString()).toBe("2026-10-06T12:00:00.000Z");
    expect(afterNine.toISOString()).toBe("2026-10-07T12:00:00.000Z");
  });

  it("does not schedule the local runner on weekends", () => {
    const saturday = nextBuenosAiresDailyRun(new Date("2026-10-10T11:00:00.000Z"), 9);
    const sunday = nextBuenosAiresDailyRun(new Date("2026-10-11T11:00:00.000Z"), 9);

    expect(saturday.toISOString()).toBe("2026-10-12T12:00:00.000Z");
    expect(sunday.toISOString()).toBe("2026-10-12T12:00:00.000Z");
  });
});

function makeSession(input: {
  scheduledAt: Date;
  status?: SessionStatus;
  paymentReminderSentAt?: Date;
}): Session {
  return {
    id: "session-1",
    clientId: "client-1",
    scheduledAt: input.scheduledAt,
    durationMinutes: 60,
    price: 30000,
    status: input.status ?? "PAYMENT_PENDING",
    paymentReminderSentAt: input.paymentReminderSentAt,
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

  async findPendingPaymentReminderCandidates(now = new Date()) {
    return this.sessions.filter(
      (session) =>
        session.scheduledAt >= now &&
        session.status === "PAYMENT_PENDING" &&
        !session.paymentReminderSentAt
    );
  }

  async markPaymentReminderSent(id: string, sentAt: Date) {
    const session = this.sessions.find((item) => item.id === id);
    if (!session) throw new Error("Session not found");
    session.paymentReminderSentAt = sentAt;
    return session;
  }

  async findNextByClient(): Promise<Session | null> {
    throw new Error("Not implemented");
  }

  async findLastByClient(): Promise<Session | null> {
    throw new Error("Not implemented");
  }

  async findById(): Promise<Session | null> {
    throw new Error("Not implemented");
  }
}
