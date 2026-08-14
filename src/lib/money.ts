/**
 * All money math is done in integer pesewas (1 GHS = 100 pesewas) to avoid
 * floating-point rounding errors, then converted back to GHS for storage/display.
 * Prisma Decimal fields accept numbers/strings; we pass plain GHS numbers rounded to 2dp.
 */

export function toPesewas(ghs: number): number {
  return Math.round(ghs * 100);
}

export function fromPesewas(pesewas: number): number {
  return pesewas / 100;
}

export function roundGHS(ghs: number): number {
  return fromPesewas(toPesewas(ghs));
}

export function addGHS(...values: number[]): number {
  const totalPesewas = values.reduce((sum, v) => sum + toPesewas(v), 0);
  return fromPesewas(totalPesewas);
}

export function subtractGHS(a: number, b: number): number {
  return fromPesewas(toPesewas(a) - toPesewas(b));
}

export function multiplyGHS(ghs: number, factor: number): number {
  return fromPesewas(Math.round(toPesewas(ghs) * factor));
}

export function formatGHS(amount: number | string): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  const safe = Number.isFinite(value) ? value : 0;
  return `GH₵${safe.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  // Prisma.Decimal instance
  if (typeof (value as { toNumber?: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}
