import type { CalendarService } from "./calendar.service.js";
import type { ClientRepository } from "../repositories/client.repository.js";
import type { PaymentRepository } from "../repositories/payment.repository.js";
import type { SessionRepository } from "../repositories/session.repository.js";
import type { Session } from "../types/domain.js";
import { formatShortDateTimeAr } from "../utils/date.js";
import { normalizePhone } from "../utils/phone.js";

export class PaymentService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly sessions: SessionRepository,
    private readonly calendar: CalendarService,
    private readonly payments?: PaymentRepository
  ) {}

  async prepareConfirmPayment(clientName: string) {
    const matches = await this.clients.findActiveByName(clientName);
    if (matches.length === 0) {
      return { kind: "not_found" as const, message: `No encontré un consultante activo llamado ${clientName}.` };
    }

    if (matches.length > 1) {
      return {
        kind: "ambiguous" as const,
        message: `Encontré más de un consultante: ${matches.map((client) => `${client.firstName} ${client.lastName}`).join(", ")}. ¿Cuál?`
      };
    }

    const session = await this.sessions.findNextPaymentPendingByClient(matches[0].id);
    if (!session) {
      return {
        kind: "no_pending_session" as const,
        message: `No encontré una próxima sesión pendiente de pago para ${matches[0].firstName} ${matches[0].lastName}.`
      };
    }

    return {
      kind: "ready" as const,
      clientName: `${matches[0].firstName} ${matches[0].lastName}`,
      session
    };
  }

  async confirmPayment(sessionId: string, now = new Date()) {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const meeting = await this.calendar.createSessionMeeting(session);
    const paidSession = await this.sessions.markPaidWithMeeting(session.id, {
      eventId: meeting.eventId,
      meetUrl: meeting.meetUrl,
      paidAt: now
    });

    return {
      session: paidSession,
      clientMessage: buildPaymentConfirmedMessage(paidSession)
    };
  }

  async receivePaymentProof(input: { from: string; mimeType: string; providerMediaId?: string; now?: Date }) {
    if (!this.payments) {
      return {
        kind: "unavailable" as const,
        clientText: "Recibí el comprobante. Dejame que lo revise y te confirmo."
      };
    }

    const client = await this.clients.findActiveByPhone(normalizePhone(input.from));
    if (!client) {
      return {
        kind: "unknown_client" as const,
        clientText: "Recibí el comprobante. Dejame que lo revise y te confirmo."
      };
    }

    const session = await this.sessions.findNextPaymentPendingOnlyByClient(client.id, input.now ?? new Date());
    if (!session) {
      return {
        kind: "no_pending_session" as const,
        clientText: "Recibí el comprobante. Dejame que lo revise y te confirmo.",
        adminNotification: `${client.firstName} ${client.lastName} envió un comprobante, pero no encontré una próxima sesión pendiente de pago.`
      };
    }

    const proof = await this.payments.createProof({
      sessionId: session.id,
      clientId: client.id,
      mimeType: input.mimeType,
      storagePath: buildMockStoragePath(client.id, session.id, input.providerMediaId)
    });
    await this.sessions.markPaymentProofReceived(session.id);

    return {
      kind: "received" as const,
      proof,
      clientText: `Gracias ${client.firstName} 😊\nRecibí el comprobante. Lo reviso y te confirmo.`,
      adminNotification: [
        `${client.firstName} ${client.lastName} envió un comprobante para la sesión ${formatShortDateTimeAr(session.scheduledAt)}.`,
        "",
        "Cuando confirmes que el pago llegó, escribí:",
        `${client.firstName} pago`
      ].join("\n")
    };
  }
}

function buildMockStoragePath(clientId: string, sessionId: string, providerMediaId = "simulado") {
  return `mock-payment-proofs/${clientId}/${sessionId}/${providerMediaId}`;
}

export function buildPaymentConfirmedMessage(session: Session) {
  const firstName = session.client?.firstName ?? "";
  return [
    `Gracias ${firstName} 😊`.trim(),
    "Ya quedó confirmado el pago de la sesión.",
    "",
    "Te dejo el link para el encuentro:",
    session.meetUrl ?? "",
    "",
    `Nos vemos el ${formatShortDateTimeAr(session.scheduledAt)}.`
  ].join("\n");
}
