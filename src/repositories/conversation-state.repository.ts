import type { PrismaClient } from "@prisma/client";

export type ConversationStateValue = Record<string, unknown>;

export interface ConversationStateRepository {
  get(phone: string): Promise<ConversationStateValue | null>;
  set(phone: string, state: ConversationStateValue): Promise<void>;
  clear(phone: string): Promise<void>;
}

export class PrismaConversationStateRepository implements ConversationStateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(phone: string) {
    const records = await this.prisma.$queryRaw<Array<{ state: ConversationStateValue }>>`
      SELECT "state"
      FROM "ConversationState"
      WHERE "phone" = ${phone}
      LIMIT 1
    `;
    const record = records[0];
    return record?.state as ConversationStateValue | null;
  }

  async set(phone: string, state: ConversationStateValue) {
    await this.prisma.$executeRaw`
      INSERT INTO "ConversationState" ("phone", "context", "state", "updatedAt")
      VALUES (${phone}, 'ADMIN', ${JSON.stringify(state)}::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT ("phone")
      DO UPDATE SET
        "context" = 'ADMIN',
        "state" = ${JSON.stringify(state)}::jsonb,
        "updatedAt" = CURRENT_TIMESTAMP
    `;
  }

  async clear(phone: string) {
    await this.prisma.$executeRaw`
      DELETE FROM "ConversationState"
      WHERE "phone" = ${phone}
    `;
  }
}

export class InMemoryConversationStateRepository implements ConversationStateRepository {
  private readonly states = new Map<string, ConversationStateValue>();

  async get(phone: string) {
    return this.states.get(phone) ?? null;
  }

  async set(phone: string, state: ConversationStateValue) {
    this.states.set(phone, state);
  }

  async clear(phone: string) {
    this.states.delete(phone);
  }
}
