import { useCallback, useSyncExternalStore } from "react";
import {
  ACCENTS,
  type AccentColor,
  type ResolvedTheme,
  type ThemePreference,
} from "../types";

const THEME_KEY = "payload-theme";
const ACCENT_KEY = "payload-accent";

export const ACCENT_OPTIONS: {
  id: AccentColor;
  label: string;
  color: Record<ResolvedTheme, string>;
}[] = [
  { id: "teal", label: "Teal", color: { dark: "#5eead4", light: "#0f766e" } },
  { id: "blue", label: "Blue", color: { dark: "#60a5fa", light: "#1d4ed8" } },
  { id: "indigo", label: "Indigo", color: { dark: "#a5b4fc", light: "#4338ca" } },
  { id: "violet", label: "Violet", color: { dark: "#c4b5fd", light: "#6d28d9" } },
  { id: "amber", label: "Amber", color: { dark: "#fcd34d", light: "#92400e" } },
  { id: "rose", label: "Rose", color: { dark: "#fda4af", light: "#be123c" } },
];

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function applyAppearance(
  theme: ThemePreference,
  accent: AccentColor,
): void {
  document.documentElement.dataset.theme = resolveTheme(theme);
  document.documentElement.dataset.accent = accent;
  localStorage.setItem(THEME_KEY, theme);
  localStorage.setItem(ACCENT_KEY, accent);
}

export function restoreCachedAppearance(): void {
  const cachedTheme = localStorage.getItem(THEME_KEY);
  const theme: ThemePreference =
    cachedTheme === "light" || cachedTheme === "system" ? cachedTheme : "dark";
  const cachedAccent = localStorage.getItem(ACCENT_KEY);
  applyAppearance(
    theme,
    ACCENTS.includes(cachedAccent as AccentColor)
      ? (cachedAccent as AccentColor)
      : "teal",
  );
}

export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useResolvedTheme(preference: ThemePreference): ResolvedTheme {
  const subscribe = useCallback((onChange: () => void) => {
    return watchSystemTheme(onChange);
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => resolveTheme(preference),
    () => resolveTheme(preference),
  );
}
