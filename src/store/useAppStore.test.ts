import { expect, test, vi } from "vitest";
import { resetMockData } from "../lib/api";
import { toastSuccess } from "../lib/toast";
import { useAppStore } from "./useAppStore";

vi.mock("../lib/toast", () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

test("new scratch tabs inherit network defaults from settings", async () => {
  resetMockData();
  await useAppStore.getState().hydrate();
  useAppStore.getState().updateSettings({
    timeoutMs: 1234,
    followRedirects: false,
    verifyTls: false,
  });
  useAppStore.getState().createScratchTab();
  const { tabs } = useAppStore.getState();
  const tab = tabs[tabs.length - 1];
  expect(tab?.request.options).toEqual({
    timeoutMs: 1234,
    followRedirects: false,
    verifyTls: false,
  });
});

test("new scratch tabs start empty and clean", async () => {
  resetMockData();
  await useAppStore.getState().hydrate();
  useAppStore.getState().createScratchTab();
  const { tabs } = useAppStore.getState();
  const tab = tabs[tabs.length - 1];
  expect(tab?.request.url).toBe("");
  expect(tab?.dirty).toBe(false);
});

test("sending an empty URL does not send or record history", async () => {
  resetMockData();
  await useAppStore.getState().hydrate();
  useAppStore.getState().createScratchTab();
  const before = useAppStore.getState().data.history.length;
  await useAppStore.getState().sendActive();
  const state = useAppStore.getState();
  expect(state.data.history).toHaveLength(before);
  expect(state.tabs[state.tabs.length - 1]?.sending).toBe(false);
});

test("cancelling a request does not record it in history", async () => {
  resetMockData();
  await useAppStore.getState().hydrate();
  useAppStore.getState().createScratchTab({
    url: "https://mock.test/delay/5",
  });
  const before = useAppStore.getState().data.history.length;
  const sending = useAppStore.getState().sendActive();
  await useAppStore.getState().cancelActive();
  await sending;
  const state = useAppStore.getState();
  const tab = state.tabs[state.tabs.length - 1];
  expect(tab?.error?.kind).toBe("cancelled");
  expect(state.data.history).toHaveLength(before);
  useAppStore.getState().dismissActiveError();
  const dismissed = useAppStore
    .getState()
    .tabs.find((item) => item.id === useAppStore.getState().activeTabId);
  expect(dismissed?.error).toBeNull();
  expect(dismissed?.response).toBeNull();
});

test("closing a clean scratch tab is immediate; a dirty one asks first", async () => {
  resetMockData();
  await useAppStore.getState().hydrate();

  const cleanId = useAppStore.getState().createScratchTab();
  useAppStore.getState().requestCloseTab(cleanId);
  expect(useAppStore.getState().pendingCloseTabId).toBeNull();
  expect(useAppStore.getState().tabs.some((tab) => tab.id === cleanId)).toBe(
    false,
  );

  const dirtyId = useAppStore.getState().createScratchTab();
  useAppStore.getState().updateActiveRequest({ url: "https://mock.test/dirty" });
  useAppStore.getState().requestCloseTab(dirtyId);
  expect(useAppStore.getState().pendingCloseTabId).toBe(dirtyId);

  useAppStore.getState().cancelCloseTab();
  expect(useAppStore.getState().pendingCloseTabId).toBeNull();
  expect(
    useAppStore.getState().tabs.find((tab) => tab.id === dirtyId)?.dirty,
  ).toBe(true);

  useAppStore.getState().requestCloseTab(dirtyId);
  useAppStore.getState().confirmCloseTab();
  expect(useAppStore.getState().pendingCloseTabId).toBeNull();
  expect(useAppStore.getState().tabs.some((tab) => tab.id === dirtyId)).toBe(
    false,
  );
});

test("choosing an accent updates the document and settings", async () => {
  resetMockData();
  await useAppStore.getState().hydrate();
  useAppStore.getState().setAccent("violet");
  expect(document.documentElement.dataset.accent).toBe("violet");
  expect(useAppStore.getState().data.settings.accent).toBe("violet");
});

test("clearing history offers an undo that restores the previous entries", async () => {
  resetMockData();
  await useAppStore.getState().hydrate();
  useAppStore
    .getState()
    .createScratchTab({ url: "https://mock.test/status/201" });
  await useAppStore.getState().sendActive();
  const previous = useAppStore.getState().data.history;
  expect(previous.length).toBeGreaterThan(0);

  vi.mocked(toastSuccess).mockClear();
  useAppStore.getState().clearHistory();
  expect(useAppStore.getState().data.history).toEqual([]);

  const action = vi.mocked(toastSuccess).mock.calls[0]?.[2];
  expect(action?.label).toBe("Undo");
  action?.onAction();
  expect(useAppStore.getState().data.history).toEqual(previous);
});
