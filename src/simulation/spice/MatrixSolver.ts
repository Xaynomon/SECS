/**
 * Linear system solver using Gaussian Elimination with partial pivoting.
 * Solves A * x = b for x.
 */
export class MatrixSolver {
  static solve(A: number[][], b: number[]): number[] {
    const n = A.length;
    if (n === 0) return [];

    // Clone A and b to avoid mutating inputs
    const M: number[][] = A.map((row) => [...row]);
    const x: number[] = [...b];

    for (let i = 0; i < n; i++) {
      // Find pivot row
      let maxRow = i;
      let maxVal = Math.abs(M[i][i]);
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > maxVal) {
          maxVal = Math.abs(M[k][i]);
          maxRow = k;
        }
      }

      // Swap rows
      if (maxRow !== i) {
        const tempRow = M[i];
        M[i] = M[maxRow];
        M[maxRow] = tempRow;

        const tempB = x[i];
        x[i] = x[maxRow];
        x[maxRow] = tempB;
      }

      // Numerical regularization if pivot is near zero (prevents zero division)
      if (Math.abs(M[i][i]) < 1e-12) {
        M[i][i] = 1e-9;
      }

      // Eliminate below
      for (let k = i + 1; k < n; k++) {
        const factor = M[k][i] / M[i][i];
        x[k] -= factor * x[i];
        for (let j = i; j < n; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }

    // Back-substitution
    const sol = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = x[i];
      for (let j = i + 1; j < n; j++) {
        sum -= M[i][j] * sol[j];
      }
      sol[i] = Math.abs(M[i][i]) > 1e-12 ? sum / M[i][i] : 0;
    }

    return sol;
  }
}
