import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { CurlImportDialog } from "./CurlImportDialog";

test("invalid cURL is announced and the textarea is marked invalid", async () => {
  const user = userEvent.setup();
  render(<CurlImportDialog open onOpenChange={() => {}} />);
  const textarea = screen.getByRole("textbox", { name: "cURL command" });

  await user.type(textarea, "wget https://example.com");
  await user.click(screen.getByRole("button", { name: "Import request" }));

  const alert = screen.getByRole("alert");
  expect(alert.textContent).toBe("The command must start with curl.");
  expect(textarea.getAttribute("aria-invalid")).toBe("true");
  expect(textarea.getAttribute("aria-describedby")).toBe(alert.id);

  await user.clear(textarea);
  await user.type(textarea, "curl https://example.com");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(textarea.getAttribute("aria-invalid")).toBeNull();
  expect(textarea.getAttribute("aria-describedby")).toBeNull();
});
