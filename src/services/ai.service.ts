import type { AIProvider } from "../providers/external-services.js";

export class AIService {
  constructor(private readonly provider: AIProvider) {}

  async summarizeSessionNote(rawText: string) {
    return this.provider.summarizeSessionNote(rawText);
  }
}
