import type { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import { z } from "zod";
import { requiredParam } from "../utils/request.js";

const noteInput = z.object({
  sessionId: z.string().uuid(),
  clientId: z.string().uuid(),
  rawText: z.string().min(1),
  aiSummary: z.string().nullable().optional()
});

export class SessionNoteController {
  constructor(private readonly prisma: PrismaClient) {}

  list = async (req: Request, res: Response) => {
    const notes = await this.prisma.sessionNote.findMany({
      where: req.query.clientId ? { clientId: String(req.query.clientId) } : undefined,
      orderBy: { createdAt: "desc" }
    });
    res.json(notes);
  };

  get = async (req: Request, res: Response) => {
    const note = await this.prisma.sessionNote.findUnique({ where: { id: requiredParam(req, "id") } });
    if (!note) return res.status(404).json({ error: "Session note not found" });
    res.json(note);
  };

  create = async (req: Request, res: Response) => {
    const input = noteInput.parse(req.body);
    const note = await this.prisma.sessionNote.create({ data: input });
    res.status(201).json(note);
  };

  update = async (req: Request, res: Response) => {
    const input = noteInput.pick({ rawText: true, aiSummary: true }).partial().parse(req.body);
    const note = await this.prisma.sessionNote.update({
      where: { id: requiredParam(req, "id") },
      data: input
    });
    res.json(note);
  };

  delete = async (req: Request, res: Response) => {
    await this.prisma.sessionNote.delete({ where: { id: requiredParam(req, "id") } });
    res.status(204).send();
  };
}
