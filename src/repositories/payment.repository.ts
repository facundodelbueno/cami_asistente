import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { PaymentProof } from "../types/domain.js";

export interface PaymentRepository {
  createProof(input: {
    sessionId: string;
    clientId: string;
    storagePath: string;
    mimeType: string;
  }): Promise<PaymentProof>;
}

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createProof(input: { sessionId: string; clientId: string; storagePath: string; mimeType: string }) {
    return this.prisma.paymentProof.create({
      data: input
    });
  }
}

export class InMemoryPaymentRepository implements PaymentRepository {
  public proofs: PaymentProof[] = [];

  async createProof(input: { sessionId: string; clientId: string; storagePath: string; mimeType: string }) {
    const proof: PaymentProof = {
      id: randomUUID(),
      receivedAt: new Date(),
      status: "PENDING",
      ...input
    };
    this.proofs.push(proof);
    return proof;
  }
}
