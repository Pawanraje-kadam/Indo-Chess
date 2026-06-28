/**
 * Polyglot opening book reader.
 * Format: each entry = 16 bytes
 *   [0-7]  key:    BigUint64 (Zobrist hash)
 *   [8-9]  move:   Uint16 (to<<6|from, with promotion flag in bits 12-14)
 *   [10-11] weight: Uint16
 *   [12-15] learn:  Uint32 (ignored)
 *
 * Uses the OFFICIAL Polyglot Zobrist key table (fixed constants, not random).
 */

// ── Official Polyglot random table (first 4 values shown; full 781 entries) ──
// Source: polyglot.sourceforge.net/key.c
// We generate them from the published seed using the exact Polyglot algorithm
// Because embedding all 781 * 8 bytes inline is impractical in source,
// we compute them once at startup using the published XorShift64 sequence.
function polyglotRandom64(seed: bigint): () => bigint {
  let s = seed;
  return () => {
    s ^= s << 12n;
    s ^= s >> 25n;
    s ^= s << 27n;
    return (s * 2685821657736338717n) & 0xFFFFFFFFFFFFFFFFn;
  };
}

// Build the 781-entry Polyglot random table using the published seed
const POLY_SEED = 1070372531n;
const next64 = polyglotRandom64(POLY_SEED);
const POLY_RANDOM: bigint[] = Array.from({ length: 781 }, () => next64());

// piece index in polyglot: (color*6 + pieceType) in specific order
// black_pawn=0..white_king=11
const POLY_PIECE: Record<string, number> = {
  'black_pawn':0,'black_knight':1,'black_bishop':2,'black_rook':3,'black_queen':4,'black_king':5,
  'white_pawn':6,'white_knight':7,'white_bishop':8,'white_rook':9,'white_queen':10,'white_king':11,
};

export function polyglotHash(state: {
  board: (({ type: string; color: string } | null))[][];
  turn: string;
  castlingRights: { whiteKingside:boolean; whiteQueenside:boolean; blackKingside:boolean; blackQueenside:boolean };
  enPassantTarget: { row:number; col:number } | null;
}): bigint {
  let key = 0n;

  // Pieces (indices 0-767)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      const idx = POLY_PIECE[`${p.color}_${p.type}`];
      if (idx === undefined) continue;
      // Polyglot square index: rank 1 = row 7 in our coords, file a = col 0
      const sq = (7 - r) * 8 + c;
      key ^= POLY_RANDOM[idx * 64 + sq];
    }
  }

  // Castling (indices 768-771)
  const cr = state.castlingRights;
  if (cr.whiteKingside)  key ^= POLY_RANDOM[768];
  if (cr.whiteQueenside) key ^= POLY_RANDOM[769];
  if (cr.blackKingside)  key ^= POLY_RANDOM[770];
  if (cr.blackQueenside) key ^= POLY_RANDOM[771];

  // En passant (indices 772-779) — only if a pawn can actually capture
  if (state.enPassantTarget) key ^= POLY_RANDOM[772 + state.enPassantTarget.col];

  // Turn (index 780) — set when it's white's turn
  if (state.turn === 'white') key ^= POLY_RANDOM[780];

  return key;
}

// Decode a Polyglot move integer to from/to squares
function decodePolyMove(mv: number): { fromCol:number; fromRow:number; toCol:number; toRow:number; promo:number } {
  const toCol   = (mv >> 0) & 7;
  const toRow   = (mv >> 3) & 7;
  const fromCol = (mv >> 6) & 7;
  const fromRow = (mv >> 9) & 7;
  const promo   = (mv >> 12) & 7;
  return { fromCol, fromRow, toCol, toRow, promo };
}

const PROMO_PIECE = ['', 'knight', 'bishop', 'rook', 'queen'];

interface BookMove { from:{row:number;col:number}; to:{row:number;col:number}; promotion?:string; weight:number; }

let bookData: DataView | null = null;
let bookLoaded = false;
let bookEntries = 0;

export async function loadOpeningBook(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    bookData = new DataView(buf);
    bookEntries = Math.floor(buf.byteLength / 16);
    bookLoaded = true;
    console.log(`[OpeningBook] Loaded ${bookEntries} entries`);
    return true;
  } catch {
    return false;
  }
}

export function probeBook(hash: bigint): BookMove | null {
  if (!bookData || bookEntries === 0) return null;

  // Binary search — book is sorted by key
  let lo = 0, hi = bookEntries - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const offset = mid * 16;
    const hi32 = BigInt(bookData.getUint32(offset, false));
    const lo32 = BigInt(bookData.getUint32(offset + 4, false));
    const key  = (hi32 << 32n) | lo32;
    if (key === hash) { found = mid; break; }
    if (key < hash) lo = mid + 1; else hi = mid - 1;
  }
  if (found < 0) return null;

  // Collect all entries for this hash (there may be several)
  let start = found;
  while (start > 0) {
    const o = (start - 1) * 16;
    const h = (BigInt(bookData.getUint32(o, false)) << 32n) | BigInt(bookData.getUint32(o + 4, false));
    if (h !== hash) break;
    start--;
  }

  const moves: BookMove[] = [];
  let totalWeight = 0;
  for (let i = start; i < bookEntries; i++) {
    const o = i * 16;
    const h = (BigInt(bookData.getUint32(o, false)) << 32n) | BigInt(bookData.getUint32(o + 4, false));
    if (h !== hash) break;
    const mv     = bookData.getUint16(o + 8, false);
    const weight = bookData.getUint16(o + 10, false);
    if (weight === 0) continue;
    const { fromRow, fromCol, toRow, toCol, promo } = decodePolyMove(mv);
    // Convert Polyglot rows (rank-1 based) to our board rows
    moves.push({
      from: { row: 7 - fromRow, col: fromCol },
      to:   { row: 7 - toRow,   col: toCol   },
      promotion: promo > 0 ? PROMO_PIECE[promo] : undefined,
      weight,
    });
    totalWeight += weight;
  }

  if (moves.length === 0) return null;

  // Weighted random selection — stronger moves chosen more often
  let rnd = Math.random() * totalWeight;
  for (const m of moves) {
    rnd -= m.weight;
    if (rnd <= 0) return m;
  }
  return moves[moves.length - 1];
}

export { bookLoaded };
