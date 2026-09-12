/**
 * Max-weight bipartite assignment (Hungarian / Kuhn–Munkres).
 * Typical receipt matrices are tiny (≤ ~40 lines), so O(n³) is fine.
 */

const hungarian = (cost: number[][]): number[] => {
  const n = cost.length;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0);
  const way = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Number.POSITIVE_INFINITY;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const assignment = new Array<number>(n).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j] !== 0) assignment[p[j] - 1] = j - 1;
  }
  return assignment;
};

export type WeightedMatch = { row: number; col: number; score: number };

export const assignMaxWeight = (scores: number[][], minScore: number): WeightedMatch[] => {
  const rows = scores.length;
  const cols = scores[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return [];

  const dim = Math.max(rows, cols);
  let maxScore = 0;
  for (const row of scores) {
    for (const value of row) {
      if (value > maxScore) maxScore = value;
    }
  }
  const blocked = maxScore + 1;
  const cost = Array.from({ length: dim }, (_, i) =>
    Array.from({ length: dim }, (_, j) => {
      const score = i < rows && j < cols ? scores[i][j] : 0;
      return score >= minScore ? maxScore - score : blocked;
    })
  );

  const assigned = hungarian(cost);
  const matches: WeightedMatch[] = [];
  for (let row = 0; row < rows; row++) {
    const col = assigned[row];
    if (col < 0 || col >= cols) continue;
    const score = scores[row][col];
    if (score >= minScore) matches.push({ row, col, score });
  }
  return matches;
};
