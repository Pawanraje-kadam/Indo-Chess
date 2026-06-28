import { Board, Piece, PieceColor, PieceType, Position, PIECE_VALUES } from './types';
import { isInBounds, isSquareAttacked } from './board';

// --- Piece-Square Tables (Maintained) ---
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
  ]
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

export function getPSTValue(piece: Piece, row: number, col: number, isEndgame: boolean): number {
  const table = piece.type === 'king' && isEndgame ? KING_ENDGAME_TABLE : PST[piece.type];
  const r = piece.color === 'white' ? row : 7 - row;
  return table[r][col];
}

export function determineIsEndgame(board: Board): boolean {
  let queens = 0, minors = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (p.type === 'queen') queens++;
      if (p.type === 'rook' || p.type === 'bishop' || p.type === 'knight') minors++;
    }
  }
  return queens === 0 || (queens <= 2 && minors <= 2);
}

/** * Comprehensive Deep Positional Evaluation
 * Executed ONLY at the root node to establish a high-IQ baseline score
 */
export function evaluateRoot(board: Board, isEndgame: boolean): number {
  let score = 0;
  
  // Positional tracking matrices
  const wPawnCols = new Array(8).fill(0);
  const bPawnCols = new Array(8).fill(0);
  const wPawnRows = new Array(8).fill(9); // track highest row for passed pawns
  const bPawnRows = new Array(8).fill(-1); // track lowest row for passed pawns
  
  let wBishops = 0, bBishops = 0;
  let wKingRow = 7, wKingCol = 4;
  let bKingRow = 0, bKingCol = 4;

  // Single-pass data collection loop
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;

      const sign = p.color === 'white' ? 1 : -1;
      
      // 1. Core Material and PST bonuses
      score += sign * PIECE_VALUES[p.type];
      score += sign * getPSTValue(p, r, c, isEndgame);

      // Structure mapping accumulation
      if (p.type === 'pawn') {
        if (p.color === 'white') {
          wPawnCols[c]++;
          if (r < wPawnRows[c]) wPawnRows[c] = r;
        } else {
          bPawnCols[c]++;
          if (r > bPawnRows[c]) bPawnRows[c] = r;
        }
      } else if (p.type === 'bishop') {
        if (p.color === 'white') wBishops++; else bBishops++;
      } else if (p.type === 'king') {
        if (p.color === 'white') { wKingRow = r; wKingCol = c; }
        else { bKingRow = r; bKingCol = c; }
      }
      
      // 2. Rook on Open/Semi-Open Files positional bonuses
      if (p.type === 'rook') {
        const hasFriendlyPawns = p.color === 'white' ? wPawnCols[c] > 0 : bPawnCols[c] > 0;
        const hasEnemyPawns = p.color === 'white' ? bPawnCols[c] > 0 : wPawnCols[c] > 0;
        
        if (!hasFriendlyPawns && !hasEnemyPawns) {
          score += sign * 15; // Fully open file bonus
        } else if (!hasFriendlyPawns && hasEnemyPawns) {
          score += sign * 8;  // Semi-open file bonus
        }
      }
    }
  }

  // 3. Synergistic Bishop Pair Bonus
  if (wBishops >= 2) score += 30;
  if (bBishops >= 2) score -= 30;

  // 4. Strategic Pawn Structure Scoring (Doubled & Isolated Pawns)
  for (let c = 0; c < 8; c++) {
    // White Pawn evaluation
    if (wPawnCols[c] > 0) {
      if (wPawnCols[c] > 1) score -= 15; // Doubled pawns penalty
      const hasNeighbors = (c > 0 && wPawnCols[c - 1] > 0) || (c < 7 && wPawnCols[c + 1] > 0);
      if (!hasNeighbors) score -= 20;   // Isolated pawn penalty
    }
    // Black Pawn evaluation
    if (bPawnCols[c] > 0) {
      if (bPawnCols[c] > 1) score += 15; // Doubled pawns penalty
      const hasNeighbors = (c > 0 && bPawnCols[c - 1] > 0) || (c < 7 && bPawnCols[c + 1] > 0);
      if (!hasNeighbors) score += 20;   // Isolated pawn penalty
    }
  }

  // 5. Advanced Passed Pawn Calculation
  for (let c = 0; c < 8; c++) {
    // White Passed Pawns
    if (wPawnRows[c] < 9) {
      const targetRow = wPawnRows[c];
      let isPassed = true;
      // Check files immediately ahead and adjacent for blocking enemy pawns
      for (let file = Math.max(0, c - 1); file <= Math.min(7, c + 1); file++) {
        if (bPawnRows[file] !== -1 && bPawnRows[file] <= targetRow) {
          isPassed = false;
          break;
        }
      }
      if (isPassed) {
        const rankBonus = (7 - targetRow) * 10; // More points the closer it gets to promotion
        score += 25 + rankBonus;
      }
    }

    // Black Passed Pawns
    if (bPawnRows[c] > -1) {
      const targetRow = bPawnRows[c];
      let isPassed = true;
      for (let file = Math.max(0, c - 1); file <= Math.min(7, c + 1); file++) {
        if (wPawnRows[file] !== 9 && wPawnRows[file] >= targetRow) {
          isPassed = false;
          break;
        }
      }
      if (isPassed) {
        const rankBonus = targetRow * 10;
        score -= (25 + rankBonus);
      }
    }
  }

  // 6. Dynamic Middlegame King Safety Shield
  if (!isEndgame) {
    // White King Shield
    const wShieldDir = -1;
    for (let dc = -1; dc <= 1; dc++) {
      const shieldRow = wKingRow + wShieldDir;
      const shieldCol = wKingCol + dc;
      if (isInBounds(shieldRow, shieldCol) && board[shieldRow][shieldCol]?.type === 'pawn' && board[shieldRow][shieldCol]?.color === 'white') {
        score += 10;
      }
    }
    // Black King Shield
    const bShieldDir = 1;
    for (let dc = -1; dc <= 1; dc++) {
      const shieldRow = bKingRow + bShieldDir;
      const shieldCol = bKingCol + dc;
      if (isInBounds(shieldRow, shieldCol) && board[shieldRow][shieldCol]?.type === 'pawn' && board[shieldRow][shieldCol]?.color === 'black') {
        score -= 10;
      }
    }
  }

  return score;
}
