import type { PrismaClient, SessionStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import { requiredParam } from "../utils/request.js";

const createSessionInput = z.object({
  clientId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  status: z.enum(["SCHEDULED", "PAYMENT_PENDING", "PAYMENT_PROOF_RECEIVED", "PAID", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).default("PAYMENT_PENDING")
});

const updateSessionInput = createSessionInput.partial();

export class SessionController {
  constructor(private readonly prisma: PrismaClient) {}

  list = async (_req: Request, res: Response) => {
    const sessions = await this.prisma.session.findMany({
      include: { client: true },
      orderBy: { scheduledAt: "asc" }
    });
    res.json(sessions);
  };

  get = async (req: Request, res: Response) => {
    const session = await this.prisma.session.findUnique({
      where: { id: requiredParam(req, "id") },
      include: { client: true, notes: true, paymentProofs: true }
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  };

  create = async (req: Request, res: Response) => {
    const input = createSessionInput.parse(req.body);
    const session = await this.prisma.session.create({
      data: input,
      include: { client: true }
    });
    res.status(201).json(session);
  };

  update = async (req: Request, res: Response) => {
    const input = updateSessionInput.parse(req.body);
    const session = await this.prisma.session.update({
      where: { id: requiredParam(req, "id") },
      data: input,
      include: { client: true }
    });
    res.json(session);
  };

  setStatus = async (req: Request, res: Response) => {
    const input = z.object({ status: createSessionInput.shape.status }).parse(req.body);
    const session = await this.prisma.session.update({
      where: { id: requiredParam(req, "id") },
      data: { status: input.status as SessionStatus },
      include: { client: true }
    });
    res.json(session);
  };
}
