// contracts.ts — contract verification infrastructure (generated from TaskManager.vdmsl)

/** Contract violation error / 契約違反エラー */
export class ContractError extends Error {
  constructor(message: string) {
    super(`[Contract Violation] ${message}`);
    this.name = 'ContractError';
  }
}

/**
 * 契約チェックの有効/無効（環境変数で制御）。既定は有効。
 * VDM_CONTRACT_CHECK=off で、事前条件・事後条件・状態不変条件のチェックだけが無効になる
 * （ファクトリ関数 mkT の型不変条件は常に有効）。
 */
export function contractsEnabled(): boolean {
  return process.env.VDM_CONTRACT_CHECK !== 'off';
}

/** アサーション */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new ContractError(message);
  }
}

/**
 * Structural equality for VDM values (VDM-SL `=` on records, sequences, sets and maps).
 * JavaScript `===` compares object identity, so never use it for these.
 */
export function vdmEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length
      && a.every((x, i) => vdmEquals(x, b[i]));
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) return false;
    const entries = [...b];
    for (const [k, v] of a) {
      const hit = entries.find(([k2]) => vdmEquals(k, k2));
      if (hit === undefined || !vdmEquals(v, hit[1])) return false;
    }
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set && b instanceof Set) || a.size !== b.size) return false;
    const members = [...b];
    return [...a].every(x => members.some(y => vdmEquals(x, y)));
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = Object.keys(ra);
  return keys.length === Object.keys(rb).length
    && keys.every(k => Object.prototype.hasOwnProperty.call(rb, k) && vdmEquals(ra[k], rb[k]));
}
