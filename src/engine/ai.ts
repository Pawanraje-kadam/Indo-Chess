import { GameState, Move, Difficulty, PieceColor, PIECE_VALUES, PieceType, CastlingRights, Position } from './types';
import { generateLegalMoves, generateLegalCaptures, makeMoveMutating, unmakeMove, isInCheck } from './board';
import { PST, getPSTValue, evaluateRoot, determineIsEndgame } from './evaluation';
import { probeBook, polyglotHash, bookLoaded } from './openingBook';

const INFINITY = 999999;
const MATE_SCORE = 100000;
const MAX_SEARCH_DEPTH = 32;

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
  startTime: number;
  timeLimit: number;
  abort: boolean;
}

// --- Zobrist Hashing ---
function randomBigInt(): bigint {
  const low = BigInt(Math.floor(Math.random() * 0xFFFFFFFF));
  const high = BigInt(Math.floor(Math.random() * 0xFFFFFFFF));
  return (high << 32n) | low;
}

const ZOBRIST = {
  pieces: { white: {} as Record<PieceType, bigint[][]>, black: {} as Record<PieceType, bigint[][]> },
  turn: randomBigInt(),
  castling: Array.from({ length: 16 }, randomBigInt),
  ep: Array.from({ length: 8 }, randomBigInt),
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

// --- Transposition Table (4M entries) ---
const TT_SIZE = 1 << 22;
const TT_MASK = BigInt(TT_SIZE - 1);

interface TTEntry {
  key: bigint;
  depth: number;
  score: number;
  flag: 'exact' | 'alpha' | 'beta';
  bestMove?: Move;
}

const transpositionTable: (TTEntry | null)[] = new Array(TT_SIZE).fill(null);

// --- History Heuristic (from × to → 64×64) ---
const historyTable = new Int32Array(64 * 64);

function histIdx(fromRow: number, fromCol: number, toRow: number, toCol: number): number {
  return ((fromRow * 8 + fromCol) << 6) | (toRow * 8 + toCol);
}

// --- Killer Moves ---
const killerMoves: (Move | null)[][] = Array.from({ length: MAX_SEARCH_DEPTH }, () => [null, null]);

function saveKillerMove(move: Move, ply: number) {
  if (ply >= MAX_SEARCH_DEPTH || move.captured) return;
  if (killerMoves[ply][0] && isSameMove(killerMoves[ply][0]!, move)) return;
  killerMoves[ply][1] = killerMoves[ply][0];
  killerMoves[ply][0] = move;
}

function isSameMove(a: Move, b: Move): boolean {
  return a.from.row === b.from.row && a.from.col === b.from.col &&
         a.to.row === b.to.row && a.to.col === b.to.col;
}

// --- Incremental Eval / Hash Update ---
function applyDeltas(
  move: Move, hash: bigint, score: number,
  isEndgame: boolean, state: GameState,
  preCastling: number, preEp: Position | null,
): { newHash: bigint; newScore: number } {
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
  if (move.promotion) newScore += sign * (PIECE_VALUES[move.promotion] - PIECE_VALUES['pawn']);

  if (move.captured) {
    const capRow = move.isEnPassant ? move.from.row : move.to.row;
    newHash ^= ZOBRIST.pieces[enemyColor][move.captured.type][capRow][move.to.col];
    newScore -= (-sign) * getPSTValue({ type: move.captured.type, color: enemyColor }, capRow, move.to.col, isEndgame);
    newScore += sign * PIECE_VALUES[move.captured.type];
  }

  if (move.isCastle) {
    const rRow = move.from.row;
    const rFromCol = move.isKingsideCastle ? 7 : 0;
    const rToCol   = move.isKingsideCastle ? 5 : 3;
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

// --- Move Ordering ---
function orderMoves(moves: Move[], ply: number, telemetry: SearchTelemetry, ttBestMove?: Move): Move[] {
  const t0 = performance.now();
  const km1 = killerMoves[ply]?.[0];
  const km2 = killerMoves[ply]?.[1];

  moves.sort((a, b) => {
    let sA = 0, sB = 0;

    // 1. TT best move
    if (ttBestMove) {
      if (isSameMove(a, ttBestMove)) sA += 50000;
      if (isSameMove(b, ttBestMove)) sB += 50000;
    }
    // 2. Winning captures (MVV-LVA)
    if (a.captured) sA += PIECE_VALUES[a.captured.type] - PIECE_VALUES[a.piece.type] / 10 + 30000;
    if (b.captured) sB += PIECE_VALUES[b.captured.type] - PIECE_VALUES[b.piece.type] / 10 + 30000;
    // 3. Promotions
    if (a.promotion) sA += PIECE_VALUES[a.promotion] + 25000;
    if (b.promotion) sB += PIECE_VALUES[b.promotion] + 25000;
    // 4. Killer moves / History heuristic
    if (!a.captured) {
      if (km1 && isSameMove(a, km1)) sA += 20000;
      else if (km2 && isSameMove(a, km2)) sA += 19000;
      else sA += historyTable[histIdx(a.from.row, a.from.col, a.to.row, a.to.col)];
    }
    if (!b.captured) {
      if (km1 && isSameMove(b, km1)) sB += 20000;
      else if (km2 && isSameMove(b, km2)) sB += 19000;
      else sB += historyTable[histIdx(b.from.row, b.from.col, b.to.row, b.to.col)];
    }
    // 5. Checks
    if (a.isCheck) sA += 5000;
    if (b.isCheck) sB += 5000;

    return sB - sA;
  });

  telemetry.sortTimeMs += performance.now() - t0;
  return moves;
}

function checkTime(telemetry: SearchTelemetry) {
  if ((telemetry.nodesSearched + telemetry.qNodesSearched) % 2048 === 0) {
    if (performance.now() - telemetry.startTime >= telemetry.timeLimit) {
      telemetry.abort = true;
    }
  }
}

// --- Quiescence Search ---
function quiescence(
  state: GameState, alpha: number, beta: number, color: PieceColor,
  telemetry: SearchTelemetry, hash: bigint, evalScore: number, isEndgame: boolean,
): number {
  checkTime(telemetry);
  if (telemetry.abort) return 0;

  telemetry.qNodesSearched++;

  const standPat = evalScore * (color === 'white' ? 1 : -1);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  const captures = generateLegalCaptures(state, color);
  const sorted = orderMoves(captures, 0, telemetry);

  for (const move of sorted) {
    const preCastling = getCastlingIndex(state.castlingRights);
    const preEp = state.enPassantTarget;
    const undo = makeMoveMutating(state, move);
    const { newHash, newScore } = applyDeltas(move, hash, evalScore, isEndgame, state, preCastling, preEp);
    const score = -quiescence(state, -beta, -alpha, color === 'white' ? 'black' : 'white', telemetry, newHash, newScore, isEndgame);
    unmakeMove(state, move, undo);

    if (telemetry.abort) return 0;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

// --- Alpha-Beta ---
function alphaBeta(
  state: GameState, depth: number, alpha: number, beta: number,
  color: PieceColor, telemetry: SearchTelemetry,
  hash: bigint, evalScore: number, isEndgame: boolean, currentPly: number,
): number {
  checkTime(telemetry);
  if (telemetry.abort) return 0;

  telemetry.nodesSearched++;

  // TT probe
  const ttIndex = Number(hash & TT_MASK);
  const ttEntry = transpositionTable[ttIndex];
  if (ttEntry && ttEntry.key === hash && ttEntry.depth >= depth) {
    telemetry.ttHits++;
    if (ttEntry.flag === 'exact') return ttEntry.score;
    if (ttEntry.flag === 'alpha' && ttEntry.score <= alpha) return ttEntry.score;
    if (ttEntry.flag === 'beta'  && ttEntry.score >= beta)  return ttEntry.score;
  } else {
    telemetry.ttMisses++;
  }

  if (depth <= 0) return quiescence(state, alpha, beta, color, telemetry, hash, evalScore, isEndgame);

  const isCheck = isInCheck(state.board, color);

  // Check extension — extend by 1 when in check
  if (isCheck) depth += 1;

  // Null-move pruning
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

  // Futility pruning — skip moves near leaf that can't raise alpha
  const staticEval = evalScore * (color === 'white' ? 1 : -1);
  if (depth === 1 && !isCheck && staticEval + 125 < alpha) {
    return quiescence(state, alpha, beta, color, telemetry, hash, evalScore, isEndgame);
  }

  const moves = generateLegalMoves(state, color, true);
  if (moves.length === 0) return isCheck ? -(MATE_SCORE + depth) : 0;

  const ttBest = ttEntry?.key === hash ? ttEntry.bestMove : undefined;
  const sorted = orderMoves(moves, currentPly, telemetry, ttBest);

  let bestScore = -INFINITY;
  let bestMove: Move | undefined;
  let flag: 'exact' | 'alpha' | 'beta' = 'alpha';
  let movesSearched = 0;

  for (const move of sorted) {
    const preCastling = getCastlingIndex(state.castlingRights);
    const preEp = state.enPassantTarget;
    const undo = makeMoveMutating(state, move);
    const { newHash, newScore } = applyDeltas(move, hash, evalScore, isEndgame, state, preCastling, preEp);
    const nextColor = color === 'white' ? 'black' : 'white';

    let score: number;

    if (movesSearched === 0) {
      // First move: full window
      score = -alphaBeta(state, depth - 1, -beta, -alpha, nextColor, telemetry, newHash, newScore, isEndgame, currentPly + 1);
    } else {
      // LMR: reduce late quiet non-evasion moves
      const canReduce = depth >= 3 && movesSearched >= 4 && !move.captured && !move.promotion && !isCheck && !move.isCheck;
      const reduction = canReduce ? (movesSearched >= 12 ? 2 : 1) : 0;

      // Zero-window search at reduced depth
      score = -alphaBeta(state, depth - 1 - reduction, -alpha - 1, -alpha, nextColor, telemetry, newHash, newScore, isEndgame, currentPly + 1);

      // Re-search at full depth if it beats alpha
      if (score > alpha && !telemetry.abort) {
        score = -alphaBeta(state, depth - 1, -beta, -alpha, nextColor, telemetry, newHash, newScore, isEndgame, currentPly + 1);
      }
    }

    movesSearched++;
    unmakeMove(state, move, undo);
    if (telemetry.abort) return 0;

    if (score > bestScore) { bestScore = score; bestMove = move; }
    if (score > alpha)     { alpha = score; flag = 'exact'; }

    if (alpha >= beta) {
      flag = 'beta';
      saveKillerMove(move, currentPly);
      // Update history on quiet cutoff
      if (!move.captured) {
        historyTable[histIdx(move.from.row, move.from.col, move.to.row, move.to.col)] += depth * depth;
      }
      break;
    }
  }

  if (!telemetry.abort) {
    transpositionTable[ttIndex] = { key: hash, depth, score: bestScore, flag, bestMove };
  }
  return bestScore;
}

// --- Difficulty time budgets ---
const DIFFICULTY_TIME_MS: Record<Difficulty, number> = {
  beginner:     250,
  intermediate: 1000,
  advanced:     2000,
  master:       4000,  // bumped from 3s → 4s now that LMR makes it faster
};

export function findBestMove(state: GameState, difficulty: Difficulty): Move | null {
  const globalStart = performance.now();

  const telemetry: SearchTelemetry = {
    totalTimeMs: 0, nodesSearched: 0, qNodesSearched: 0, nps: 0,
    ttHits: 0, ttMisses: 0, moveGenTimeMs: 0, makeMoveTimeMs: 0,
    evalTimeMs: 0, hashTimeMs: 0, sortTimeMs: 0,
    startTime: globalStart,
    timeLimit: DIFFICULTY_TIME_MS[difficulty],
    abort: false,
  };

  const moves = generateLegalMoves(state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  // Decay history table between moves to prevent stale bias
  for (let i = 0; i < historyTable.length; i++) historyTable[i] >>= 1;

  const originalTurn = state.turn;
  const isEndgame = determineIsEndgame(state.board);
  const baseHash = computeBaseZobristHash(state);
  const baseScore = evaluateRoot(state.board, isEndgame);

  // Opening book probe
  if (bookLoaded) {
    const bookHash = polyglotHash(state);
    const bookMove = probeBook(bookHash);
    if (bookMove) {
      const matched = moves.find(m =>
        m.from.row === bookMove.from.row && m.from.col === bookMove.from.col &&
        m.to.row   === bookMove.to.row   && m.to.col   === bookMove.to.col
      );
      if (matched) {
        console.log('[OpeningBook] Playing book move:', matched.san);
        return matched;
      }
    }
  }

  let completedBestMove: Move = moves[0];
  let previousScore = 0;

  for (let depth = 1; depth <= MAX_SEARCH_DEPTH; depth++) {
    let currentBest = moves[0];
    let currentBestScore = -INFINITY;

    // Aspiration windows from depth 4 onwards
    const useAspiration = depth >= 4;
    let aspDelta = 40;
    let alphaWindow = useAspiration ? previousScore - aspDelta : -INFINITY;
    let betaWindow  = useAspiration ? previousScore + aspDelta :  INFINITY;

    // Aspiration retry loop
    while (true) {
      currentBestScore = -INFINITY;

      for (const move of orderMoves([...moves], 0, telemetry, completedBestMove)) {
        if (telemetry.abort) break;

        const preCastling = getCastlingIndex(state.castlingRights);
        const preEp = state.enPassantTarget;
        const undo = makeMoveMutating(state, move);
        const { newHash, newScore } = applyDeltas(move, baseHash, baseScore, isEndgame, state, preCastling, preEp);

        const score = -alphaBeta(
          state, depth - 1, -betaWindow, -alphaWindow,
          originalTurn === 'white' ? 'black' : 'white',
          telemetry, newHash, newScore, isEndgame, 1,
        );

        unmakeMove(state, move, undo);
        if (telemetry.abort) break;

        if (score > currentBestScore) { currentBestScore = score; currentBest = move; }
      }

      if (telemetry.abort) break;

      // Widen window on fail-low or fail-high
      if (currentBestScore <= alphaWindow) {
        alphaWindow = Math.max(currentBestScore - aspDelta, -INFINITY);
        aspDelta *= 2;
      } else if (currentBestScore >= betaWindow) {
        betaWindow = Math.min(currentBestScore + aspDelta, INFINITY);
        aspDelta *= 2;
      } else {
        break; // Score within window — done
      }

      // Safety valve: blow fully open after too many retries
      if (alphaWindow <= -INFINITY && betaWindow >= INFINITY) break;
    }

    if (telemetry.abort) break;

    completedBestMove = currentBest;
    previousScore = currentBestScore;

    if (currentBestScore > MATE_SCORE - 100) break; // Forced mate found
  }

  telemetry.totalTimeMs = performance.now() - globalStart;
  const totalNodes = telemetry.nodesSearched + telemetry.qNodesSearched;
  telemetry.nps = Math.floor((totalNodes / telemetry.totalTimeMs) * 1000);

  console.log(`[MindMove] depth reached | nodes: ${totalNodes} | nps: ${telemetry.nps} | TT hit%: ${((telemetry.ttHits / (telemetry.ttHits + telemetry.ttMisses || 1)) * 100).toFixed(1)}`);

  return completedBestMove;
}

export function evaluatePosition(state: GameState): number {
  return evaluateRoot(state.board, determineIsEndgame(state.board)) / 100;
}
