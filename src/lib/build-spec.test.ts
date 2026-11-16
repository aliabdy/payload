import { expect, test } from "vitest";
import type { AuthDef, RequestDef, Settings } from "../types";
import { blankRequest } from "../store/seed";
import { buildRequestSpec } from "./build-spec";

const settings: Settings = {
  theme: "dark",
  accent: "teal",
  timeoutMs: 30_000,
  followRedirects: true,
  verifyTls: true,
  proxy: "",
};

function specFor(auth: AuthDef) {
  const request: RequestDef = {
    ...blankRequest(),
    url: "http://example.test/items",
    auth,
  };
  return buildRequestSpec(request, null, settings).spec;
}

test("bearer and basic auth become Authorization headers", () => {
  const base = blankRequest().auth;
  const bearer = specFor({ ...base, type: "bearer", token: "abc123" });
  expect(bearer.headers).toContainEqual({
    id: "auth-header",
    enabled: true,
    key: "Authorization",
    value: "Bearer abc123",
  });

  const basic = specFor({ ...base, type: "basic", username: "dev", password: "s3cret" });
  expect(basic.headers).toContainEqual({
    id: "auth-header",
    enabled: true,
    key: "Authorization",
    value: "Basic ZGV2OnMzY3JldA==",
  });
});

test("API key auth goes to the chosen header or query", () => {
  const base = blankRequest().auth;
  const header = specFor({
    ...base,
    type: "apiKey",
    key: "X-Api-Key",
    value: "key-1",
    in: "header",
  });
  expect(header.headers).toContainEqual({
    id: "auth-key",
    enabled: true,
    key: "X-Api-Key",
    value: "key-1",
  });
  expect(header.params).toHaveLength(0);

  const query = specFor({
    ...base,
    type: "apiKey",
    key: "api_key",
    value: "key-2",
    in: "query",
  });
  expect(query.params).toContainEqual({
    id: "auth-key",
    enabled: true,
    key: "api_key",
    value: "key-2",
  });
  expect(query.headers).toHaveLength(0);
});
