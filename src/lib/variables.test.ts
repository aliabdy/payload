import { describe, expect, it } from "vitest";
import type { Environment } from "../types";
import { resolveVariables } from "./variables";

const environment: Environment = {
  id: "env",
  name: "Test",
  vars: [
    { id: "1", enabled: true, key: "baseUrl", value: "https://api.test" },
    { id: "2", enabled: true, key: "id", value: "42" },
    { id: "3", enabled: false, key: "ignored", value: "nope" },
  ],
};

describe("resolveVariables", () => {
  it("replaces enabled variables", () => {
    expect(resolveVariables("{{baseUrl}}/users/{{ id }}", environment)).toEqual({
      text: "https://api.test/users/42",
      unresolved: [],
    });
  });

  it("reports missing and disabled variables without substituting them", () => {
    const result = resolveVariables("{{baseUrl}}/{{missing}}/{{ignored}}", environment);
    expect(result.text).toBe("https://api.test/{{missing}}/{{ignored}}");
    expect(result.unresolved).toEqual(["missing", "ignored"]);
  });

  it("leaves text untouched without an environment", () => {
    expect(resolveVariables("{{baseUrl}}/x", null)).toEqual({
      text: "{{baseUrl}}/x",
      unresolved: ["baseUrl"],
    });
  });
});
