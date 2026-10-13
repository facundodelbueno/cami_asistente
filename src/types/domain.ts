export type Client = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  defaultSessionPrice: number;
  defaultSessionDuration: number;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type SessionStatus =
  | "SCHEDULED"
  | "PAYMENT_PENDING"
  | "PAYMENT_PROOF_RECEIVED"
  | "PAID"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type Session = {
  id: string;
  clientId: string;
  scheduledAt: Date;
  durationMinutes: number;
  price: number;
  status: SessionStatus;
  paymentReminderSentAt?: Date | null;
  paymentConfirmedAt?: Date | null;
  googleEventId?: string | null;
  meetUrl?: string | null;
  sessionReminderSentAt?: Date | null;
  postSessionReminderSentAt?: Date | null;
  preSessionSummarySentAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  client?: Client;
};

export type SessionNote = {
  id: string;
  sessionId: string;
  clientId: string;
  rawText: string;
  aiSummary?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type PaymentProof = {
  id: string;
  sessionId: string;
  clientId: string;
  storagePath: string;
  mimeType: string;
  receivedAt?: Date;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

export type CancellationRequestStatus =
  | "PENDING"
  | "CHARGE_CONFIRMED"
  | "RESCHEDULE_EXCEPTION"
  | "MANUAL_RESPONSE"
  | "CANCELLED_ALLOWED";

export type CancellationRequest = {
  id: string;
  sessionId: string;
  clientId: string;
  clientMessage: string;
  hoursBeforeSession: number;
  withinCancellationWindow: boolean;
  status: CancellationRequestStatus;
  createdAt?: Date;
  updatedAt?: Date;
  resolvedAt?: Date | null;
  client?: Client;
  session?: Session;
};

export type AdminAction =
  | {
      action: "CREATE_SESSION";
      clientName: string;
      scheduledAt: Date;
    }
  | {
      action: "CONFIRM_PENDING";
    }
  | {
      action: "GET_NEXT_SESSIONS";
    }
  | {
      action: "GET_LAST_SESSION";
      clientName: string;
    }
  | {
      action: "ADD_SESSION_NOTE";
      clientName: string;
      rawText: string;
    }
  | {
      action: "CONFIRM_PAYMENT";
      clientName: string;
    }
  | {
      action: "UNKNOWN";
      reason: string;
    };

export type OutboundMessage = {
  to: string;
  text: string;
};
