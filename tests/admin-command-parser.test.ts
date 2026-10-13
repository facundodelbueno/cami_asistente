import { describe, expect, it } from "vitest";
import { AdminCommandParserService } from "../src/services/admin-command-parser.service.js";

describe("AdminCommandParserService", () => {
  it("parses a create session command", () => {
    const parser = new AdminCommandParserService();
    const action = parser.parse("Agendá a Juan mañana a las 18", new Date("2026-10-05T12:00:00-03:00"));

    expect(action.action).toBe("CREATE_SESSION");
    if (action.action === "CREATE_SESSION") {
      expect(action.clientName).toBe("juan");
      expect(action.scheduledAt.toISOString()).toBe("2026-10-06T21:00:00.000Z");
    }
  });

  it("requires enough scheduling information", () => {
    const parser = new AdminCommandParserService();
    const action = parser.parse("Agendá a Juan mañana");

    expect(action.action).toBe("UNKNOWN");
  });
});
