export const PLANS = [
  { id: "starter", name: "Starter", price: 97, credits: 100, maxSeconds: 90 },
  { id: "creator", name: "Creator", price: 197, credits: 250, maxSeconds: 600 },
  { id: "pro", name: "Pro", price: 397, credits: 600, maxSeconds: 600 },
  { id: "agency", name: "Agency", price: 797, credits: 1400, maxSeconds: 600 },
] as const;
export const TRIAL_SECONDS = 90;
export const VIDEO_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;
export const PAYMENT_WINDOW_MS = 10 * 60 * 1000;
export function creditCost(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 600) throw new Error("Duração permitida: 1 a 600 segundos.");
  return seconds <= 30 ? 10 : seconds <= 60 ? 15 : seconds <= 90 ? 20 : seconds <= 180 ? 30 : seconds <= 300 ? 50 : 100;
}
export function planFor(id: string) { return PLANS.find((p) => p.id === id); }