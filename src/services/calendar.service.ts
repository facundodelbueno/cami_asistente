import type { CalendarProvider } from "../providers/external-services.js";
import type { Session } from "../types/domain.js";

export class CalendarService {
  constructor(private readonly provider: CalendarProvider) {}

  async createSessionMeeting(session: Session) {
    if (session.googleEventId && session.meetUrl) {
      return { eventId: session.googleEventId, meetUrl: session.meetUrl };
    }
    return this.provider.createSessionMeeting(session);
  }
}
