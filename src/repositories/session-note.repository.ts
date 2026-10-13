import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { SessionNote } from "../types/domain.js";

export interface SessionNoteRepository {
  create(input: { sessionId: string; clientId: string; rawText: string; aiSummary?: string | null }): Promise<SessionNote>;
  findLatestByClient(clientId: string, limit?: number): Promise<SessionNote[]>;
}

export class PrismaSessionNoteRepository implements SessionNoteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: { sessionId: string; clientId: string; rawText: string; aiSummary?: string | null }) {
    return this.prisma.sessionNote.create({ data: input });
  }

  async findLatestByClient(clientId: string, limit = 5) {
    return this.prisma.sessionNote.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }
}

export class InMemorySessionNoteRepository implements SessionNoteRepository {
  private notes: SessionNote[] = [];

  async create(input: { sessionId: string; clientId: string; rawText: string; aiSummary?: string | null }) {
    const note: SessionNote = {
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input
    };
    this.notes.push(note);
    return note;
  }

  async findLatestByClient(clientId: string, limit = 5) {
    return this.notes
      .filter((note) => note.clientId === clientId)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, limit);
  }
}
