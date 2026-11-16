import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { blankRequest } from "../../store/seed";
import { useAppStore } from "../../store/useAppStore";
import { Sidebar } from "./Sidebar";

test("each search field has a single accessible name", () => {
  const request = blankRequest({
    name: "Ping",
    url: "https://mock.test/ping",
  });
  useAppStore.setState((state) => ({
    data: {
      ...state.data,
      history: [
        {
          id: "history-1",
          method: "GET",
          url: "https://mock.test/ping",
          status: 200,
          timeMs: 12,
          sizeBytes: 64,
          at: new Date().toISOString(),
          request,
        },
      ],
    },
    search: "",
  }));

  render(<Sidebar />);

  expect(
    screen.getByRole("textbox", { name: "Search collections" }),
  ).toBeTruthy();

  fireEvent.click(screen.getByRole("tab", { name: /History/ }));

  expect(screen.getByRole("textbox", { name: "Search history" })).toBeTruthy();
});
