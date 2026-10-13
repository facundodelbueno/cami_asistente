import { Router } from "express";
import type { WhatsAppController } from "../controllers/whatsapp.controller.js";

export function createWebhookRoutes(controller: WhatsAppController) {
  const router = Router();

  router.post("/dev/messages", controller.simulateMessage);
  router.get("/webhooks/whatsapp", controller.verifyWebhook);
  router.post("/webhooks/whatsapp", controller.webhook);
  router.post("/webhooks/whatsapp/dev", controller.legacyWebhook);

  return router;
}
