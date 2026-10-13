import { env } from "../config/env.js";
import type { CancellationRequestRepository } from "../repositories/cancellation-request.repository.js";
import type { ClientRepository } from "../repositories/client.repository.js";
import type { SessionRepository } from "../repositories/session.repository.js";
import { formatDateTimeAr, normalizeText } from "../utils/date.js";
import { normalizePhone } from "../utils/phone.js";

export class CancellationPolicyService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly sessions: SessionRepository,
    private readonly cancellationRequests: CancellationRequestRepository
  ) {}

  isCancellationOrRescheduleIntent(text: string) {
    const normalized = normalizeText(text);
    return /\b(no puedo|cancel|cancela|reprogram|cambiar|pasar|no llego|suspender)\b/.test(normalized);
  }

  async handleClientCancellationMessage(input: { from: string; text: string; now?: Date }) {
    const client = await this.clients.findActiveByPhone(normalizePhone(input.from));
    if (!client) {
      return {
        text: "Dale, dejame que lo revise y te confirmo."
      };
    }

    const session = await this.sessions.findNextByClient(client.id, input.now ?? new Date());
    if (!session) {
      return {
        text: "Dale, dejame que lo revise y te confirmo."
      };
    }

    const hoursBeforeSession = (session.scheduledAt.getTime() - (input.now ?? new Date()).getTime()) / 36e5;
    const withinCancellationWindow = hoursBeforeSession < env.CANCELLATION_POLICY_HOURS;
    const request = await this.cancellationRequests.create({
      sessionId: session.id,
      clientId: client.id,
      clientMessage: input.text,
      hoursBeforeSession,
      withinCancellationWindow
    });

    const clientName = `${client.firstName} ${client.lastName}`;
    const sessionText = formatDateTimeAr(session.scheduledAt);
    const policyText = withinCancellationWindow
      ? `Faltan menos de ${env.CANCELLATION_POLICY_HOURS} hs. Según la política, corresponde cobrarla igual salvo excepción.`
      : `Está fuera de la ventana de ${env.CANCELLATION_POLICY_HOURS} hs; puede cancelarse o reprogramarse dentro de la política.`;

    return {
      text: "Dale, dejame que lo revise y te confirmo.",
      adminNotification: [
        `${clientName} quiere cancelar o reprogramar la sesión de ${sessionText}.`,
        "",
        `Mensaje del consultante: "${input.text}"`,
        policyText,
        "",
        "Opciones:",
        "1. Responder que corresponde abonarla igual",
        "2. Reprogramar como excepción",
        "3. Responder manualmente",
        "",
        `Solicitud interna: ${request.id}`
      ].join("\n")
    };
  }

  async resolvePendingFromAdminChoice(text: string) {
    const normalized = normalizeText(text).trim();
    if (!["1", "2", "3"].includes(normalized)) return null;

    if (normalized === "1") {
      const request = await this.cancellationRequests.resolveLatestPending("CHARGE_CONFIRMED");
      if (!request) return { text: "No encontré una solicitud de cancelación pendiente." };
      const session = request.session ?? (await this.sessions.findById(request.sessionId));
      const sessionStatus = session?.status;
      const alreadyPaid = sessionStatus === "PAID" || sessionStatus === "CONFIRMED";
      const clientMessage = alreadyPaid
        ? "Te entiendo. Como las cancelaciones o reprogramaciones son con al menos 24 hs de anticipación, en este caso no queda saldo a favor, porque había separado este tiempo para vos.\n\nDespués vemos cómo seguimos."
        : "Te entiendo. Como las cancelaciones o reprogramaciones son con al menos 24 hs de anticipación, en este caso corresponde abonar la sesión igualmente, porque había separado este tiempo para vos.\n\nDespués vemos cómo seguimos.";

      return {
        text: [
          "Listo. Respuesta automática para el consultante:",
          "",
          clientMessage
        ].join("\n"),
        clientMessage
      };
    }

    if (normalized === "2") {
      const request = await this.cancellationRequests.resolveLatestPending("RESCHEDULE_EXCEPTION");
      if (!request) return { text: "No encontré una solicitud de cancelación pendiente." };

      return {
        text: "Ok. La marqué como excepción para reprogramar. Decime el nuevo día y horario cuando quieras avanzar con la reprogramación."
      };
    }

    const request = await this.cancellationRequests.resolveLatestPending("MANUAL_RESPONSE");
    if (!request) return { text: "No encontré una solicitud de cancelación pendiente." };

    return {
      text: "Perfecto. La marqué para respuesta manual; no envío nada automático al consultante."
    };
  }
}
