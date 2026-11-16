import { expect, test } from "vitest";
import { migrate } from "./migrate";

function stored(settings: Record<string, unknown>) {
  return {
    version: 1,
    collections: [],
    requests: {},
    environments: [],
    activeEnvId: null,
    history: [],
    settings,
    tabs: [],
    activeTabId: "missing",
    layout: {},
  };
}

test("workspaces saved before accent colors existed default to teal", () => {
  expect(migrate(stored({ theme: "dark" })).settings.accent).toBe("teal");
});

test("known accents survive migration and unknown values fall back", () => {
  expect(migrate(stored({ accent: "rose" })).settings.accent).toBe("rose");
  expect(migrate(stored({ accent: "magenta" })).settings.accent).toBe("teal");
});

test("theme preferences accept system and reject unknown values", () => {
  expect(migrate(stored({ theme: "system" })).settings.theme).toBe("system");
  expect(migrate(stored({ theme: "light" })).settings.theme).toBe("light");
  expect(migrate(stored({ theme: "neon" })).settings.theme).toBe("dark");
});

test("layout defaults sidebarVisible when the key is missing", () => {
  expect(migrate(stored({})).layout.sidebarVisible).toBe(true);
  expect(
    migrate({ ...stored({}), layout: { sidebarVisible: false } }).layout
      .sidebarVisible,
  ).toBe(false);
});
