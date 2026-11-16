import type { Method } from "../../types";
import { methodClass } from "../../lib/format";

export function MethodBadge({ method }: { method: Method | string }) {
  return <span className={methodClass(method)}>{method}</span>;
}
