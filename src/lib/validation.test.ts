import { describe, expect, it } from "vitest";
import { isRequestUrlReady } from "./validation";

describe("isRequestUrlReady", () => {
  it("rejects an empty or whitespace-only URL", () => {
    expect(isRequestUrlReady("")).toBe(false);
    expect(isRequestUrlReady("   ")).toBe(false);
  });

  it("accepts absolute http and https URLs", () => {
    expect(isRequestUrlReady("https://api.test/users")).toBe(true);
    expect(isRequestUrlReady("HTTP://api.test/users")).toBe(true);
  });

  it("accepts URLs templated with variables", () => {
    expect(isRequestUrlReady("{{baseUrl}}/users")).toBe(true);
    expect(isRequestUrlReady("https://api.test/users/{{id}}")).toBe(true);
  });

  it("rejects partial or non-http values", () => {
    expect(isRequestUrlReady("h")).toBe(false);
    expect(isRequestUrlReady("api.test/users")).toBe(false);
    expect(isRequestUrlReady("ftp://api.test")).toBe(false);
  });
});
