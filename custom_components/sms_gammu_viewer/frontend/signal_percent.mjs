export function signalPercent(value, fallback = 0) {
  if (value == null || typeof value === "boolean" || !["string", "number"].includes(typeof value)) return fallback;
  if (typeof value === "string" && !value.trim()) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : fallback;
}
