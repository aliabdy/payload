import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { resetMockData } from "../../lib/api";
import { useAppStore } from "../../store/useAppStore";
import { SettingsDialog } from "./SettingsDialog";

test("theme preference and accent selection are exposed and persisted", () => {
  resetMockData();
  render(<SettingsDialog open onOpenChange={() => {}} />);

  fireEvent.click(screen.getByText("System"));
  expect(useAppStore.getState().data.settings.theme).toBe("system");

  const teal = screen.getByRole("button", { name: "Teal" });
  expect(teal.getAttribute("aria-pressed")).toBe("true");

  fireEvent.click(screen.getByRole("button", { name: "Violet" }));
  expect(useAppStore.getState().data.settings.accent).toBe("violet");
  expect(
    screen.getByRole("button", { name: "Violet" }).getAttribute("aria-pressed"),
  ).toBe("true");
  expect(teal.getAttribute("aria-pressed")).toBe("false");
});
