import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { resolveTheme, useResolvedTheme, watchSystemTheme } from "./appearance";

afterEach(() => vi.unstubAllGlobals());

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

test("resolveTheme follows the system colour scheme", () => {
  stubMatchMedia(true);
  expect(resolveTheme("system")).toBe("dark");

  stubMatchMedia(false);
  expect(resolveTheme("system")).toBe("light");
  expect(resolveTheme("dark")).toBe("dark");
  expect(resolveTheme("light")).toBe("light");
});

test("watchSystemTheme subscribes and unsubscribes", () => {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener,
    removeEventListener,
  }));

  const stop = watchSystemTheme(() => {});
  expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));

  stop();
  expect(removeEventListener).toHaveBeenCalledWith(
    "change",
    expect.any(Function),
  );
});

test("useResolvedTheme updates when the system theme changes", () => {
  let matches = true;
  let listener: (() => void) | null = null;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    addEventListener: (_event: string, callback: () => void) => {
      listener = callback;
    },
    removeEventListener: () => {},
  }));

  const { result } = renderHook(() => useResolvedTheme("system"));
  expect(result.current).toBe("dark");

  act(() => {
    matches = false;
    listener?.();
  });
  expect(result.current).toBe("light");
});
