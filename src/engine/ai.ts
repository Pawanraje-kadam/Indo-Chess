import { GameState, Move, Difficulty, PieceColor, PIECE_VALUES, PieceType, CastlingRights } from './types';
import { generateLegalMoves, generateLegalCaptures, makeMoveMutating, unmakeMove, isInCheck } from './board';
import { PST, getPSTValue, evaluateRoot, determineIsEndgame } from './evaluation';

const INFINITY = 999999;
const MATE_SCORE = 100000;
const MAX_SEARCH_DEPTH = 32; // We now bound by TIME, not depth

export interface SearchTelemetry {
  totalTimeMs: number;
  nodesSearched: number;
  qNodesSearched: number;
  nps: number;
  ttHits: number;
  ttMisses: number;
  moveGenTimeMs: number;
  makeMoveTimeMs: number;
  evalTimeMs: number;
  hashTimeMs: number;
  sortTimeMs: number;
  // --- Time Manager State ---
  startTime: number;
  timeLimit: number;
  abort: boolean;
}

// --- Zobrist Hashing Setup ---
function randomBigInt(): bigint {
  const low = BigInt(Math.floor(Math.random() * 0xFFFFFFFF));
  const high = BigInt(Math.floor(Math.random() * 0xFFFFFFFF));
  return (high << 32n) | low;
}

const ZOBRIST = {
  pieces: { white: {} as Record<PieceType, bigint[][]>, black: {} as Record<PieceType, bigint[][]> },
  turn: randomBigInt(),
  castling: Array.from({ length: 16 }, randomBigInt),
  ep: Array.from({ length: 8 }, randomBigInt)
};

const pieceTypes: PieceType[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
for (const c of ['white', 'black'] as PieceColor[]) {
  for (const t of pieceTypes) {
    ZOBRIST.pieces[c][t] = Array.from({ length: 8 }, () => Array.from({ length: 8 }, randomBigInt));
  }
}

function getCastlingIndex(cr: CastlingRights): number {
  return (cr.whiteKingside ? 1 : 0) | (cr.whiteQueenside ? 2 : 0) | (cr.blackKingside ? 4 : 0) | (cr.blackQueenside ? 8 : 0);
}

function computeBaseZobristHash(state: GameState): bigint {
  let h = 0n;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p) h ^= ZOBRIST.pieces[p.color][p.type][r][c];
    }
  }
  if (state.turn === 'black') h ^= ZOBRIST.turn;
  h ^= ZOBRIST.castling[getCastlingIndex(state.castlingRights)];
  if (state.enPassantTarget) h ^= ZOBRIST.ep[state.enPassantTarget.col];
  return h;
}

// --- Transposition Table ---
const TT_SIZE = 1 << 20; 
const TT_MASK = BigInt(TT_SIZE - 1);

interface TTEntry {
  key: bigint;
  depth: number;
  score: number;
  flag: 'exact' | 'alpha' | 'beta';
  bestMove?: Move;
}

const transpositionTable: (TTEntry | null)[] = new Array(TT_SIZE).fill(null);

// --- Move Ordering Tables (Killer Moves) ---
const killerMoves: (Move | null)[][] = Array.from({ length: MAX_SEARCH_DEPTH }, () => [null, null]);

function saveKillerMove(move: Move, depth: number) {
  if (depth >= MAX_SEARCH_DEPTH || move.captured) return;
  if (killerMoves[depth][0] && isSameMove(killerMoves[depth][0], move)) return;
  killerMoves[depth][1] = killerMoves[depth][0];
  killerMoves[depth][0] = move;
}

function isSameMove(a: Move, b: Move): boolean {
  return a.from.row === b.from.row && a.from.col === b.from.col &&
         a.to.row === b.to.row && a.to.col === b.to.col;
}

// --- Incremental Math Core ---
function applyDeltas(move: Move, hash: bigint, score: number, isEndgame: boolean, state: GameState, preCastling: number, preEp: Position | null): { newHash: bigint, newScore: number } {
  let newHash = hash ^ ZOBRIST.turn;
  let newScore = score;
  
  const color = move.piece.color;
  const enemyColor = color === 'white' ? 'black' : 'white';
  const sign = color === 'white' ? 1 : -1;

  newHash ^= ZOBRIST.pieces[color][move.piece.type][move.from.row][move.from.col];
  newScore -= sign * getPSTValue(move.piece, move.from.row, move.from.col, isEndgame);

  const destType = move.promotion || move.piece.type;
  newHash ^= ZOBRIST.pieces[color][destType][move.to.row][move.to.col];
  newScore += sign * getPSTValue({ type: destType, color }, move.to.row, move.to.col, isEndgame);
  if (move.promotion) {
    newScore += sign * (PIECE_VALUES[move.promotion] - PIECE_VALUES['pawn']);
  }

  if (move.captured) {
    const capRow = move.isEnPassant ? move.from.row : move.to.row;
    const capCol = move.to.col;
    newHash ^= ZOBRIST.pieces[enemyColor][move.captured.type][capRow][capCol];
    newScore -= (-sign) * getPSTValue({ type: move.captured.type, color: enemyColor }, capRow, capCol, isEndgame);
    newScore += sign * PIECE_VALUES[move.captured.type];
  }

  if (move.isCastle) {
    const rRow = move.from.row;
    const rFromCol = move.isKingsideCastle ? 7 : 0;
    const rToCol = move.isKingsideCastle ? 5 : 3;
    newHash ^= ZOBRIST.pieces[color]['rook'][rRow][rFromCol];
    newHash ^= ZOBRIST.pieces[color]['rook'][rRow][rToCol];
    newScore -= sign * getPSTValue({ type: 'rook', color }, rRow, rFromCol, isEndgame);
    newScore += sign * getPSTValue({ type: 'rook', color }, rRow, rToCol, isEndgame);
  }

  newHash ^= ZOBRIST.castling[preCastling] ^ ZOBRIST.castling[getCastlingIndex(state.castlingRights)];
  if (preEp) newHash ^= ZOBRIST.ep[preEp.col];
  if (state.enPassantTarget) newHash ^= ZOBRIST.ep[state.enPassantTarget.col];

  return { newHash, newScore };
}

function orderMoves(moves: Move[], depth: number, telemetry: SearchTelemetry, ttBestMove?: Move): Move[] {
  const t0 = performance.now();
  
  const km1 = killerMoves[depth]?.[0];
  const km2 = killerMoves[depth]?.[1];

  moves.sort((a, b) => {
    let scoreA = 0, scoreB = 0;

    if (ttBestMove) {
      if (isSameMove(a, ttBestMove)) scoreA += 30000;
      if (isSameMove(b, ttBestMove)) scoreB += 30000;
    }
    
    if (a.captured) scoreA += PIECE_VALUES[a.captured.type] - PIECE_VALUES[a.piece.type] / 10 + 20000;
    if (b.captured) scoreB += PIECE_VALUES[b.captured.type] - PIECE_VALUES[b.piece.type] / 10 + 20000;
    if (a.promotion) scoreA += PIECE_VALUES[a.promotion] + 15000;
    if (b.promotion) scoreB += PIECE_VALUES[b.promotion] + 15000;

    if (!a.captured) {
      if (km1 && isSameMove(a, km1)) scoreA += 10000;
      else if (km2 && isSameMove(a, km2)) scoreA += 9000;
    }
    if (!b.captured) {
      if (km1 && isSameMove(b, km1)) scoreB += 10000;
      else if (km2 && isSameMove(b, km2)) scoreB += 9000;
    }

    if (a.isCheck) scoreA += 5000;
    if (b.isCheck) scoreB += 5000;

    return scoreB - scoreA;
  });

  telemetry.sortTimeMs += performance.now() - t0;
  return moves;
}

// --- Time Manager Check ---
function checkTime(telemetry: SearchTelemetry) {
  // Check the clock every 2048 nodes to avoid slowing down the engine
  if ((telemetry.nodesSearched + telemetry.qNodesSearched) % 2048 === 0) {
    if (performance.now() - telemetry.startTime >= telemetry.timeLimit) {
      telemetry.abort = true;
    }
  }
}

// --- Quiescence Search ---
function quiescence(state: GameState, alpha: number, beta: number, color: PieceColor, telemetry: SearchTelemetry, hash: bigint, evalScore: number, isEndgame: boolean): number {
  checkTime(telemetry);
  if (telemetry.abort) return 0; // Bail out instantly

  telemetry.qNodesSearched++;

  const standPat = evalScore * (color === 'white' ? 1 : -1);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  const mg0 = performance.now();
  const captureMoves = generateLegalCaptures(state, color);
  telemetry.moveGenTimeMs += performance.now() - mg0;

  const sorted = orderMoves(captureMoves, 0, telemetry);

  for (const move of sorted) {
    const preCastling = getCastlingIndex(state.castlingRights);
    const preEp = state.enPassantTarget;

    const mm0 = performance.now();
    const undo = makeMoveMutating(state, move);
    telemetry.makeMoveTimeMs += performance.now() - mm0;

    const { newHash, newScore } = applyDeltas(move, hash, evalScore, isEndgame, state, preCastling, preEp);
    const score = -quiescence(state, -beta, -alpha, color === 'white' ? 'black' : 'white', telemetry, newHash, newScore, isEndgame);

    const um0 = performance.now();
    unmakeMove(state, move, undo);
    telemetry.makeMoveTimeMs += performance.now() - um0;

    if (telemetry.abort) return 0;

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

// --- Main AlphaBeta Search Loop ---
function alphaBeta(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  color: PieceColor,
  telemetry: SearchTelemetry,
  hash: bigint,
  evalScore: number,
  isEndgame: boolean,
  currentPly: number
): number {
  checkTime(telemetry);
  if (telemetry.abort) return 0; // Bail out instantly

  telemetry.nodesSearched++;

  const h0 = performance.now();
  const ttIndex = Number(hash & TT_MASK);
  const ttEntry = transpositionTable[ttIndex];
  telemetry.hashTimeMs += performance.now() - h0;

  if (ttEntry && ttEntry.key === hash && ttEntry.depth >= depth) {
    telemetry.ttHits++;
    if (ttEntry.flag === 'exact') return ttEntry.score;
    if (ttEntry.flag === 'alpha' && ttEntry.score <= alpha) return ttEntry.score;
    if (ttEntry.flag === 'beta' && ttEntry.score >= beta) return ttEntry.score;
  } else {
    telemetry.ttMisses++;
  }

  if (depth <= 0) {
    return quiescence(state, alpha, beta, color, telemetry, hash, evalScore, isEndgame);
  }

  const isCheck = isInCheck(state.board, color);
  if (depth >= 3 && !isCheck && currentPly > 0) {
    const R = depth > 6 ? 3 : 2; 
    const nextTurn = color === 'white' ? 'black' : 'white';
    
    state.turn = nextTurn;
    const preEp = state.enPassantTarget;
    state.enPassantTarget = null;
    const nullHash = hash ^ ZOBRIST.turn; 

    const nullScore = -alphaBeta(state, depth - 1 - R, -beta, -beta + 1, nextTurn, telemetry, nullHash, evalScore, isEndgame, currentPly + 1);
    
    state.turn = color;
    state.enPassantTarget = preEp;

    if (telemetry.abort) return 0;
    if (nullScore >= beta) return beta; 
  }

  const mg0 = performance.now();
  const moves = generateLegalMoves(state, color, true);
  telemetry.moveGenTimeMs += performance.now() - mg0;

  if (moves.length === 0) return isCheck ? -(MATE_SCORE + depth) : 0; 

  const sorted = orderMoves(moves, currentPly, telemetry, ttEntry && ttEntry.key === hash ? ttEntry.bestMove : undefined);

  let bestScore = -INFINITY;
  let bestMove: Move | undefined;
  let flag: 'exact' | 'alpha' | 'beta' = 'alpha';
  let isFirstMove = true;

  for (const move of sorted) {
    const preCastling = getCastlingIndex(state.castlingRights);
    const preEp = state.enPassantTarget;

    const mm0 = performance.now();
    const undo = makeMoveMutating(state, move);
    telemetry.makeMoveTimeMs += performance.now() - mm0;

    const { newHash, newScore } = applyDeltas(move, hash, evalScore, isEndgame, state, preCastling, preEp);
    const nextColor = color === 'white' ? 'black' : 'white';
    
    let score: number;

    if (isFirstMove) {
      score = -alphaBeta(state, depth - 1, -beta, -alpha, nextColor, telemetry, newHash, newScore, isEndgame, currentPly + 1);
      isFirstMove = false;
    } else {
      score = -alphaBeta(state, depth - 1, -alpha - 1, -alpha, nextColor, telemetry, newHash, newScore, isEndgame, currentPly + 1);
      if (score > alpha && score < beta && !telemetry.abort) {
        score = -alphaBeta(state, depth - 1, -beta, -alpha, nextColor, telemetry, newHash, newScore, isEndgame, currentPly + 1);
      }
    }

    const um0 = performance.now();
    unmakeMove(state, move, undo);
    telemetry.makeMoveTimeMs += performance.now() - um0;

    if (telemetry.abort) return 0;

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
      saveKillerMove(move, currentPly);
      break;
    }
  }

  if (!telemetry.abort) {
    transpositionTable[ttIndex] = { key: hash, depth, score: bestScore, flag, bestMove };
  }
  return bestScore;
}

// --- Difficulty Mapping mapped to Milliseconds ---
const DIFFICULTY_TIME_MS: Record<Difficulty, number> = {
  beginner: 250,      // Quarter second (Fast, shallow)
  intermediate: 1000, // 1 second
  advanced: 2000,     // 2 seconds
  master: 3000,       // 3 seconds maximum computation
};

function getBookMove(state: GameState): Move | null {
  if (state.moveHistory.length > 10) return null;
  const moves = generateLegalMoves(state);
  if (state.moveHistory.length === 0) {
    const openings = moves.filter(m =>
      (m.piece.type === 'pawn' && (m.to.col === 3 || m.to.col === 4) && Math.abs(m.from.row - m.to.row) === 2) ||
      (m.piece.type === 'knight' && (m.to.row === 5 || m.to.row === 2))
    );
    if (openings.length > 0) return openings[Math.floor(Math.random() * openings.length)];
  }
  return null;
}

export function findBestMove(state: GameState, difficulty: Difficulty): Move | null {
  const globalStart = performance.now();
  
  const telemetry: SearchTelemetry = {
    totalTimeMs: 0, nodesSearched: 0, qNodesSearched: 0, nps: 0,
    ttHits: 0, ttMisses: 0, moveGenTimeMs: 0, makeMoveTimeMs: 0,
    evalTimeMs: 0, hashTimeMs: 0, sortTimeMs: 0,
    startTime: globalStart,
    timeLimit: DIFFICULTY_TIME_MS[difficulty],
    abort: false
  };

  const moves = generateLegalMoves(state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];
  if (difficulty !== 'master') {
    const bookMove = getBookMove(state);
    if (bookMove) return bookMove;
  }

  let completedBestMove: Move = moves[0];
  const originalTurn = state.turn;

  const isEndgame = determineIsEndgame(state.board);
  const baseHash = computeBaseZobristHash(state);
  const baseScore = evaluateRoot(state.board, isEndgame);

  // Iterative Deepening governed by Time limit
  let reachedDepth = 0;
  for (let depth = 1; depth <= MAX_SEARCH_DEPTH; depth++) {
    let currentBest = moves[0];
    let currentBestScore = -INFINITY;

    for (const move of orderMoves([...moves], 0, telemetry)) {
      const preCastling = getCastlingIndex(state.castlingRights);
      const preEp = state.enPassantTarget;

      const mm0 = performance.now();
      const undo = makeMoveMutating(state, move);
      telemetry.makeMoveTimeMs += performance.now() - mm0;

      const { newHash, newScore } = applyDeltas(move, baseHash, baseScore, isEndgame, state, preCastling, preEp);

      const score = -alphaBeta(
        state, depth - 1, -INFINITY, INFINITY,
        originalTurn === 'white' ? 'black' : 'white',
        telemetry, newHash, newScore, isEndgame, 1
      );

      const um0 = performance.now();
      unmakeMove(state, move, undo);
      telemetry.makeMoveTimeMs += performance.now() - um0;

      if (telemetry.abort) break; // Time ran out during this move!

      if (score > currentBestScore) {
        currentBestScore = score;
        currentBest = move;
      }
    }

    if (telemetry.abort) {
      // If we aborted during depth 7, depth 7 is incomplete and garbage. 
      // We break and rely on the fully completed Depth 6 best move.
      break;
    }

    completedBestMove = currentBest;
    reachedDepth = depth;

    // Early exit if forced mate is found
    if (currentBestScore > MATE_SCORE - 100) break; 
  }

  telemetry.totalTimeMs = performance.now() - globalStart;
  const totalNodes = telemetry.nodesSearched + telemetry.qNodesSearched;
  telemetry.nps = Math.floor((totalNodes / telemetry.totalTimeMs) * 1000);

  console.log(`--- Search Complete (Hit Depth ${reachedDepth}) ---`);
  console.table({
    "Total Time (s)": (telemetry.totalTimeMs / 1000).toFixed(2),
    "Total Nodes Evaluated": totalNodes,
    "NPS Performance": telemetry.nps,
    "TT Hit Rate (%)": ((telemetry.ttHits / (telemetry.ttHits + telemetry.ttMisses || 1)) * 100).toFixed(2),
  });

  return completedBestMove;
}

export function evaluatePosition(state: GameState): number {
  return evaluateRoot(state.board, determineIsEndgame(state.board)) / 100;
}