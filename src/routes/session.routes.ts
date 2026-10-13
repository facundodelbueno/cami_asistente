import { Router } from "express";
import type { SessionController } from "../controllers/session.controller.js";

export function createSessionRoutes(controller: SessionController) {
  const router = Router();

  router.get("/sessions", controller.list);
  router.get("/sessions/:id", controller.get);
  router.post("/sessions", controller.create);
  router.patch("/sessions/:id", controller.update);
  router.post("/sessions/:id/status", controller.setStatus);

  return router;
}
