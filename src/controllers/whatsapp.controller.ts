import type { Request, Response } from "express";
import { env } from "../config/env.js";
import type { WhatsAppProvider } from "../providers/external-services.js";
import type { MessageRouterService } from "../services/message-router.service.js";
import { normalizePhone } from "../utils/phone.js";

export class WhatsAppController {
  constructor(
    private readonly router: MessageRouterService,
    private readonly whatsApp?: WhatsAppProvider
  ) {}

  simulateMessage = async (req: Request, res: Response) => {
    const result = await this.router.route({
      from: req.body.from,
      text: req.body.text,
      media: req.body.media
    });

    res.json(result);
  };

  webhook = async (req: Request, res: Response) => {
    const messages = extractMetaMessages(req.body);
    if (messages.length === 0) {
      res.sendStatus(200);
      return;
    }

    for (const message of messages) {
      const result = await this.router.route(message);
      if (this.whatsApp) {
        await this.whatsApp.sendMessage({ to: normalizePhone(message.from), text: result.text });

        if (result.adminNotification) {
          await this.whatsApp.sendMessage({ to: env.ADMIN_PHONE, text: result.adminNotification });
        }

        if (result.clientMessage && result.clientMessageTo) {
          await this.whatsApp.sendMessage({ to: result.clientMessageTo, text: result.clientMessage });
        }
      }
    }

    res.sendStatus(200);
  };

  verifyWebhook = (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === env.META_VERIFY_TOKEN && typeof challenge === "string") {
      res.status(200).send(challenge);
      return;
    }

    res.sendStatus(403);
  };

  legacyWebhook = async (req: Request, res: Response) => {
    const result = await this.router.route({
      from: req.body.from,
      text: req.body.text,
      media: req.body.media
    });

    res.json(result);
  };
}

function extractMetaMessages(body: unknown) {
  const value = body as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            from?: string;
            type?: string;
            text?: { body?: string };
            image?: { id?: string; mime_type?: string };
            document?: { id?: string; mime_type?: string };
          }>;
        };
      }>;
    }>;
  };

  return (
    value.entry?.flatMap((entry) =>
      entry.changes?.flatMap((change) =>
        change.value?.messages?.map((message) => ({
          from: normalizePhone(message.from ?? ""),
          text: message.type === "text" ? message.text?.body : undefined,
          media:
            message.type === "image" && message.image?.id
              ? { providerMediaId: message.image.id, mimeType: message.image.mime_type ?? "image/jpeg" }
              : message.type === "document" && message.document?.id
                ? { providerMediaId: message.document.id, mimeType: message.document.mime_type ?? "application/octet-stream" }
                : undefined
        })) ?? []
      ) ?? []
    ) ?? []
  ).filter((message) => message.from);
}
