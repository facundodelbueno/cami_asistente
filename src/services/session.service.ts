import type { ClientRepository } from "../repositories/client.repository.js";
import type { SessionRepository } from "../repositories/session.repository.js";
import type { Session, SessionStatus } from "../types/domain.js";

export class SessionService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly sessions: SessionRepository
  ) {}

  async prepareCreateSession(input: { clientName: string; scheduledAt: Date }) {
    const matches = await this.clients.findActiveByName(input.clientName);
    if (matches.length === 0) {
      return { kind: "not_found" as const, message: `No encontré un consultante activo llamado ${input.clientName}.` };
    }
    if (matches.length > 1) {
      return {
        kind: "ambiguous" as const,
        message: `Encontré más de un consultante: ${matches.map((client) => `${client.firstName} ${client.lastName}`).join(", ")}. ¿Cuál?`
      };
    }

    const client = matches[0];
    return {
      kind: "ready" as const,
      client,
      scheduledAt: input.scheduledAt,
      durationMinutes: client.defaultSessionDuration,
      price: client.defaultSessionPrice
    };
  }

  async createSession(input: {
    clientId: string;
    scheduledAt: Date;
    durationMinutes: number;
    price: number;
    status?: SessionStatus;
  }): Promise<Session> {
    return this.sessions.create({
      clientId: input.clientId,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      price: input.price,
      status: input.status ?? "PAYMENT_PENDING"
    });
  }

  async listUpcoming() {
    return this.sessions.findUpcoming();
  }

  async getLastSessionByClientName(clientName: string) {
    const matches = await this.clients.findActiveByName(clientName);
    if (matches.length !== 1) {
      return null;
    }
    return this.sessions.findLastByClient(matches[0].id);
  }
}
