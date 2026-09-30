// ============================================================================
// VERHOEFF DIHEDRAL GROUP D5 ALGORITHM
// Non-commutative Dihedral Group Checksum Engine for ABHA 2.0 Identity Verification
// Standards: Catches 100% of single-digit errors & 100% of adjacent transpositions
// References: Jacobus Verhoeff (1969) · NHA ABDM Specification
// ============================================================================

export class VerhoeffD5 {
  // Multiplication table d[j][k] in Dihedral Group D5
  private static readonly d: number[][] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
  ];

  // Permutation table p[pos % 8][digit]
  private static readonly p: number[][] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
  ];

  // Inverse table inv[c]
  private static readonly inv: number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

  /**
   * Calculates the Verhoeff check digit for a given numerical string.
   */
  public static calculateChecksum(numStr: string): number {
    const clean = numStr.replace(/\D/g, '');
    let c = 0;
    const len = clean.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(clean[len - 1 - i], 10);
      c = this.d[c][this.p[(i + 1) % 8][digit]];
    }
    return this.inv[c];
  }

  /**
   * Validates whether a full numerical string (including checksum) satisfies D5 identity.
   */
  public static validate(numStr: string): boolean {
    const clean = numStr.replace(/\D/g, '');
    if (clean.length === 0) return false;
    let c = 0;
    const len = clean.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(clean[len - 1 - i], 10);
      c = this.d[c][this.p[i % 8][digit]];
    }
    return c === 0;
  }

  /**
   * Generates a complete Verhoeff-protected 14-digit ABHA string from a 13-digit base.
   */
  public static generateProtectedAbha(base13Str: string): string {
    const clean = base13Str.replace(/\D/g, '');
    const checksum = this.calculateChecksum(clean);
    return `${clean}${checksum}`;
  }
}
