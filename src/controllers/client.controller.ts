import type { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import { requiredParam } from "../utils/request.js";

const clientInput = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email().nullable().optional(),
  defaultSessionPrice: z.number().int().nonnegative(),
  defaultSessionDuration: z.number().int().positive().default(60),
  active: z.boolean().optional()
});

export class ClientController {
  constructor(private readonly prisma: PrismaClient) {}

  list = async (_req: Request, res: Response) => {
    const clients = await this.prisma.client.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });
    res.json(clients);
  };

  get = async (req: Request, res: Response) => {
    const client = await this.prisma.client.findUnique({ where: { id: requiredParam(req, "id") } });
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json(client);
  };

  create = async (req: Request, res: Response) => {
    const input = clientInput.parse(req.body);
    const client = await this.prisma.client.create({ data: input });
    res.status(201).json(client);
  };

  update = async (req: Request, res: Response) => {
    const input = clientInput.partial().parse(req.body);
    const client = await this.prisma.client.update({
      where: { id: requiredParam(req, "id") },
      data: input
    });
    res.json(client);
  };

  deactivate = async (req: Request, res: Response) => {
    const client = await this.prisma.client.update({
      where: { id: requiredParam(req, "id") },
      data: { active: false }
    });
    res.json(client);
  };
}
