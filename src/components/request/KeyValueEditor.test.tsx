import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { KV } from "../../types";
import { KeyValueEditor } from "./KeyValueEditor";

function Harness() {
  const [items, setItems] = useState<KV[]>([
    { id: "a", enabled: true, key: "Accept", value: "application/json" },
  ]);
  return (
    <KeyValueEditor
      items={items}
      onChange={setItems}
      labelPrefix="Header"
      addLabel="Add header"
    />
  );
}

test("adds, toggles and removes key-value rows", async () => {
  const user = userEvent.setup();
  render(<Harness />);

  const enable = screen.getByRole("checkbox", { name: "Enable Header 1" });
  expect(enable.getAttribute("aria-checked")).toBe("true");
  await user.click(enable);
  expect(enable.getAttribute("aria-checked")).toBe("false");

  const keyInput = screen.getByLabelText("Header 1 key") as HTMLInputElement;
  await user.clear(keyInput);
  await user.type(keyInput, "X-Test");
  expect(keyInput.value).toBe("X-Test");
  expect(screen.getByLabelText("Header 2 key")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Delete Header 2" }));
  expect(screen.queryByLabelText("Header 2 key")).toBeNull();
  expect((screen.getByLabelText("Header 1 key") as HTMLInputElement).value).toBe(
    "X-Test",
  );

  await user.click(screen.getByRole("button", { name: "Add header" }));
  expect(screen.getByLabelText("Header 2 key")).toBeTruthy();
});
