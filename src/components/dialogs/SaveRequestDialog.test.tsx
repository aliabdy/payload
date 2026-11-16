import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import App from "../../App";
import { resetMockData } from "../../lib/api";
import { useAppStore } from "../../store/useAppStore";

test("requires a name before saving a scratch request", async () => {
  resetMockData();
  const user = userEvent.setup();
  render(<App />);
  await screen.findByLabelText("Request URL");

  await user.click(screen.getByRole("button", { name: "New request tab" }));
  await user.click(screen.getByRole("button", { name: "Save request" }));

  const nameInput = (await screen.findByLabelText(
    "Request name",
  )) as HTMLInputElement;
  expect(nameInput.value).toBe("My request");

  await user.clear(nameInput);
  await user.click(screen.getByRole("button", { name: "Save to collection" }));
  expect(await screen.findByText("Enter a request name.")).toBeTruthy();

  await user.type(nameInput, "Orders API");
  await user.click(screen.getByRole("button", { name: "Save to collection" }));

  await waitFor(() => {
    const requests = Object.values(useAppStore.getState().data.requests);
    expect(requests.some((request) => request.name === "Orders API")).toBe(true);
  });
  expect(useAppStore.getState().saveDialogOpen).toBe(false);
  expect(screen.queryByLabelText("Request name")).toBeNull();
  expect(screen.getAllByText("Orders API").length).toBeGreaterThan(0);
});
