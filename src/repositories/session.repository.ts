import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Session, SessionStatus } from "../types/domain.js";

export interface SessionRepository {
  create(input: {
    clientId: string;
    scheduledAt: Date;
    durationMinutes: number;
    price: number;
    status: SessionStatus;
  }): Promise<Session>;
  updateStatus(id: string, status: SessionStatus): Promise<Session>;
  findUpcoming(limit?: number): Promise<Session[]>;
  findPendingPaymentReminderCandidates(now?: Date): Promise<Session[]>;
  markPaymentReminderSent(id: string, sentAt: Date): Promise<Session>;
  findSessionReminderCandidates(now?: Date): Promise<Session[]>;
  markSessionReminderSent(id: string, sentAt: Date): Promise<Session>;
  findNextByClient(clientId: string, now?: Date): Promise<Session | null>;
  findNextPaymentPendingByClient(clientId: string, now?: Date): Promise<Session | null>;
  findNextPaymentPendingOnlyByClient(clientId: string, now?: Date): Promise<Session | null>;
  markPaymentProofReceived(id: string): Promise<Session>;
  markPaidWithMeeting(id: string, input: { eventId: string; meetUrl: string; paidAt: Date }): Promise<Session>;
  findLastByClient(clientId: string): Promise<Session | null>;
  findById(id: string): Promise<Session | null>;
}

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: {
    clientId: string;
    scheduledAt: Date;
    durationMinutes: number;
    price: number;
    status: SessionStatus;
  }) {
    return this.prisma.session.create({
      data: input,
      include: { client: true }
    });
  }

  async updateStatus(id: string, status: SessionStatus) {
    return this.prisma.session.update({
      where: { id },
      data: { status },
      include: { client: true }
    });
  }

  async findUpcoming(limit = 10) {
    return this.prisma.session.findMany({
      where: {
        scheduledAt: { gte: new Date() },
        status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] }
      },
      include: { client: true },
      orderBy: { scheduledAt: "asc" },
      take: limit
    });
  }

  async findPendingPaymentReminderCandidates(now = new Date()) {
    return this.prisma.session.findMany({
      where: {
        scheduledAt: { gte: now },
        status: "PAYMENT_PENDING",
        paymentReminderSentAt: null
      },
      include: { client: true },
      orderBy: { scheduledAt: "asc" }
    });
  }

  async markPaymentReminderSent(id: string, sentAt: Date) {
    return this.prisma.session.update({
      where: { id },
      data: { paymentReminderSentAt: sentAt },
      include: { client: true }
    });
  }

  async findSessionReminderCandidates(now = new Date()) {
    return this.prisma.session.findMany({
      where: {
        scheduledAt: { gte: now },
        status: { in: ["PAID", "CONFIRMED"] },
        meetUrl: { not: null },
        sessionReminderSentAt: null
      },
      include: { client: true },
      orderBy: { scheduledAt: "asc" }
    });
  }

  async markSessionReminderSent(id: string, sentAt: Date) {
    return this.prisma.session.update({
      where: { id },
      data: { sessionReminderSentAt: sentAt },
      include: { client: true }
    });
  }

  async findNextByClient(clientId: string, now = new Date()) {
    return this.prisma.session.findFirst({
      where: {
        clientId,
        scheduledAt: { gte: now },
        status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] }
      },
      include: { client: true },
      orderBy: { scheduledAt: "asc" }
    });
  }

  async findNextPaymentPendingByClient(clientId: string, now = new Date()) {
    return this.prisma.session.findFirst({
      where: {
        clientId,
        scheduledAt: { gte: now },
        status: { in: ["PAYMENT_PENDING", "PAYMENT_PROOF_RECEIVED"] }
      },
      include: { client: true },
      orderBy: { scheduledAt: "asc" }
    });
  }

  async findNextPaymentPendingOnlyByClient(clientId: string, now = new Date()) {
    return this.prisma.session.findFirst({
      where: {
        clientId,
        scheduledAt: { gte: now },
        status: "PAYMENT_PENDING"
      },
      include: { client: true },
      orderBy: { scheduledAt: "asc" }
    });
  }

  async markPaymentProofReceived(id: string) {
    return this.prisma.session.update({
      where: { id },
      data: { status: "PAYMENT_PROOF_RECEIVED" },
      include: { client: true }
    });
  }

  async markPaidWithMeeting(id: string, input: { eventId: string; meetUrl: string; paidAt: Date }) {
    return this.prisma.session.update({
      where: { id },
      data: {
        status: "PAID",
        paymentConfirmedAt: input.paidAt,
        googleEventId: input.eventId,
        meetUrl: input.meetUrl
      },
      include: { client: true }
    });
  }

  async findLastByClient(clientId: string) {
    return this.prisma.session.findFirst({
      where: { clientId },
      include: { client: true },
      orderBy: { scheduledAt: "desc" }
    });
  }

  async findById(id: string) {
    return this.prisma.session.findUnique({
      where: { id },
      include: { client: true }
    });
  }
}

export class InMemorySessionRepository implements SessionRepository {
  private sessions: Session[] = [];

  async create(input: {
    clientId: string;
    scheduledAt: Date;
    durationMinutes: number;
    price: number;
    status: SessionStatus;
  }) {
    const session: Session = {
      id: randomUUID(),
      ...input
    };
    this.sessions.push(session);
    return session;
  }

  async updateStatus(id: string, status: SessionStatus) {
    const session = this.sessions.find((item) => item.id === id);
    if (!session) throw new Error("Session not found");
    session.status = status;
    return session;
  }

  async findUpcoming(limit = 10) {
    return this.sessions
      .filter((session) => session.scheduledAt >= new Date() && !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(session.status))
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
      .slice(0, limit);
  }

  async findPendingPaymentReminderCandidates(now = new Date()) {
    return this.sessions
      .filter(
        (session) =>
          session.scheduledAt >= now &&
          session.status === "PAYMENT_PENDING" &&
          !session.paymentReminderSentAt
      )
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  async markPaymentReminderSent(id: string, sentAt: Date) {
    const session = this.sessions.find((item) => item.id === id);
    if (!session) throw new Error("Session not found");
    session.paymentReminderSentAt = sentAt;
    return session;
  }

  async findSessionReminderCandidates(now = new Date()) {
    return this.sessions
      .filter(
        (session) =>
          session.scheduledAt >= now &&
          ["PAID", "CONFIRMED"].includes(session.status) &&
          Boolean(session.meetUrl) &&
          !session.sessionReminderSentAt
      )
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  }

  async markSessionReminderSent(id: string, sentAt: Date) {
    const session = this.sessions.find((item) => item.id === id);
    if (!session) throw new Error("Session not found");
    session.sessionReminderSentAt = sentAt;
    return session;
  }

  async findNextByClient(clientId: string, now = new Date()) {
    return (
      this.sessions
        .filter(
          (session) =>
            session.clientId === clientId &&
            session.scheduledAt >= now &&
            !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(session.status)
        )
        .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0] ?? null
    );
  }

  async findNextPaymentPendingByClient(clientId: string, now = new Date()) {
    return (
      this.sessions
        .filter(
          (session) =>
            session.clientId === clientId &&
            session.scheduledAt >= now &&
            ["PAYMENT_PENDING", "PAYMENT_PROOF_RECEIVED"].includes(session.status)
        )
        .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0] ?? null
    );
  }

  async findNextPaymentPendingOnlyByClient(clientId: string, now = new Date()) {
    return (
      this.sessions
        .filter(
          (session) =>
            session.clientId === clientId &&
            session.scheduledAt >= now &&
            session.status === "PAYMENT_PENDING"
        )
        .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0] ?? null
    );
  }

  async markPaymentProofReceived(id: string) {
    const session = this.sessions.find((item) => item.id === id);
    if (!session) throw new Error("Session not found");
    session.status = "PAYMENT_PROOF_RECEIVED";
    return session;
  }

  async markPaidWithMeeting(id: string, input: { eventId: string; meetUrl: string; paidAt: Date }) {
    const session = this.sessions.find((item) => item.id === id);
    if (!session) throw new Error("Session not found");
    session.status = "PAID";
    session.paymentConfirmedAt = input.paidAt;
    session.googleEventId = input.eventId;
    session.meetUrl = input.meetUrl;
    return session;
  }

  async findLastByClient(clientId: string) {
    return (
      this.sessions
        .filter((session) => session.clientId === clientId)
        .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())[0] ?? null
    );
  }

  async findById(id: string) {
    return this.sessions.find((session) => session.id === id) ?? null;
  }
}
