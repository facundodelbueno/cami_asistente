import type { ClientRepository } from "../repositories/client.repository.js";
import type { SessionNoteRepository } from "../repositories/session-note.repository.js";
import type { SessionRepository } from "../repositories/session.repository.js";

export class SessionNoteService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly sessions: SessionRepository,
    private readonly notes: SessionNoteRepository
  ) {}

  async addNoteForLatestSession(input: { clientName: string; rawText: string }) {
    const matches = await this.clients.findActiveByName(input.clientName);
    if (matches.length !== 1) {
      return null;
    }
    const session = await this.sessions.findLastByClient(matches[0].id);
    if (!session) {
      return null;
    }
    return this.notes.create({
      sessionId: session.id,
      clientId: matches[0].id,
      rawText: input.rawText
    });
  }
}
