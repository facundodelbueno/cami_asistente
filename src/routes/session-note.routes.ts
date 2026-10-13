import { Router } from "express";
import type { SessionNoteController } from "../controllers/session-note.controller.js";

export function createSessionNoteRoutes(controller: SessionNoteController) {
  const router = Router();

  router.get("/session-notes", controller.list);
  router.get("/session-notes/:id", controller.get);
  router.post("/session-notes", controller.create);
  router.patch("/session-notes/:id", controller.update);
  router.delete("/session-notes/:id", controller.delete);

  return router;
}
