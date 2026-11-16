export function isRequestUrlReady(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return /^https?:\/\//i.test(trimmed) || trimmed.includes("{{");
}
