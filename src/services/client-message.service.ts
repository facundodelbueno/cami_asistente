import type { CancellationPolicyService } from "./cancellation-policy.service.js";
import type { PaymentService } from "./payment.service.js";

export class ClientMessageService {
  constructor(
    private readonly cancellationPolicy?: CancellationPolicyService,
    private readonly payments?: PaymentService
  ) {}

  async handle(message: { from: string; text?: string; media?: { providerMediaId?: string; mimeType: string } }) {
    if (message.media) {
      const result = await this.payments?.receivePaymentProof({
        from: message.from,
        mimeType: message.media.mimeType,
        providerMediaId: message.media.providerMediaId
      });
      return {
        text: result?.clientText ?? "Recibí el comprobante. Dejame que lo revise y te confirmo.",
        adminNotification: result?.adminNotification
      };
    }

    if (message.text && /comprobante|transferencia|pago|te paso/i.test(message.text)) {
      return {
        text: "Dale, enviame el comprobante por acá y lo reviso."
      };
    }

    if (message.text && this.cancellationPolicy?.isCancellationOrRescheduleIntent(message.text)) {
      return this.cancellationPolicy.handleClientCancellationMessage({
        from: message.from,
        text: message.text
      });
    }

    return {
      text: "Gracias por escribirme. Apenas pueda lo reviso y te confirmo."
    };
  }
}
