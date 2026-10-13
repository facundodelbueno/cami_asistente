import express from "express";
import cors from "cors";
import morgan from "morgan";
import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./config/prisma.js";
import { WhatsAppController } from "./controllers/whatsapp.controller.js";
import { ClientController } from "./controllers/client.controller.js";
import { SessionController } from "./controllers/session.controller.js";
import { SessionNoteController } from "./controllers/session-note.controller.js";
import { createWebhookRoutes } from "./routes/webhook.routes.js";
import { createClientRoutes } from "./routes/client.routes.js";
import { createSessionRoutes } from "./routes/session.routes.js";
import { createSessionNoteRoutes } from "./routes/session-note.routes.js";
import { PrismaClientRepository } from "./repositories/client.repository.js";
import { PrismaSessionRepository } from "./repositories/session.repository.js";
import { PrismaCancellationRequestRepository } from "./repositories/cancellation-request.repository.js";
import { PrismaPaymentRepository } from "./repositories/payment.repository.js";
import { PrismaConversationStateRepository } from "./repositories/conversation-state.repository.js";
import { MetaWhatsAppProvider, MockCalendarProvider } from "./providers/external-services.js";
import { AdminCommandParserService } from "./services/admin-command-parser.service.js";
import { SessionService } from "./services/session.service.js";
import { AdminMessageService } from "./services/admin-message.service.js";
import { ClientMessageService } from "./services/client-message.service.js";
import { MessageRouterService } from "./services/message-router.service.js";
import { CancellationPolicyService } from "./services/cancellation-policy.service.js";
import { CalendarService } from "./services/calendar.service.js";
import { PaymentService } from "./services/payment.service.js";

export function createApp(prisma: PrismaClient = createPrismaClient()) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("tiny"));

  const clientRepository = new PrismaClientRepository(prisma);
  const sessionRepository = new PrismaSessionRepository(prisma);
  const cancellationRequestRepository = new PrismaCancellationRequestRepository(prisma);
  const paymentRepository = new PrismaPaymentRepository(prisma);
  const conversationStateRepository = new PrismaConversationStateRepository(prisma);
  const whatsAppProvider =
    process.env.META_ACCESS_TOKEN && process.env.META_PHONE_NUMBER_ID ? new MetaWhatsAppProvider() : undefined;
  const sessionService = new SessionService(clientRepository, sessionRepository);
  const calendarService = new CalendarService(new MockCalendarProvider());
  const paymentService = new PaymentService(clientRepository, sessionRepository, calendarService, paymentRepository);
  const cancellationPolicy = new CancellationPolicyService(
    clientRepository,
    sessionRepository,
    cancellationRequestRepository
  );
  const adminMessages = new AdminMessageService(
    new AdminCommandParserService(),
    sessionService,
    cancellationPolicy,
    paymentService,
    conversationStateRepository
  );
  const clientMessages = new ClientMessageService(cancellationPolicy, paymentService);
  const router = new MessageRouterService(adminMessages, clientMessages);
  const controller = new WhatsAppController(router, whatsAppProvider);
  const clientController = new ClientController(prisma);
  const sessionController = new SessionController(prisma);
  const sessionNoteController = new SessionNoteController(prisma);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(createWebhookRoutes(controller));
  app.use("/api", createClientRoutes(clientController));
  app.use("/api", createSessionRoutes(sessionController));
  app.use("/api", createSessionNoteRoutes(sessionNoteController));

  return app;
}
