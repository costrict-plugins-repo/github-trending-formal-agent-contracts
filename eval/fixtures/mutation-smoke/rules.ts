export function isPositive(value: number): boolean {
  return value > 0;
}

// Deliberately untested branch: a surviving mutant is expected here.
export function unusedIncrement(value: number): number {
  return value + 1;
}
