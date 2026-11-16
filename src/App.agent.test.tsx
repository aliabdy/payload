import { render, screen, waitFor } from "@testing-library/react";
import { createAgent } from "@ui-sdk/react/agent";
import { expect, test } from "vitest";
import App from "./App";
import { resetMockData } from "./lib/api";

let approve = false;
const agent = createAgent({ allow: (step) => !step.confirm || approve });

test("an agent can find and drive the request workflow", async () => {
  resetMockData();
  render(<App />);

  const urlInput = (await screen.findByLabelText(
    "Request URL",
  )) as HTMLInputElement;
  expect(urlInput.value).toBe("https://httpbingo.org/get");

  const components = agent
    .snapshot()
    .filter((entry) => !entry.offPage && entry.component !== "more");
  for (const entry of components) {
    expect(
      entry.label,
      `${entry.component} ${entry.ref} has no name`,
    ).toBeTruthy();
  }
  const labels = components.flatMap((entry) => [
    entry.label,
    ...(entry.buttons ?? []),
  ]);
  for (const label of [
    "Method",
    "Request URL",
    "Send",
    "New request tab",
    "Environment",
    "Search collections",
    "New request",
    "Theme",
  ]) {
    expect(labels, `${label} is missing from the snapshot`).toContain(label);
  }

  const result = await agent.act({
    steps: [
      {
        ref: "Request URL",
        action: "setValue",
        args: ["https://mock.test/status/201"],
      },
      { ref: "Method", action: "setValue", args: ["POST"] },
      { ref: "Send", action: "press" },
    ],
  });
  expect(result.ok, result.error?.message).toBe(true);
  expect(await screen.findByText("201 OK", undefined, { timeout: 4000 })).toBeTruthy();
  expect(urlInput.value).toBe("https://mock.test/status/201");

  const remove = {
    steps: [
      {
        ref: "More request actions",
        action: "press",
        args: ["Delete saved request"],
      },
      { ref: "Delete request", action: "press" },
    ],
  };
  const refused = await agent.act(remove);
  expect(refused.ok).toBe(false);
  expect(refused.error?.message).toMatch(/person/i);
  expect(screen.getAllByText("HTTPBin GET").length).toBeGreaterThan(0);

  approve = true;
  const allowed = await agent.act(remove);
  expect(allowed.ok, allowed.error?.message).toBe(true);
  await waitFor(() => expect(screen.queryByText("HTTPBin GET")).toBeNull());

  const blank = await agent.act({
    steps: [{ ref: "New request tab", action: "press" }],
  });
  expect(blank.ok, blank.error?.message).toBe(true);
  expect(urlInput.value).toBe("");
  expect(urlInput.placeholder).toBe("https://api.example.com/users/{{id}}");
});
