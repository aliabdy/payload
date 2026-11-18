import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import type { ResponseData } from "../../types";
import { blankRequest, tabFromRequest } from "../../store/seed";
import { useAppStore } from "../../store/useAppStore";
import { ResponsePanel } from "./ResponsePanel";

function makeResponse(overrides: Partial<ResponseData> = {}): ResponseData {
  return {
    status: 200,
    statusText: "OK",
    httpVersion: "HTTP/1.1",
    finalUrl: "https://mock.test/text",
    contentType: "text/plain",
    headers: [],
    bodyText: "alpha beta alpha gamma ALPHA",
    sizeBytes: 28,
    truncated: false,
    ttfbMs: 4,
    totalMs: 9,
    ...overrides,
  };
}

function renderPanel(overrides: Partial<ResponseData> = {}) {
  const request = blankRequest({ url: "https://mock.test/text" });
  const tab = {
    ...tabFromRequest(request, null),
    response: makeResponse(overrides),
    error: null,
    sending: false,
  };
  useAppStore.setState({ tabs: [tab], activeTabId: tab.id });
  render(<ResponsePanel />);
}

function openSearch() {
  fireEvent.click(screen.getByRole("button", { name: "Search response body" }));
  return screen.getByRole("textbox", { name: "Search response body" });
}

beforeEach(() => {
  useAppStore.setState({ tabs: [], activeTabId: "" });
});

test("counts matches, highlights them, and navigates between them", () => {
  renderPanel();
  const input = openSearch();
  fireEvent.input(input, { target: { value: "alpha" } });

  expect(screen.getByText("1 / 3")).toBeTruthy();
  expect(document.querySelectorAll("mark.search-match")).toHaveLength(3);

  const activeMark = () => document.querySelector("mark.search-match-active");
  expect(activeMark()?.textContent).toBe("alpha");
  expect(activeMark()?.getAttribute("data-search-current")).toBe("true");

  fireEvent.click(screen.getByRole("button", { name: "Next match" }));
  expect(screen.getByText("2 / 3")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Previous match" }));
  expect(screen.getByText("1 / 3")).toBeTruthy();

  fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
  expect(screen.getByText("3 / 3")).toBeTruthy();
});

test("shows a no-results state and disables navigation", () => {
  renderPanel();
  const input = openSearch();
  fireEvent.input(input, { target: { value: "zeta" } });

  expect(screen.getByText("No results")).toBeTruthy();
  expect(document.querySelectorAll("mark.search-match")).toHaveLength(0);
  expect(
    (screen.getByRole("button", { name: "Next match" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("button", { name: "Previous match" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

test("Escape closes the search bar", () => {
  renderPanel();
  const input = openSearch();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(
    screen.queryByRole("textbox", { name: "Search response body" }),
  ).toBeNull();
});

test("the toolbar toggle closes the search bar", () => {
  renderPanel();
  openSearch();
  fireEvent.click(screen.getByRole("button", { name: "Search response body" }));
  expect(
    screen.queryByRole("textbox", { name: "Search response body" }),
  ).toBeNull();
});

test("opening search from another section switches to the body view", () => {
  renderPanel();
  fireEvent.click(screen.getByRole("tab", { name: "Headers" }));
  fireEvent.click(screen.getByRole("button", { name: "Search response body" }));

  expect(screen.getByRole("tab", { name: "Body", selected: true })).toBeTruthy();
  expect(
    screen.getByRole("textbox", { name: "Search response body" }),
  ).toBeTruthy();
});

test("searches the pretty JSON view", () => {
  renderPanel({
    contentType: "application/json",
    bodyText: '{"name":"payload","items":[{"name":"two"}]}',
  });
  const input = openSearch();
  fireEvent.input(input, { target: { value: "name" } });

  expect(screen.getByText("1 / 2")).toBeTruthy();
  const editor = screen.getByRole("textbox", {
    name: "Code editor",
  }) as HTMLTextAreaElement;
  expect(editor.value).toContain('"name": "payload"');
});

test("searches the raw JSON view", () => {
  renderPanel({
    contentType: "application/json",
    bodyText: "{\n  \"name\": \"payload\",\n  \"nameAgain\": \"name\"\n}",
  });
  const input = openSearch();
  fireEvent.click(screen.getByRole("tab", { name: "Raw" }));
  fireEvent.input(input, { target: { value: "name" } });

  expect(screen.getByText("1 / 3")).toBeTruthy();
  expect(document.querySelectorAll("mark.search-match")).toHaveLength(3);
});
