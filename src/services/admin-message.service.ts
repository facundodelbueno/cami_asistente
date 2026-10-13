import { AdminCommandParserService } from "./admin-command-parser.service.js";
import type { CancellationPolicyService } from "./cancellation-policy.service.js";
import type { PaymentService } from "./payment.service.js";
import type { SessionService } from "./session.service.js";
import type { ConversationStateRepository } from "../repositories/conversation-state.repository.js";
import { formatDateTimeAr, parseLocalDateReference } from "../utils/date.js";

type PendingConfirmation =
  | {
      type: "CREATE_SESSION";
      clientId: string;
      clientName: string;
      scheduledAt: Date;
      durationMinutes: number;
      price: number;
    }
  | {
      type: "CONFIRM_PAYMENT";
      sessionId: string;
      clientName: string;
      scheduledAt: Date;
      price: number;
    };

type MenuState =
  | {
      step: "AWAITING_OPTION";
    }
  | {
      step: "CREATE_SESSION_CLIENT";
    }
  | {
      step: "CREATE_SESSION_DATETIME";
      clientName: string;
    }
  | {
      step: "CONFIRM_PAYMENT_CLIENT";
    };

type AdminMessageResponse = {
  text: string;
  clientMessage?: string;
  clientMessageTo?: string;
  adminNotification?: string;
};

type AdminConversationState = {
  pending?: PendingConfirmation;
  menu?: MenuState;
};

export class AdminMessageService {
  private pendingByPhone = new Map<string, PendingConfirmation>();
  private menuByPhone = new Map<string, MenuState>();

  constructor(
    private readonly parser: AdminCommandParserService,
    private readonly sessions: SessionService,
    private readonly cancellationPolicy?: CancellationPolicyService,
    private readonly payments?: PaymentService,
    private readonly conversationStates?: ConversationStateRepository
  ) {}

  async handle(message: { from: string; text?: string }): Promise<AdminMessageResponse> {
    if (!message.text) {
      return { text: "Por ahora solo puedo procesar mensajes de texto en Fase 1." };
    }

    if (isMenuRequest(message.text)) {
      await this.setMenuState(message.from, { step: "AWAITING_OPTION" });
      return { text: buildAdminMenuText() };
    }

    const cancellationResolution = await this.cancellationPolicy?.resolvePendingFromAdminChoice(message.text);
    if (cancellationResolution) {
      return cancellationResolution;
    }

    const menuResponse: AdminMessageResponse | null = await this.handleMenuState(message.from, message.text);
    if (menuResponse) {
      return menuResponse;
    }

    const action = this.parser.parse(message.text);

    if (action.action === "CONFIRM_PENDING") {
      return this.confirmPending(message.from);
    }

    if (action.action === "CREATE_SESSION") {
      const prepared = await this.sessions.prepareCreateSession({
        clientName: action.clientName,
        scheduledAt: action.scheduledAt
      });

      if (prepared.kind !== "ready") {
        return { text: prepared.message };
      }

      const clientName = `${prepared.client.firstName} ${prepared.client.lastName}`;
      await this.setPendingConfirmation(message.from, {
        type: "CREATE_SESSION",
        clientId: prepared.client.id,
        clientName,
        scheduledAt: prepared.scheduledAt,
        durationMinutes: prepared.durationMinutes,
        price: prepared.price
      });

      return {
        text: [
          `Encontré a ${clientName}.`,
          "",
          `📅 ${formatDateTimeAr(prepared.scheduledAt)}`,
          `💰 $${prepared.price.toLocaleString("es-AR")}`,
          "",
          "¿Confirmo la sesión?"
        ].join("\n")
      };
    }

    if (action.action === "GET_NEXT_SESSIONS") {
      const upcoming = await this.sessions.listUpcoming();
      if (upcoming.length === 0) {
        return { text: "No encontré próximas sesiones agendadas." };
      }
      return {
        text: upcoming
          .map((session) => {
            const name = session.client ? `${session.client.firstName} ${session.client.lastName}` : session.clientId;
            return `• ${name}: ${formatDateTimeAr(session.scheduledAt)} (${session.status})`;
          })
          .join("\n")
      };
    }

    if (action.action === "CONFIRM_PAYMENT") {
      if (!this.payments) {
        return { text: "El servicio de pagos no está disponible." };
      }

      const prepared = await this.payments.prepareConfirmPayment(action.clientName);
      if (prepared.kind !== "ready") {
        return { text: prepared.message };
      }

      await this.setPendingConfirmation(message.from, {
        type: "CONFIRM_PAYMENT",
        sessionId: prepared.session.id,
        clientName: prepared.clientName,
        scheduledAt: prepared.session.scheduledAt,
        price: prepared.session.price
      });

      return {
        text: [
          `Voy a confirmar el pago de ${prepared.clientName}.`,
          "",
          `📅 ${formatDateTimeAr(prepared.session.scheduledAt)}`,
          `💰 $${prepared.session.price.toLocaleString("es-AR")}`,
          "",
          "¿Confirmás que el pago llegó?"
        ].join("\n")
      };
    }

    if (action.action === "GET_LAST_SESSION") {
      const session = await this.sessions.getLastSessionByClientName(action.clientName);
      if (!session) {
        return { text: `No encontré sesiones para ${action.clientName}.` };
      }
      return {
        text: `La última sesión registrada fue ${formatDateTimeAr(session.scheduledAt)}. Estado: ${session.status}.`
      };
    }

    if (action.action === "ADD_SESSION_NOTE") {
      return { text: "Guardar notas desde lenguaje natural queda preparado para una siguiente iteración de Fase 1." };
    }

    return { text: action.action === "UNKNOWN" ? action.reason : "Acción no implementada todavía." };
  }

  private async confirmPending(phone: string): Promise<AdminMessageResponse> {
    const pending = await this.getPendingConfirmation(phone);
    if (!pending) {
      return { text: "No tengo una acción pendiente para confirmar." };
    }

    if (pending.type === "CREATE_SESSION") {
      const session = await this.sessions.createSession({
        clientId: pending.clientId,
        scheduledAt: pending.scheduledAt,
        durationMinutes: pending.durationMinutes,
        price: pending.price
      });
      await this.clearPendingConfirmation(phone);

      return {
        text: [
          "✅ Sesión agendada.",
          `${pending.clientName}: ${formatDateTimeAr(session.scheduledAt)}.`,
          "Estado: PAYMENT_PENDING."
        ].join("\n")
      };
    }

    if (pending.type === "CONFIRM_PAYMENT") {
      if (!this.payments) {
        return { text: "El servicio de pagos no está disponible." };
      }

      const result = await this.payments.confirmPayment(pending.sessionId);
      await this.clearPendingConfirmation(phone);

      return {
        text: [
          "✅ Pago confirmado.",
          `${pending.clientName}: ${formatDateTimeAr(result.session.scheduledAt)}.`,
          "",
          "Mensaje para el consultante:",
          "",
          result.clientMessage
        ].join("\n"),
        clientMessage: result.clientMessage,
        clientMessageTo: result.session.client?.phone
      };
    }

    return { text: "No pude confirmar la acción pendiente." };
  }

  private async handleMenuState(phone: string, text: string): Promise<AdminMessageResponse | null> {
    const state = await this.getMenuState(phone);
    if (!state) return null;

    if (state.step === "AWAITING_OPTION") {
      const option = text.trim();
      if (option === "1") {
        await this.setMenuState(phone, { step: "CREATE_SESSION_CLIENT" });
        return { text: "¿A quién querés agendar?" };
      }

      if (option === "2") {
        await this.setMenuState(phone, { step: "CONFIRM_PAYMENT_CLIENT" });
        return { text: "¿De quién querés confirmar el pago?" };
      }

      if (option === "3") {
        await this.clearMenuState(phone);
        return this.handle({ from: phone, text: "que tengo" });
      }

      if (option === "4") {
        await this.clearMenuState(phone);
        return {
          text: "Para cancelar o reprogramar, por ahora escribime el caso puntual. Ejemplo: “Juan quiere reprogramar” o respondé desde el aviso interno del consultante."
        };
      }

      await this.setMenuState(phone, { step: "AWAITING_OPTION" });
      return { text: `No entendí esa opción.\n\n${buildAdminMenuText()}` };
    }

    if (state.step === "CREATE_SESSION_CLIENT") {
      await this.setMenuState(phone, {
        step: "CREATE_SESSION_DATETIME",
        clientName: text.trim()
      });
      return { text: `¿Para qué día y horario querés agendar a ${text.trim()}?` };
    }

    if (state.step === "CREATE_SESSION_DATETIME") {
      const scheduledAt = parseLocalDateReference(text);
      if (!scheduledAt) {
        return { text: "Necesito día y horario. Por ejemplo: jueves a las 18." };
      }

      await this.clearMenuState(phone);
      return this.handle({
        from: phone,
        text: `Agenda a ${state.clientName} ${text}`
      });
    }

    if (state.step === "CONFIRM_PAYMENT_CLIENT") {
      await this.clearMenuState(phone);
      return this.handle({
        from: phone,
        text: `${text.trim()} pago`
      });
    }

    return null;
  }

  private async getState(phone: string): Promise<AdminConversationState> {
    if (!this.conversationStates) {
      return {
        pending: this.pendingByPhone.get(phone),
        menu: this.menuByPhone.get(phone)
      };
    }

    return deserializeState(await this.conversationStates.get(phone));
  }

  private async setState(phone: string, state: AdminConversationState) {
    if (!this.conversationStates) {
      if (state.pending) this.pendingByPhone.set(phone, state.pending);
      else this.pendingByPhone.delete(phone);

      if (state.menu) this.menuByPhone.set(phone, state.menu);
      else this.menuByPhone.delete(phone);
      return;
    }

    if (!state.pending && !state.menu) {
      await this.conversationStates.clear(phone);
      return;
    }

    await this.conversationStates.set(phone, serializeState(state));
  }

  private async getPendingConfirmation(phone: string) {
    return (await this.getState(phone)).pending;
  }

  private async setPendingConfirmation(phone: string, pending: PendingConfirmation) {
    await this.setState(phone, {
      ...(await this.getState(phone)),
      pending
    });
  }

  private async clearPendingConfirmation(phone: string) {
    const state = await this.getState(phone);
    delete state.pending;
    await this.setState(phone, state);
  }

  private async getMenuState(phone: string) {
    return (await this.getState(phone)).menu;
  }

  private async setMenuState(phone: string, menu: MenuState) {
    await this.setState(phone, {
      ...(await this.getState(phone)),
      menu
    });
  }

  private async clearMenuState(phone: string) {
    const state = await this.getState(phone);
    delete state.menu;
    await this.setState(phone, state);
  }
}

function serializeState(state: AdminConversationState): Record<string, unknown> {
  return {
    pending: state.pending
      ? {
          ...state.pending,
          scheduledAt: state.pending.scheduledAt.toISOString()
        }
      : undefined,
    menu: state.menu
  };
}

function deserializeState(raw: Record<string, unknown> | null): AdminConversationState {
  if (!raw) return {};
  const pending = raw.pending ? deserializePending(raw.pending) : undefined;
  const menu = raw.menu ? deserializeMenu(raw.menu) : undefined;
  return { pending, menu };
}

function deserializePending(raw: unknown): PendingConfirmation | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  if (value.type === "CREATE_SESSION") {
    return {
      type: "CREATE_SESSION",
      clientId: String(value.clientId),
      clientName: String(value.clientName),
      scheduledAt: new Date(String(value.scheduledAt)),
      durationMinutes: Number(value.durationMinutes),
      price: Number(value.price)
    };
  }
  if (value.type === "CONFIRM_PAYMENT") {
    return {
      type: "CONFIRM_PAYMENT",
      sessionId: String(value.sessionId),
      clientName: String(value.clientName),
      scheduledAt: new Date(String(value.scheduledAt)),
      price: Number(value.price)
    };
  }
  return undefined;
}

function deserializeMenu(raw: unknown): MenuState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  if (value.step === "AWAITING_OPTION" || value.step === "CREATE_SESSION_CLIENT" || value.step === "CONFIRM_PAYMENT_CLIENT") {
    return { step: value.step };
  }
  if (value.step === "CREATE_SESSION_DATETIME") {
    return {
      step: "CREATE_SESSION_DATETIME",
      clientName: String(value.clientName)
    };
  }
  return undefined;
}

function isMenuRequest(text: string) {
  return /^(menu|menú|inicio|ayuda)$/i.test(text.trim());
}

function buildAdminMenuText() {
  return [
    "¿Qué querés hacer?",
    "",
    "1. Agendar sesión",
    "2. Confirmar pago",
    "3. Ver próximas sesiones",
    "4. Cancelar o reprogramar"
  ].join("\n");
}
