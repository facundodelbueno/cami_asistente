import { env } from "../config/env.js";
import { samePhone } from "../utils/phone.js";
import type { AdminMessageService } from "./admin-message.service.js";
import type { ClientMessageService } from "./client-message.service.js";

export type IncomingMessage = {
  from: string;
  text?: string;
  media?: {
    providerMediaId: string;
    mimeType: string;
  };
};

export type RoutedMessageResponse = {
  text: string;
  adminNotification?: string;
  clientMessage?: string;
  clientMessageTo?: string;
};

export class MessageRouterService {
  constructor(
    private readonly adminMessages: AdminMessageService,
    private readonly clientMessages: ClientMessageService
  ) {}

  async route(message: IncomingMessage): Promise<RoutedMessageResponse> {
    if (samePhone(message.from, env.ADMIN_PHONE)) {
      return this.adminMessages.handle(message);
    }

    return this.clientMessages.handle(message);
  }
}
