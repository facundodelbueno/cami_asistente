import { Router } from "express";
import type { ClientController } from "../controllers/client.controller.js";

export function createClientRoutes(controller: ClientController) {
  const router = Router();

  router.get("/clients", controller.list);
  router.get("/clients/:id", controller.get);
  router.post("/clients", controller.create);
  router.patch("/clients/:id", controller.update);
  router.post("/clients/:id/deactivate", controller.deactivate);

  return router;
}
