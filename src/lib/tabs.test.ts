import { expect, test } from "vitest";
import { autoTabName } from "../store/seed";
import { tabDisplayNames } from "./tabs";

test("auto names follow the URL path", () => {
  expect(autoTabName("https://httpbingo.org/status/404?x=1")).toBe(
    "/status/404?x=1",
  );
  expect(autoTabName("https://httpbingo.org")).toBe("/");
  expect(autoTabName("{{baseUrl}}/users/{{id}}")).toBe("/users/{{id}}");
  expect(autoTabName("")).toBe("New request");
});

test("duplicate tab names get a numeric suffix", () => {
  const names = tabDisplayNames([
    { id: "a", name: "/get" },
    { id: "b", name: "/get" },
    { id: "c", name: "/status/404" },
    { id: "d", name: "/get" },
  ]);
  expect(names.get("a")).toBe("/get");
  expect(names.get("b")).toBe("/get (2)");
  expect(names.get("c")).toBe("/status/404");
  expect(names.get("d")).toBe("/get (3)");
});
