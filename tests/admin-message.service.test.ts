import { describe, expect, it } from "vitest";
import { InMemoryClientRepository } from "../src/repositories/client.repository.js";
import { InMemoryConversationStateRepository } from "../src/repositories/conversation-state.repository.js";
import { InMemorySessionRepository } from "../src/repositories/session.repository.js";
import { AdminCommandParserService } from "../src/services/admin-command-parser.service.js";
import { AdminMessageService } from "../src/services/admin-message.service.js";
import { CalendarService } from "../src/services/calendar.service.js";
import { PaymentService } from "../src/services/payment.service.js";
import { SessionService } from "../src/services/session.service.js";
import { MockCalendarProvider } from "../src/providers/external-services.js";

describe("AdminMessageService", () => {
  it("asks confirmation before creating a session", async () => {
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
    const service = new AdminMessageService(new AdminCommandParserService(), new SessionService(clients, sessions));

    const response = await service.handle({
      from: "+5491100000000",
      text: "Agendá a Juan mañana a las 18"
    });

    expect(response.text).toContain("¿Confirmo la sesión?");
    expect(await sessions.findUpcoming()).toHaveLength(0);
  });

  it("creates the session after confirmation", async () => {
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
    const service = new AdminMessageService(new AdminCommandParserService(), new SessionService(clients, sessions));

    await service.handle({ from: "+5491100000000", text: "Agendá a Juan mañana a las 18" });
    const response = await service.handle({ from: "+5491100000000", text: "Sí" });

    expect(response.text).toContain("Sesión agendada");
    expect(await sessions.findUpcoming()).toHaveLength(1);
  });

  it("asks confirmation before marking a payment as received", async () => {
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
    const service = new AdminMessageService(
      new AdminCommandParserService(),
      new SessionService(clients, sessions),
      undefined,
      new PaymentService(clients, sessions, new CalendarService(new MockCalendarProvider()))
    );

    const response = await service.handle({
      from: "+5491100000000",
      text: "Juan pago"
    });

    expect(response.text).toContain("¿Confirmás que el pago llegó?");
  });

  it("marks payment as received after confirmation", async () => {
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
    const service = new AdminMessageService(
      new AdminCommandParserService(),
      new SessionService(clients, sessions),
      undefined,
      new PaymentService(clients, sessions, new CalendarService(new MockCalendarProvider()))
    );

    await service.handle({ from: "+5491100000000", text: "Juan pago" });
    const response = await service.handle({ from: "+5491100000000", text: "Si" });
    const [session] = await sessions.findUpcoming();

    expect(response.text).toContain("Pago confirmado");
    expect(response.clientMessage).toContain("Te dejo el link");
    expect(session.status).toBe("PAID");
    expect(session.meetUrl).toContain("https://meet.google.com/mock-");
  });

  it("supports a guided menu flow for creating a session", async () => {
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
    const service = new AdminMessageService(new AdminCommandParserService(), new SessionService(clients, sessions));

    expect((await service.handle({ from: "+5491100000000", text: "menu" })).text).toContain("1. Agendar sesión");
    expect((await service.handle({ from: "+5491100000000", text: "1" })).text).toContain("¿A quién");
    expect((await service.handle({ from: "+5491100000000", text: "Juan" })).text).toContain("¿Para qué día");
    const prepared = await service.handle({ from: "+5491100000000", text: "manana a las 18" });

    expect(prepared.text).toContain("¿Confirmo la sesión?");
    await service.handle({ from: "+5491100000000", text: "Si" });
    expect(await sessions.findUpcoming()).toHaveLength(1);
  });

  it("supports a guided menu flow for confirming a payment", async () => {
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
    const service = new AdminMessageService(
      new AdminCommandParserService(),
      new SessionService(clients, sessions),
      undefined,
      new PaymentService(clients, sessions, new CalendarService(new MockCalendarProvider()))
    );

    await service.handle({ from: "+5491100000000", text: "menu" });
    expect((await service.handle({ from: "+5491100000000", text: "2" })).text).toContain("¿De quién");
    const prepared = await service.handle({ from: "+5491100000000", text: "Juan" });

    expect(prepared.text).toContain("¿Confirmás que el pago llegó?");
  });

  it("supports a guided menu option for upcoming sessions", async () => {
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
    const service = new AdminMessageService(new AdminCommandParserService(), new SessionService(clients, sessions));

    await service.handle({ from: "+5491100000000", text: "menu" });
    const response = await service.handle({ from: "+5491100000000", text: "3" });

    expect(response.text).toContain("PAYMENT_PENDING");
  });

  it("keeps guided menu state after service recreation", async () => {
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
    const conversationStates = new InMemoryConversationStateRepository();
    const firstService = new AdminMessageService(
      new AdminCommandParserService(),
      new SessionService(clients, sessions),
      undefined,
      undefined,
      conversationStates
    );

    await firstService.handle({ from: "+5491100000000", text: "menu" });
    await firstService.handle({ from: "+5491100000000", text: "1" });

    const secondService = new AdminMessageService(
      new AdminCommandParserService(),
      new SessionService(clients, sessions),
      undefined,
      undefined,
      conversationStates
    );
    const response = await secondService.handle({ from: "+5491100000000", text: "Juan" });

    expect(response.text).toContain("¿Para qué día");
  });

  it("keeps pending confirmations after service recreation", async () => {
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
    const conversationStates = new InMemoryConversationStateRepository();
    const firstService = new AdminMessageService(
      new AdminCommandParserService(),
      new SessionService(clients, sessions),
      undefined,
      undefined,
      conversationStates
    );

    await firstService.handle({ from: "+5491100000000", text: "Agenda a Juan manana a las 18" });

    const secondService = new AdminMessageService(
      new AdminCommandParserService(),
      new SessionService(clients, sessions),
      undefined,
      undefined,
      conversationStates
    );
    const response = await secondService.handle({ from: "+5491100000000", text: "Si" });

    expect(response.text).toContain("Sesión agendada");
    expect(await sessions.findUpcoming()).toHaveLength(1);
  });
});
