import { describe, expect, it } from "vitest";
import { MockCalendarProvider } from "../src/providers/external-services.js";
import { InMemoryClientRepository } from "../src/repositories/client.repository.js";
import { InMemoryPaymentRepository } from "../src/repositories/payment.repository.js";
import { InMemorySessionRepository } from "../src/repositories/session.repository.js";
import { CalendarService } from "../src/services/calendar.service.js";
import { PaymentService } from "../src/services/payment.service.js";

describe("PaymentService", () => {
  it("confirms payment, creates a meeting and builds the client message", async () => {
    const clients = new InMemoryClientRepository([
      {
        id: "client-1",
        firstName: "Juan",
        lastName: "Perez",
        phone: "+5491111111111",
        defaultSessionPrice: 30000,
        defaultSessionDuration: 60,
        active: true
      }
    ]);
    const sessions = new InMemorySessionRepository();
    const session = await sessions.create({
      clientId: "client-1",
      scheduledAt: new Date("2026-10-19T21:00:00.000Z"),
      durationMinutes: 60,
      price: 30000,
      status: "PAYMENT_PENDING"
    });
    session.client = {
      id: "client-1",
      firstName: "Juan",
      lastName: "Perez",
      phone: "+5491111111111",
      defaultSessionPrice: 30000,
      defaultSessionDuration: 60,
      active: true
    };
    const payments = new PaymentService(clients, sessions, new CalendarService(new MockCalendarProvider()));

    const result = await payments.confirmPayment(session.id, new Date("2026-10-10T12:00:00.000Z"));

    expect(result.session.status).toBe("PAID");
    expect(result.session.meetUrl).toContain("https://meet.google.com/mock-");
    expect(result.session.googleEventId).toContain("mock-event-");
    expect(result.clientMessage).toContain("Gracias Juan");
    expect(result.clientMessage).toContain("Ya quedó confirmado el pago");
    expect(result.clientMessage).toContain("19/10 a las 18:00");
  });

  it("finds the next pending payment session by client name", async () => {
    const clients = new InMemoryClientRepository([
      {
        id: "client-1",
        firstName: "Juan",
        lastName: "Perez",
        phone: "+5491111111111",
        defaultSessionPrice: 30000,
        defaultSessionDuration: 60,
        active: true
      }
    ]);
    const sessions = new InMemorySessionRepository();
    await sessions.create({
      clientId: "client-1",
      scheduledAt: new Date("2026-10-19T21:00:00.000Z"),
      durationMinutes: 60,
      price: 30000,
      status: "PAYMENT_PENDING"
    });
    const payments = new PaymentService(clients, sessions, new CalendarService(new MockCalendarProvider()));

    const prepared = await payments.prepareConfirmPayment("Juan");

    expect(prepared.kind).toBe("ready");
    if (prepared.kind === "ready") {
      expect(prepared.clientName).toBe("Juan Perez");
    }
  });

  it("receives a payment proof and marks the session as proof received", async () => {
    const clients = new InMemoryClientRepository([
      {
        id: "client-1",
        firstName: "Juan",
        lastName: "Perez",
        phone: "+5491111111111",
        defaultSessionPrice: 30000,
        defaultSessionDuration: 60,
        active: true
      }
    ]);
    const sessions = new InMemorySessionRepository();
    const proofRepository = new InMemoryPaymentRepository();
    const session = await sessions.create({
      clientId: "client-1",
      scheduledAt: new Date("2026-10-19T21:00:00.000Z"),
      durationMinutes: 60,
      price: 30000,
      status: "PAYMENT_PENDING"
    });
    const payments = new PaymentService(
      clients,
      sessions,
      new CalendarService(new MockCalendarProvider()),
      proofRepository
    );

    const result = await payments.receivePaymentProof({
      from: "+5491111111111",
      mimeType: "image/jpeg",
      providerMediaId: "media-1"
    });

    expect(result.kind).toBe("received");
    expect(proofRepository.proofs).toHaveLength(1);
    expect(proofRepository.proofs[0]).toMatchObject({
      sessionId: session.id,
      clientId: "client-1",
      mimeType: "image/jpeg",
      status: "PENDING"
    });
    expect((await sessions.findById(session.id))?.status).toBe("PAYMENT_PROOF_RECEIVED");
    expect(result.clientText).toContain("Recibí el comprobante");
    expect(result.adminNotification).toContain("Juan Perez envió un comprobante");
    expect(result.adminNotification).toContain("Juan pago");
  });
});
