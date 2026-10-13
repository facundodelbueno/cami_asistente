import type { AdminAction } from "../types/domain.js";
import { normalizeText, parseLocalDateReference } from "../utils/date.js";

export class AdminCommandParserService {
  parse(text: string, now = new Date()): AdminAction {
    const lower = normalizeText(text.trim());

    if (/^(si|sí|confirmo|dale|ok|okay)$/.test(lower)) {
      return { action: "CONFIRM_PENDING" };
    }

    const createMatch = lower.match(/agenda\s+a\s+(.+?)\s+(?:para\s+)?(?=manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|a las|las)/i);
    if (createMatch) {
      const scheduledAt = parseLocalDateReference(text, now);
      if (!scheduledAt) {
        return { action: "UNKNOWN", reason: "Necesito fecha y hora para agendar." };
      }
      return {
        action: "CREATE_SESSION",
        clientName: createMatch[1].trim(),
        scheduledAt
      };
    }

    const paymentMatch = lower.match(/^(.+?)\s+(?:pago|pago|pag[oó]|abono|abon[oó])$/);
    if (paymentMatch) {
      return {
        action: "CONFIRM_PAYMENT",
        clientName: paymentMatch[1].trim()
      };
    }

    if (/que\s+tengo|mi\s+agenda|proxim/.test(lower)) {
      return { action: "GET_NEXT_SESSIONS" };
    }

    const lastSessionMatch = lower.match(/(?:ultima|última|ultimo|último|vimos).+con\s+(.+)$/);
    if (lastSessionMatch) {
      return { action: "GET_LAST_SESSION", clientName: lastSessionMatch[1].trim() };
    }

    return { action: "UNKNOWN", reason: "No pude interpretar el mensaje en Fase 1." };
  }
}
