import { toast } from "@ui-sdk/react/toast";
import type { RequestError } from "../types";

export { toast };

export function toastError(title: string, error?: unknown): void {
  const description =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String((error as RequestError).message)
          : undefined;
  toast.error({ title, description });
}

export function toastSuccess(
  title: string,
  description?: string,
  action?: { label: string; onAction: () => void },
): void {
  toast.success({ title, description, action });
}
