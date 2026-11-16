import { createAgent } from "@ui-sdk/react/agent";

export const agent = createAgent();

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__payloadAgent = agent;
}
