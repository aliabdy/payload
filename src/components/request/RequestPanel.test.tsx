import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import { blankRequest, tabFromRequest } from "../../store/seed";
import { useAppStore } from "../../store/useAppStore";
import { RequestPanel } from "./RequestPanel";

function renderPanel(url: string) {
  const request = blankRequest({ url });
  const tab = {
    ...tabFromRequest(request, null),
    response: null,
    error: null,
    sending: false,
  };
  useAppStore.setState({
    tabs: [tab],
    activeTabId: tab.id,
    data: {
      ...useAppStore.getState().data,
      environments: [],
      activeEnvId: null,
    },
  });
  render(<RequestPanel />);
  return screen.getByLabelText("Request URL") as HTMLInputElement;
}

beforeEach(() => {
  useAppStore.setState({ tabs: [], activeTabId: "" });
});

test("typing a partial URL shows no error until blur", () => {
  const input = renderPanel("");
  fireEvent.change(input, { target: { value: "h" } });
  expect(screen.queryByText("Enter a full http:// or https:// URL.")).toBeNull();

  fireEvent.blur(input);
  expect(
    screen.getByText("Enter a full http:// or https:// URL."),
  ).toBeTruthy();
});

test("an empty URL disables Send", () => {
  const input = renderPanel("");
  expect(input.placeholder).toBe("https://api.example.com/users/{{id}}");
  expect(
    (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});

test("a templated URL is valid", () => {
  const input = renderPanel("{{baseUrl}}/users");
  fireEvent.blur(input);
  expect(screen.queryByText("Enter a full http:// or https:// URL.")).toBeNull();
  expect(
    (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled,
  ).toBe(false);
});
