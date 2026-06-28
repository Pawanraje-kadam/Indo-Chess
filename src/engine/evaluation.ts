import { Board, Piece, PieceColor, PieceType, Position, PIECE_VALUES } from './types';
import { isInBounds, isSquareAttacked } from './board';

// ── Piece-Square Tables (white POV, mirrored for black) ──────────────────────
export const PST: Record<PieceType, number[][]> = {
  pawn: [
    [  0,  0,  0,  0,  0,  0,  0,  0],
    [ 50, 50, 50, 50, 50, 50, 50, 50],
    [ 10, 10, 20, 30, 30, 20, 10, 10],
    [  5,  5, 10, 25, 25, 10,  5,  5],
    [  0,  0,  0, 20, 20,  0,  0,  0],
    [  5, -5,-10,  0,  0,-10, -5,  5],
    [  5, 10, 10,-20,-20, 10, 10,  5],
    [  0,  0,  0,  0,  0,  0,  0,  0],
  ],
  knight: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50],
  ],
  bishop: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20],
  ],
  rook: [
    [  0,  0,  0,  0,  0,  0,  0,  0],
    [  5, 10, 10, 10, 10, 10, 10,  5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [  0,  0,  0,  5,  5,  0,  0,  0],
  ],
  queen: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20],
  ],
  king: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20],
  ],
};

export const KING_ENDGAME_TABLE = [
  [-50,-40,-30,-20,-20,-30,-40,-50],
  [-30,-20,-10,  0,  0,-10,-20,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-30,  0,  0,  0,  0,-30,-30],
  [-50,-30,-30,-30,-30,-30,-30,-50],
];

// Passed pawn bonus by rank (rank 0 = pawn hasn't moved, rank 6 = one step from queening)
const PASSED_PAWN_BONUS = [0, 10, 20, 35, 55, 80, 120, 0];

export function getPSTValue(piece: Piece, row: number, col: number, isEndgame: boolean): number {
  const table = piece.type === 'king' && isEndgame ? KING_ENDGAME_TABLE : PST[piece.type];
  const r = piece.color === 'white' ? row : 7 - row;
  return table[r][col];
}

export function determineIsEndgame(board: Board): boolean {
  let queens = 0, minors = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (p.type === 'queen') queens++;
      if (p.type === 'rook' || p.type === 'bishop' || p.type === 'knight') minors++;
    }
  return queens === 0 || (queens <= 2 && minors <= 2);
}

// ── King safety: count enemy attackers in a ring around the king ─────────────
function kingAttackerCount(board: Board, kingRow: number, kingCol: number, enemyColor: PieceColor): number {
  let attackers = 0;
  // Check 5×5 zone around king
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = kingRow + dr, c = kingCol + dc;
      if (r < 0 || r > 7 || c < 0 || c > 7) continue;
      const p = board[r][c];
      if (p && p.color === enemyColor &&
          (p.type === 'queen' || p.type === 'rook' || p.type === 'bishop' || p.type === 'knight'))
        attackers++;
    }
  }
  return attackers;
}

// ── Pawn shield: pawns directly in front of king ─────────────────────────────
function pawnShieldScore(board: Board, kingRow: number, kingCol: number, color: PieceColor): number {
  const dir = color === 'white' ? -1 : 1;
  let shield = 0;
  for (let dc = -1; dc <= 1; dc++) {
    const c = kingCol + dc;
    if (c < 0 || c > 7) continue;
    const r = kingRow + dir;
    if (r < 0 || r > 7) continue;
    if (board[r][c]?.type === 'pawn' && board[r][c]?.color === color) shield += 15;
    // Two squares out
    const r2 = r + dir;
    if (r2 >= 0 && r2 <= 7 && board[r2][c]?.type === 'pawn' && board[r2][c]?.color === color) shield += 5;
  }
  return shield;
}

// ── Open file detection for rooks / king safety ───────────────────────────────
function isOpenFile(board: Board, col: number): boolean {
  for (let r = 0; r < 8; r++) if (board[r][col]?.type === 'pawn') return false;
  return true;
}

function isSemiOpenFile(board: Board, col: number, color: PieceColor): boolean {
  for (let r = 0; r < 8; r++) {
    const p = board[r][col];
    if (p?.type === 'pawn' && p.color === color) return false;
  }
  return true;
}

// ── Pawn structure ────────────────────────────────────────────────────────────
function evaluatePawns(board: Board, color: PieceColor): number {
  let score = 0;
  const enemy = color === 'white' ? 'black' : 'white';
  const pawns: number[][] = []; // [row, col]

  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === 'pawn' && board[r][c]?.color === color)
        pawns.push([r, c]);

  const fileCount = new Array(8).fill(0);
  for (const [, c] of pawns) fileCount[c]++;

  for (const [r, c] of pawns) {
    // Doubled pawns
    if (fileCount[c] > 1) score -= 15;

    // Isolated pawns
    const hasNeighbour = (c > 0 && fileCount[c - 1] > 0) || (c < 7 && fileCount[c + 1] > 0);
    if (!hasNeighbour) score -= 20;

    // Passed pawns — no enemy pawn on same or adjacent files ahead
    const rankDir = color === 'white' ? -1 : 1;
    let passed = true;
    for (let dr = rankDir; dr !== 0 && (r + dr >= 0) && (r + dr <= 7); dr += rankDir) {
      for (let dc = -1; dc <= 1; dc++) {
        const ec = c + dc;
        if (ec < 0 || ec > 7) continue;
        if (board[r + (dr)][ec]?.type === 'pawn' && board[r + (dr)][ec]?.color === enemy) {
          passed = false;
          break;
        }
      }
      if (!passed) break;
    }
    if (passed) {
      const rank = color === 'white' ? 7 - r : r;
      score += PASSED_PAWN_BONUS[rank];
    }
  }

  return score;
}

// ── Mobility: count pseudo-legal moves for sliding pieces ────────────────────
function mobilityScore(board: Board, color: PieceColor): number {
  let mobility = 0;
  const DIRS: Record<string, number[][]> = {
    bishop: [[-1,-1],[-1,1],[1,-1],[1,1]],
    rook:   [[-1,0],[1,0],[0,-1],[0,1]],
    queen:  [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]],
  };
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color) continue;
      const dirs = DIRS[p.type];
      if (!dirs) continue;
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
          mobility++;
          if (board[nr][nc]) break;
          nr += dr; nc += dc;
        }
      }
    }
  }
  return mobility * 2; // 2cp per available square
}

// ── Bishop pair ───────────────────────────────────────────────────────────────
function bishopPairBonus(board: Board, color: PieceColor): number {
  let bishops = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === 'bishop' && board[r][c]?.color === color) bishops++;
  return bishops >= 2 ? 30 : 0;
}

// ── Rook bonuses ──────────────────────────────────────────────────────────────
function rookBonus(board: Board, color: PieceColor): number {
  let score = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p?.type !== 'rook' || p.color !== color) continue;
      if (isOpenFile(board, c)) score += 20;
      else if (isSemiOpenFile(board, c, color)) score += 10;
    }
  return score;
}

// ── Full evaluation ───────────────────────────────────────────────────────────
export function evaluateRoot(board: Board, isEndgame: boolean): number {
  let score = 0;

  // Find kings
  let wKingRow = 7, wKingCol = 4, bKingRow = 0, bKingCol = 4;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p?.type === 'king') {
        if (p.color === 'white') { wKingRow = r; wKingCol = c; }
        else { bKingRow = r; bKingCol = c; }
      }
    }

  // Material + PST
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const sign = p.color === 'white' ? 1 : -1;
      score += sign * PIECE_VALUES[p.type];
      score += sign * getPSTValue(p, r, c, isEndgame);
    }

  // Pawn structure
  score += evaluatePawns(board, 'white');
  score -= evaluatePawns(board, 'black');

  // Mobility
  score += mobilityScore(board, 'white');
  score -= mobilityScore(board, 'black');

  // Bishop pair
  score += bishopPairBonus(board, 'white');
  score -= bishopPairBonus(board, 'black');

  // Rook on open/semi-open files
  score += rookBonus(board, 'white');
  score -= rookBonus(board, 'black');

  // King safety (skip in endgame — king becomes active)
  if (!isEndgame) {
    const wAttackers = kingAttackerCount(board, wKingRow, wKingCol, 'black');
    const bAttackers = kingAttackerCount(board, bKingRow, bKingCol, 'white');
    score -= wAttackers * 25; // each attacker near white king costs 25cp
    score += bAttackers * 25;
    score += pawnShieldScore(board, wKingRow, wKingCol, 'white');
    score -= pawnShieldScore(board, bKingRow, bKingCol, 'black');
  }

  return score;
}
