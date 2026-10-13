import { describe, expect, it } from "vitest";
import { InMemoryCancellationRequestRepository } from "../src/repositories/cancellation-request.repository.js";
import { InMemoryClientRepository } from "../src/repositories/client.repository.js";
import { InMemorySessionRepository } from "../src/repositories/session.repository.js";
import { CancellationPolicyService } from "../src/services/cancellation-policy.service.js";

describe("CancellationPolicyService", () => {
  it("creates a pending cancellation request and answers as Cami", async () => {
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
    const cancellationRequests = new InMemoryCancellationRequestRepository();
    await sessions.create({
      clientId: "client-1",
      scheduledAt: new Date("2026-10-06T21:00:00.000Z"),
      durationMinutes: 60,
      price: 30000,
      status: "PAYMENT_PENDING"
    });
    const service = new CancellationPolicyService(clients, sessions, cancellationRequests);

    const response = await service.handleClientCancellationMessage({
      from: "+5491111111111",
      text: "No puedo ir manana",
      now: new Date("2026-10-06T00:00:00.000Z")
    });

    expect(response.text).toBe("Dale, dejame que lo revise y te confirmo.");
    expect(response.adminNotification).toContain("Faltan menos de 24 hs");
    expect(await cancellationRequests.findLatestPending()).not.toBeNull();
  });

  it("lets Cami choose the automatic charge policy response", async () => {
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
    const cancellationRequests = new InMemoryCancellationRequestRepository();
    await sessions.create({
      clientId: "client-1",
      scheduledAt: new Date("2026-10-06T21:00:00.000Z"),
      durationMinutes: 60,
      price: 30000,
      status: "PAYMENT_PENDING"
    });
    const service = new CancellationPolicyService(clients, sessions, cancellationRequests);

    await service.handleClientCancellationMessage({
      from: "+5491111111111",
      text: "No puedo ir manana",
      now: new Date("2026-10-06T00:00:00.000Z")
    });
    const response = await service.resolvePendingFromAdminChoice("1");

    expect(response?.text).toContain("Respuesta automática");
    expect(response?.clientMessage).toContain("con al menos 24 hs de anticipación");
    expect(response?.clientMessage).toContain("corresponde abonar la sesión igualmente");
    expect(response?.clientMessage).toContain("había separado este tiempo para vos");
    expect(await cancellationRequests.findLatestPending()).toBeNull();
  });

  it("uses already paid wording when the session was paid", async () => {
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
    const cancellationRequests = new InMemoryCancellationRequestRepository();
    const session = await sessions.create({
      clientId: "client-1",
      scheduledAt: new Date("2026-10-06T21:00:00.000Z"),
      durationMinutes: 60,
      price: 30000,
      status: "PAID"
    });
    const service = new CancellationPolicyService(clients, sessions, cancellationRequests);
    await cancellationRequests.create({
      clientId: "client-1",
      sessionId: session.id,
      clientMessage: "No puedo ir manana",
      hoursBeforeSession: 20,
      withinCancellationWindow: true
    });

    const response = await service.resolvePendingFromAdminChoice("1");

    expect(response?.clientMessage).toContain("no queda saldo a favor");
    expect(response?.clientMessage).toContain("con al menos 24 hs de anticipación");
    expect(response?.clientMessage).toContain("había separado este tiempo para vos");
    expect(response?.clientMessage).not.toContain("corresponde abonar la sesión igualmente");
  });
});
