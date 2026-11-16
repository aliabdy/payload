import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import { blankRequest, tabFromRequest } from "../../store/seed";
import { useAppStore } from "../../store/useAppStore";
import { RequestTabStrip } from "./RequestTabStrip";

test("tabs announce unsaved changes and each has its own close control", () => {
  const saved = tabFromRequest(
    blankRequest({ name: "Saved", url: "https://mock.test/saved" }),
    "request-1",
  );
  const draft = tabFromRequest(
    blankRequest({ name: "Draft", url: "https://mock.test/draft" }),
    null,
  );
  useAppStore.setState({
    tabs: [
      { ...saved, dirty: false, response: null, error: null, sending: false },
      { ...draft, dirty: true, response: null, error: null, sending: false },
    ],
    activeTabId: saved.id,
    pendingCloseTabId: null,
  });

  render(<RequestTabStrip />);

  expect(screen.getByRole("tab", { name: "Saved" })).toBeTruthy();
  expect(
    screen.getByRole("tab", { name: "Draft, unsaved changes" }),
  ).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Close Draft" }));

  expect(useAppStore.getState().activeTabId).toBe(saved.id);
  expect(useAppStore.getState().pendingCloseTabId).toBe(draft.id);
});

test("closing a tab moves focus to the newly active tab", async () => {
  const first = tabFromRequest(
    blankRequest({ name: "First", url: "https://mock.test/first" }),
    null,
  );
  const second = tabFromRequest(
    blankRequest({ name: "Second", url: "https://mock.test/second" }),
    null,
  );
  useAppStore.setState({
    tabs: [
      { ...first, dirty: false, response: null, error: null, sending: false },
      { ...second, dirty: false, response: null, error: null, sending: false },
    ],
    activeTabId: second.id,
    pendingCloseTabId: null,
    focusTabToken: 0,
  });

  render(<RequestTabStrip />);
  fireEvent.click(screen.getByRole("button", { name: "Close Second" }));

  const remaining = screen.getByRole("tab", { name: "First" });
  await waitFor(() => expect(document.activeElement).toBe(remaining));
});
