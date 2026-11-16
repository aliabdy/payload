import type { Environment } from "../types";

export interface ResolvedText {
  text: string;
  unresolved: string[];
}

export function resolveVariables(
  text: string,
  environment: Environment | null | undefined,
): ResolvedText {
  const unresolved: string[] = [];
  const values = new Map<string, string>();
  for (const variable of environment?.vars ?? []) {
    if (variable.enabled && variable.key) values.set(variable.key, variable.value);
  }
  const resolved = text.replace(
    /\{\{\s*([\w.-]+)\s*\}\}/g,
    (match, name: string) => {
      const value = values.get(name);
      if (value === undefined) {
        if (!unresolved.includes(name)) unresolved.push(name);
        return match;
      }
      return value;
    },
  );
  return { text: resolved, unresolved };
}

export function environmentLabel(
  environments: Environment[],
  activeEnvId: string | null,
): string {
  if (!activeEnvId) return "No environment";
  return environments.find((env) => env.id === activeEnvId)?.name ?? "No environment";
}
