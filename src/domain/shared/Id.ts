export function toNumberId(value: bigint | number): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

export function toBigIntId(value: number): bigint {
  return BigInt(value);
}
