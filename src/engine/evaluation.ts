import { Board, Piece, PieceColor, PieceType, Position, PIECE_VALUES } from './types';
import { isInBounds, isSquareAttacked, findKing } from './board';

/**
 * Piece-Square Tables (from white's perspective, rows 0-7 = ranks 8-1)
 * Values are centipawns bonus/penalty for piece placement
 */

const PAWN_TABLE = [
  [  0,  0,  0,  0,  0,  0,  0,  0],
  [ 50, 50, 50, 50, 50, 50, 50, 50],
  [ 10, 10, 20, 30, 30, 20, 10, 10],
  [  5,  5, 10, 25, 25, 10,  5,  5],
  [  0,  0,  0, 20, 20,  0,  0,  0],
  [  5, -5,-10,  0,  0,-10, -5,  5],
  [  5, 10, 10,-20,-20, 10, 10,  5],
  [  0,  0,  0,  0,  0,  0,  0,  0],
];

const KNIGHT_TABLE = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50],
];

const BISHOP_TABLE = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20],
];

const ROOK_TABLE = [
  [  0,  0,  0,  0,  0,  0,  0,  0],
  [  5, 10, 10, 10, 10, 10, 10,  5],
  [ -5,  0,  0,  0,  0,  0,  0, -5],
  [ -5,  0,  0,  0,  0,  0,  0, -5],
  [ -5,  0,  0,  0,  0,  0,  0, -5],
  [ -5,  0,  0,  0,  0,  0,  0, -5],
  [ -5,  0,  0,  0,  0,  0,  0, -5],
  [  0,  0,  0,  5,  5,  0,  0,  0],
];

const QUEEN_TABLE = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [ -5,  0,  5,  5,  5,  5,  0, -5],
  [  0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20],
];

const KING_MIDDLEGAME_TABLE = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [ 20, 20,  0,  0,  0,  0, 20, 20],
  [ 20, 30, 10,  0,  0, 10, 30, 20],
];

const KING_ENDGAME_TABLE = [
  [-50,-40,-30,-20,-20,-30,-40,-50],
  [-30,-20,-10,  0,  0,-10,-20,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 30, 40, 40, 30,-10,-30],
  [-30,-10, 20, 30, 30, 20,-10,-30],
  [-30,-30,  0,  0,  0,  0,-30,-30],
  [-50,-30,-30,-30,-30,-30,-30,-50],
];

const PST: Record<PieceType, number[][]> = {
  pawn: PAWN_TABLE,
  knight: KNIGHT_TABLE,
  bishop: BISHOP_TABLE,
  rook: ROOK_TABLE,
  queen: QUEEN_TABLE,
  king: KING_MIDDLEGAME_TABLE,
};

function getPSTValue(piece: Piece, row: number, col: number, isEndgame: boolean): number {
  const table = piece.type === 'king' && isEndgame ? KING_ENDGAME_TABLE : PST[piece.type];
  const r = piece.color === 'white' ? row : 7 - row;
  return table[r][col];
}

function isEndgame(board: Board): boolean {
  let queens = 0;
  let minors = 0;
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

/** Evaluate mobility (number of squares a piece can move to) */
function evaluateMobility(board: Board, color: PieceColor): number {
  let mobility = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== color || p.type === 'pawn' || p.type === 'king') continue;

      const dirs = getDirs(p.type);
      const sliding = p.type !== 'knight';

      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (isInBounds(nr, nc)) {
          const target = board[nr][nc];
          if (target) {
            if (target.color !== color) mobility++;
            break;
          }
          mobility++;
          if (!sliding) break;
          nr += dr; nc += dc;
        }
      }
    }
  }
  return mobility;
}

function getDirs(type: PieceType): number[][] {
  switch (type) {
    case 'knight': return [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    case 'bishop': return [[-1,-1],[-1,1],[1,-1],[1,1]];
    case 'rook': return [[-1,0],[1,0],[0,-1],[0,1]];
    case 'queen': return [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    default: return [];
  }
}

/** Evaluate pawn structure */
function evaluatePawnStructure(board: Board, color: PieceColor): number {
  let score = 0;
  const pawns: Position[] = [];
  const enemyPawns: Position[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]?.type === 'pawn') {
        if (board[r][c]!.color === color) pawns.push({ row: r, col: c });
        else enemyPawns.push({ row: r, col: c });
      }
    }
  }

  // Check for doubled pawns
  const fileCounts = new Array(8).fill(0);
  for (const p of pawns) fileCounts[p.col]++;
  for (let f = 0; f < 8; f++) {
    if (fileCounts[f] > 1) score -= 15 * (fileCounts[f] - 1);
  }

  // Isolated pawns
  for (let f = 0; f < 8; f++) {
    if (fileCounts[f] === 0) continue;
    const hasNeighbor = (f > 0 && fileCounts[f - 1] > 0) || (f < 7 && fileCounts[f + 1] > 0);
    if (!hasNeighbor) score -= 20;
  }

  // Passed pawns
  for (const p of pawns) {
    let passed = true;
  const promoRow = color === 'white' ? 0 : 7;

    for (const ep of enemyPawns) {
      if (Math.abs(ep.col - p.col) <= 1) {
        if (color === 'white' && ep.row < p.row) { passed = false; break; }
        if (color === 'black' && ep.row > p.row) { passed = false; break; }
      }
    }

    if (passed) {
      const distToPromo = Math.abs(p.row - promoRow);
      score += 20 + (7 - distToPromo) * 10;
    }
  }

  return score;
}

/** Evaluate king safety */
function evaluateKingSafety(board: Board, color: PieceColor, endgame: boolean): number {
  if (endgame) return 0;

  const kingPos = findKing(board, color);
  let safety = 0;

  // Pawn shield
  const dir = color === 'white' ? -1 : 1;
  for (let dc = -1; dc <= 1; dc++) {
    const r = kingPos.row + dir;
    const c = kingPos.col + dc;
    if (isInBounds(r, c) && board[r][c]?.type === 'pawn' && board[r][c]?.color === color) {
      safety += 10;
    }
  }

  // Penalty for open files near king
  for (let dc = -1; dc <= 1; dc++) {
    const c = kingPos.col + dc;
    if (c < 0 || c > 7) continue;
    let hasPawn = false;
    for (let r = 0; r < 8; r++) {
      if (board[r][c]?.type === 'pawn' && board[r][c]?.color === color) {
        hasPawn = true;
        break;
      }
    }
    if (!hasPawn) safety -= 15;
  }

  return safety;
}

/** Center control evaluation */
function evaluateCenterControl(board: Board, color: PieceColor): number {
  let score = 0;
  const centerSquares: Position[] = [
    { row: 3, col: 3 }, { row: 3, col: 4 },
    { row: 4, col: 3 }, { row: 4, col: 4 },
  ];
  const extendedCenter: Position[] = [
    { row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }, { row: 2, col: 5 },
    { row: 3, col: 2 }, { row: 3, col: 5 },
    { row: 4, col: 2 }, { row: 4, col: 5 },
    { row: 5, col: 2 }, { row: 5, col: 3 }, { row: 5, col: 4 }, { row: 5, col: 5 },
  ];

  for (const sq of centerSquares) {
    const p = board[sq.row][sq.col];
    if (p && p.color === color) score += 10;
    if (isSquareAttacked(board, sq, color)) score += 5;
  }

  for (const sq of extendedCenter) {
    if (isSquareAttacked(board, sq, color)) score += 2;
  }

  return score;
}

/** Full board evaluation from white's perspective */
export function evaluate(board: Board): number {
  let score = 0;
  const endgameFlag = isEndgame(board);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const sign = p.color === 'white' ? 1 : -1;
      score += sign * PIECE_VALUES[p.type];
      score += sign * getPSTValue(p, r, c, endgameFlag);
    }
  }

  // Mobility
  score += evaluateMobility(board, 'white') * 3;
  score -= evaluateMobility(board, 'black') * 3;

  // Pawn structure
  score += evaluatePawnStructure(board, 'white');
  score -= evaluatePawnStructure(board, 'black');

  // King safety
  score += evaluateKingSafety(board, 'white', endgameFlag);
  score -= evaluateKingSafety(board, 'black', endgameFlag);

  // Center control
  score += evaluateCenterControl(board, 'white');
  score -= evaluateCenterControl(board, 'black');

  // Bishop pair bonus
  let whiteBishops = 0, blackBishops = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]?.type === 'bishop') {
        if (board[r][c]!.color === 'white') whiteBishops++;
        else blackBishops++;
      }
    }
  }
  if (whiteBishops >= 2) score += 30;
  if (blackBishops >= 2) score -= 30;

  return score;
}
