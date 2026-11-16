import type { TabState } from "../types";

export function tabDisplayNames(
  tabs: Pick<TabState, "id" | "name">[],
): Map<string, string> {
  const counts = new Map<string, number>();
  const names = new Map<string, string>();
  for (const tab of tabs) {
    const count = (counts.get(tab.name) ?? 0) + 1;
    counts.set(tab.name, count);
    names.set(tab.id, count === 1 ? tab.name : `${tab.name} (${count})`);
  }
  return names;
}
