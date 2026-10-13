import { describe, expect, it } from "vitest";
import { MockCalendarProvider } from "../src/providers/external-services.js";
import { InMemoryClientRepository } from "../src/repositories/client.repository.js";
import { InMemoryPaymentRepository } from "../src/repositories/payment.repository.js";
import { InMemorySessionRepository } from "../src/repositories/session.repository.js";
import { CalendarService } from "../src/services/calendar.service.js";
import { ClientMessageService } from "../src/services/client-message.service.js";
import { PaymentService } from "../src/services/payment.service.js";

describe("ClientMessageService", () => {
  it("routes incoming media as a payment proof", async () => {
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
    await sessions.create({
      clientId: "client-1",
      scheduledAt: new Date("2026-10-19T21:00:00.000Z"),
      durationMinutes: 60,
      price: 30000,
      status: "PAYMENT_PENDING"
    });
    const service = new ClientMessageService(
      undefined,
      new PaymentService(
        clients,
        sessions,
        new CalendarService(new MockCalendarProvider()),
        proofRepository
      )
    );

    const response = await service.handle({
      from: "+5491111111111",
      media: {
        providerMediaId: "media-1",
        mimeType: "image/jpeg"
      }
    });

    expect(response.text).toContain("Recibí el comprobante");
    expect(response.adminNotification).toContain("Juan Perez envió un comprobante");
    expect(proofRepository.proofs).toHaveLength(1);
  });
});
