import { GameState, Move, Difficulty, PieceColor, PIECE_VALUES } from './types';
import { generateLegalMoves, makeMove, isInCheck } from './board';
import { evaluate } from './evaluation';

const INFINITY = 999999;
const MATE_SCORE = 100000;

/** Zobrist-style transposition table */
interface TTEntry {
  depth: number;
  score: number;
  flag: 'exact' | 'alpha' | 'beta';
  bestMove?: Move;
}

const transpositionTable = new Map<string, TTEntry>();

function boardKey(state: GameState): string {
  let key = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p) {
        key += `${r}${c}${p.type[0]}${p.color[0]}`;
      }
    }
  }
  key += state.turn[0];
  key += state.castlingRights.whiteKingside ? '1' : '0';
  key += state.castlingRights.whiteQueenside ? '1' : '0';
  key += state.castlingRights.blackKingside ? '1' : '0';
  key += state.castlingRights.blackQueenside ? '1' : '0';
  if (state.enPassantTarget) {
    key += `e${state.enPassantTarget.row}${state.enPassantTarget.col}`;
  }
  return key;
}

/** Move ordering for alpha-beta efficiency */
function orderMoves(moves: Move[], _state: GameState, ttBestMove?: Move): Move[] {
  return moves.sort((a, b) => {
    let scoreA = 0, scoreB = 0;

    // TT best move first
    if (ttBestMove) {
      if (a.from.row === ttBestMove.from.row && a.from.col === ttBestMove.from.col &&
          a.to.row === ttBestMove.to.row && a.to.col === ttBestMove.to.col) scoreA += 10000;
      if (b.from.row === ttBestMove.from.row && b.from.col === ttBestMove.from.col &&
          b.to.row === ttBestMove.to.row && b.to.col === ttBestMove.to.col) scoreB += 10000;
    }

    // Captures: MVV-LVA
    if (a.captured) scoreA += PIECE_VALUES[a.captured.type] - PIECE_VALUES[a.piece.type] / 10 + 5000;
    if (b.captured) scoreB += PIECE_VALUES[b.captured.type] - PIECE_VALUES[b.piece.type] / 10 + 5000;

    // Promotions
    if (a.promotion) scoreA += PIECE_VALUES[a.promotion] + 4000;
    if (b.promotion) scoreB += PIECE_VALUES[b.promotion] + 4000;

    // Checks
    if (a.isCheck) scoreA += 3000;
    if (b.isCheck) scoreB += 3000;

    // Castling
    if (a.isCastle) scoreA += 500;
    if (b.isCastle) scoreB += 500;

    return scoreB - scoreA;
  });
}

/** Quiescence search to avoid horizon effect */
function quiescence(state: GameState, alpha: number, beta: number, color: PieceColor): number {
  const standPat = evaluate(state.board) * (color === 'white' ? 1 : -1);

  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  const moves = generateLegalMoves(state, color);
  const captureMoves = moves.filter(m => m.captured || m.promotion);

  const sorted = orderMoves(captureMoves, state);

  for (const move of sorted) {
    const newState = makeMove(state, move);
    const score = -quiescence(newState, -beta, -alpha, color === 'white' ? 'black' : 'white');

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

/** Alpha-beta search with transposition table */
function alphaBeta(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  color: PieceColor,
  nodeCount: { count: number },
): number {
  nodeCount.count++;

  // Transposition table lookup
  const key = boardKey(state);
  const ttEntry = transpositionTable.get(key);
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === 'exact') return ttEntry.score;
    if (ttEntry.flag === 'alpha' && ttEntry.score <= alpha) return alpha;
    if (ttEntry.flag === 'beta' && ttEntry.score >= beta) return beta;
  }

  if (depth <= 0) {
    return quiescence(state, alpha, beta, color);
  }

  const moves = generateLegalMoves(state, color);

  if (moves.length === 0) {
    if (isInCheck(state.board, color)) {
      return -(MATE_SCORE + depth);
    }
    return 0; // Stalemate
  }

  const sorted = orderMoves(moves, state, ttEntry?.bestMove);

  let bestScore = -INFINITY;
  let bestMove: Move | undefined;
  let flag: 'exact' | 'alpha' | 'beta' = 'alpha';

  for (const move of sorted) {
    const newState = makeMove(state, move);
    const score = -alphaBeta(
      newState, depth - 1, -beta, -alpha,
      color === 'white' ? 'black' : 'white',
      nodeCount
    );

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }

    if (score > alpha) {
      alpha = score;
      flag = 'exact';
    }

    if (alpha >= beta) {
      flag = 'beta';
      break;
    }
  }

  // Store in transposition table
  if (transpositionTable.size > 100000) {
    transpositionTable.clear();
  }
  transpositionTable.set(key, { depth, score: bestScore, flag, bestMove });

  return bestScore;
}

/** Depth settings per difficulty */
const DIFFICULTY_DEPTH: Record<Difficulty, number> = {
  beginner: 2,
  intermediate: 3,
  advanced: 4,
  master: 5,
};

/** Add randomness based on difficulty */
function addRandomness(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'beginner': return Math.random() * 200 - 100;
    case 'intermediate': return Math.random() * 60 - 30;
    case 'advanced': return Math.random() * 20 - 10;
    case 'master': return 0;
  }
}

/** Simple opening book support */

function getBookMove(state: GameState): Move | null {
  if (state.moveHistory.length > 10) return null;

  const moves = generateLegalMoves(state);

  // Opening principles: control center, develop pieces
  if (state.moveHistory.length === 0) {
    const openings = moves.filter(m =>
      (m.piece.type === 'pawn' && (m.to.col === 3 || m.to.col === 4) && Math.abs(m.from.row - m.to.row) === 2) ||
      (m.piece.type === 'knight' && (m.to.row === 5 || m.to.row === 2))
    );
    if (openings.length > 0) {
      return openings[Math.floor(Math.random() * openings.length)];
    }
  }

  if (state.moveHistory.length <= 6) {
    // Prioritize development
    const devMoves = moves.filter(m =>
      (m.piece.type === 'knight' || m.piece.type === 'bishop') &&
      ((m.piece.color === 'white' && m.from.row >= 6) || (m.piece.color === 'black' && m.from.row <= 1))
    );
    if (devMoves.length > 0 && Math.random() > 0.3) {
      return devMoves[Math.floor(Math.random() * devMoves.length)];
    }
  }

  return null;
}

/** Main AI function: find best move using iterative deepening */
export function findBestMove(state: GameState, difficulty: Difficulty): Move | null {
  const moves = generateLegalMoves(state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  // Try opening book for beginner/intermediate
  if (difficulty !== 'master') {
    const bookMove = getBookMove(state);
    if (bookMove) return bookMove;
  }

  const maxDepth = DIFFICULTY_DEPTH[difficulty];
  let bestMove: Move = moves[0];
  const nodeCount = { count: 0 };

  // Iterative deepening
  for (let depth = 1; depth <= maxDepth; depth++) {
    let currentBest = moves[0];
    let currentBestScore = -INFINITY;

    for (const move of orderMoves([...moves], state)) {
      const newState = makeMove(state, move);
      const score = -alphaBeta(
        newState, depth - 1, -INFINITY, INFINITY,
        state.turn === 'white' ? 'black' : 'white',
        nodeCount
      ) + addRandomness(difficulty);

      if (score > currentBestScore) {
        currentBestScore = score;
        currentBest = move;
      }
    }

    bestMove = currentBest;
  }

  return bestMove;
}

/** Evaluate position for the eval bar */
export function evaluatePosition(state: GameState): number {
  const rawEval = evaluate(state.board);
  // Convert centipawns to pawns, capped
  return Math.max(-10, Math.min(10, rawEval / 100));
}
