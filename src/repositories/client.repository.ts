import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Client } from "../types/domain.js";

export interface ClientRepository {
  findActiveByName(query: string): Promise<Client[]>;
  findActiveByPhone(phone: string): Promise<Client | null>;
  listActive(): Promise<Client[]>;
  create(input: Omit<Client, "id" | "active" | "createdAt" | "updatedAt">): Promise<Client>;
}

export class PrismaClientRepository implements ClientRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveByName(query: string) {
    const terms = query.trim().split(/\s+/).filter(Boolean);
    const clients = await this.prisma.client.findMany({
      where: { active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });

    return clients.filter((client) => {
      const fullName = normalize(`${client.firstName} ${client.lastName}`);
      return terms.every((term) => fullName.includes(normalize(term)));
    });
  }

  async listActive() {
    return this.prisma.client.findMany({
      where: { active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });
  }

  async findActiveByPhone(phone: string) {
    return this.prisma.client.findFirst({
      where: {
        phone,
        active: true
      }
    });
  }

  async create(input: Omit<Client, "id" | "active" | "createdAt" | "updatedAt">) {
    return this.prisma.client.create({ data: input });
  }
}

export class InMemoryClientRepository implements ClientRepository {
  private clients: Client[];

  constructor(clients: Client[] = []) {
    this.clients = clients;
  }

  async findActiveByName(query: string) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return this.clients.filter((client) => {
      const fullName = normalize(`${client.firstName} ${client.lastName}`);
      return client.active && terms.every((term) => fullName.includes(term));
    });
  }

  async listActive() {
    return this.clients.filter((client) => client.active);
  }

  async findActiveByPhone(phone: string) {
    return this.clients.find((client) => client.active && client.phone === phone) ?? null;
  }

  async create(input: Omit<Client, "id" | "active" | "createdAt" | "updatedAt">) {
    const client: Client = { id: randomUUID(), active: true, ...input };
    this.clients.push(client);
    return client;
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
