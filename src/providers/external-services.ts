import type { OutboundMessage, Session } from "../types/domain.js";
import { env } from "../config/env.js";

export interface WhatsAppProvider {
  sendMessage(message: OutboundMessage): Promise<void>;
}

export interface CalendarProvider {
  createSessionMeeting(session: Session): Promise<{ eventId: string; meetUrl: string }>;
  updateSessionMeeting(session: Session): Promise<{ eventId: string; meetUrl: string }>;
  cancelSessionMeeting(session: Session): Promise<void>;
}

export interface AIProvider {
  summarizeSessionNote(rawText: string): Promise<string>;
}

export class MockWhatsAppProvider implements WhatsAppProvider {
  public sent: OutboundMessage[] = [];

  async sendMessage(message: OutboundMessage) {
    this.sent.push(message);
  }
}

export class MetaWhatsAppProvider implements WhatsAppProvider {
  constructor(
    private readonly accessToken = env.META_ACCESS_TOKEN,
    private readonly phoneNumberId = env.META_PHONE_NUMBER_ID,
    private readonly graphApiVersion = env.META_GRAPH_API_VERSION
  ) {}

  async sendMessage(message: OutboundMessage) {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error("META_ACCESS_TOKEN and META_PHONE_NUMBER_ID are required to send WhatsApp messages.");
    }

    const response = await fetch(
      `https://graph.facebook.com/${this.graphApiVersion}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: message.to.replace(/\D/g, ""),
          type: "text",
          text: {
            preview_url: false,
            body: message.text
          }
        })
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Meta WhatsApp send failed: ${response.status} ${body}`);
    }
  }
}

export class MockCalendarProvider implements CalendarProvider {
  async createSessionMeeting(session: Session) {
    return {
      eventId: `mock-event-${session.id}`,
      meetUrl: `https://meet.google.com/mock-${session.id.slice(0, 8)}`
    };
  }

  async updateSessionMeeting(session: Session) {
    return this.createSessionMeeting(session);
  }

  async cancelSessionMeeting() {
    return undefined;
  }
}

export class MockAIProvider implements AIProvider {
  async summarizeSessionNote(rawText: string) {
    return rawText.slice(0, 500);
  }
}
