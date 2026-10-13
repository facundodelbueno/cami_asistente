import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { CancellationRequest, CancellationRequestStatus } from "../types/domain.js";

export interface CancellationRequestRepository {
  create(input: {
    sessionId: string;
    clientId: string;
    clientMessage: string;
    hoursBeforeSession: number;
    withinCancellationWindow: boolean;
  }): Promise<CancellationRequest>;
  findLatestPending(): Promise<CancellationRequest | null>;
  resolveLatestPending(status: CancellationRequestStatus): Promise<CancellationRequest | null>;
}

export class PrismaCancellationRequestRepository implements CancellationRequestRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    sessionId: string;
    clientId: string;
    clientMessage: string;
    hoursBeforeSession: number;
    withinCancellationWindow: boolean;
  }) {
    return this.prisma.cancellationRequest.create({
      data: input,
      include: { client: true, session: true }
    });
  }

  async findLatestPending() {
    return this.prisma.cancellationRequest.findFirst({
      where: { status: "PENDING" },
      include: { client: true, session: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async resolveLatestPending(status: CancellationRequestStatus) {
    const pending = await this.findLatestPending();
    if (!pending) return null;

    return this.prisma.cancellationRequest.update({
      where: { id: pending.id },
      data: {
        status,
        resolvedAt: new Date()
      },
      include: { client: true, session: true }
    });
  }
}

export class InMemoryCancellationRequestRepository implements CancellationRequestRepository {
  private requests: CancellationRequest[] = [];

  async create(input: {
    sessionId: string;
    clientId: string;
    clientMessage: string;
    hoursBeforeSession: number;
    withinCancellationWindow: boolean;
  }) {
    const request: CancellationRequest = {
      id: randomUUID(),
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input
    };
    this.requests.push(request);
    return request;
  }

  async findLatestPending() {
    return (
      this.requests
        .filter((request) => request.status === "PENDING")
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0] ?? null
    );
  }

  async resolveLatestPending(status: CancellationRequestStatus) {
    const request = await this.findLatestPending();
    if (!request) return null;
    request.status = status;
    request.resolvedAt = new Date();
    request.updatedAt = new Date();
    return request;
  }
}
