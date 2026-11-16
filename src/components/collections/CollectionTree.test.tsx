import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { useAppStore } from "../../store/useAppStore";
import { CollectionTree } from "./CollectionTree";

test("an empty workspace offers a create-collection action", () => {
  const onCreateCollection = vi.fn();
  useAppStore.setState((state) => ({
    data: { ...state.data, collections: [], requests: {} },
    search: "",
    selectedNode: null,
  }));

  render(<CollectionTree onCreateCollection={onCreateCollection} />);

  fireEvent.click(screen.getByRole("button", { name: "New collection" }));
  expect(onCreateCollection).toHaveBeenCalledTimes(1);
});

test("a search with no matches offers to clear it instead", () => {
  const onClearSearch = vi.fn();
  useAppStore.setState((state) => ({
    data: {
      ...state.data,
      collections: [{ id: "collection-1", name: "Demo", children: [] }],
      requests: {},
    },
    search: "zzz",
    selectedNode: null,
  }));

  render(<CollectionTree onClearSearch={onClearSearch} />);

  expect(screen.getByText(/No requests match/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "New collection" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect(onClearSearch).toHaveBeenCalledTimes(1);
});
