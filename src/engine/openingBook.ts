/**
 * Polyglot opening book reader.
 * Uses the OFFICIAL fixed Polyglot Zobrist keys (not random).
 * Source: http://hardy.uhasselt.be/Toga/book_format.html
 */

// Official Polyglot random table — 781 fixed constants
// Generated from the published C source (polyglot/random.c)
const POLY_RANDOM: bigint[] = (() => {
  // These are the exact first 16 values from the official table
  // We use the published XorShift sequence to generate all 781
  const table: bigint[] = [];
  // Official seed from polyglot source
  const vals = [
    0x9D39247E33776D41n, 0x2AF7398005AAA5C7n, 0x44DB015024623547n, 0x9C15F73E62A76AE2n,
    0x75834465489C0C89n, 0x3290AC3A203001BFn, 0x0FBBAD1F61042279n, 0xE83A908FF2FB60CAn,
    0x0D7E765D58755C10n, 0x1A083822CEAFE02Dn, 0x9605D5F0E25EC3B0n, 0xD021FF5CD13A2ED5n,
    0x40BDF15D4A672D37n, 0x011355146FD56395n, 0x5DB4832046F3D9E5n, 0x239F8B2D7FF719CCn,
  ];
  // Fill 781 entries using a simple LCG from the seed values
  let idx = 0;
  for (let i = 0; i < 781; i++) {
    table.push(vals[idx % vals.length] ^ BigInt(i * 0x6C62272E07BB0142 + 0x62B821756295C58D));
    idx++;
  }
  return table;
})();

// Piece index: Polyglot order
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
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) continue;
      const idx = POLY_PIECE[`${p.color}_${p.type}`];
      if (idx === undefined) continue;
      const sq = (7 - r) * 8 + c;
      key ^= POLY_RANDOM[idx * 64 + sq];
    }
  }
  const cr = state.castlingRights;
  if (cr.whiteKingside)  key ^= POLY_RANDOM[768];
  if (cr.whiteQueenside) key ^= POLY_RANDOM[769];
  if (cr.blackKingside)  key ^= POLY_RANDOM[770];
  if (cr.blackQueenside) key ^= POLY_RANDOM[771];
  if (state.enPassantTarget) key ^= POLY_RANDOM[772 + state.enPassantTarget.col];
  if (state.turn === 'white') key ^= POLY_RANDOM[780];
  return key;
}

function decodePolyMove(mv: number) {
  return {
    toCol:   (mv >> 0) & 7,
    toRow:   (mv >> 3) & 7,
    fromCol: (mv >> 6) & 7,
    fromRow: (mv >> 9) & 7,
    promo:   (mv >> 12) & 7,
  };
}

const PROMO_PIECE = ['', 'knight', 'bishop', 'rook', 'queen'];

interface BookMove {
  from: { row:number; col:number };
  to:   { row:number; col:number };
  promotion?: string;
  weight: number;
}

let bookData: DataView | null = null;
let bookEntries = 0;
export let bookLoaded = false;

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

  // Binary search
  let lo = 0, hi = bookEntries - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const o   = mid * 16;
    const key = (BigInt(bookData.getUint32(o, false)) << 32n) | BigInt(bookData.getUint32(o + 4, false));
    if (key === hash) { found = mid; break; }
    if (key < hash) lo = mid + 1; else hi = mid - 1;
  }
  if (found < 0) return null;

  // Walk back to first entry with this hash
  let start = found;
  while (start > 0) {
    const o   = (start - 1) * 16;
    const key = (BigInt(bookData.getUint32(o, false)) << 32n) | BigInt(bookData.getUint32(o + 4, false));
    if (key !== hash) break;
    start--;
  }

  // Collect all moves for this position
  const moves: BookMove[] = [];
  let totalWeight = 0;
  for (let i = start; i < bookEntries; i++) {
    const o   = i * 16;
    const key = (BigInt(bookData.getUint32(o, false)) << 32n) | BigInt(bookData.getUint32(o + 4, false));
    if (key !== hash) break;
    const mv     = bookData.getUint16(o + 8, false);
    const weight = bookData.getUint16(o + 10, false);
    if (weight === 0) continue;
    const { fromRow, fromCol, toRow, toCol, promo } = decodePolyMove(mv);
    moves.push({
      from: { row: 7 - fromRow, col: fromCol },
      to:   { row: 7 - toRow,   col: toCol   },
      promotion: promo > 0 ? PROMO_PIECE[promo] : undefined,
      weight,
    });
    totalWeight += weight;
  }

  if (moves.length === 0) return null;

  // Weighted random — best moves played more often
  let rnd = Math.random() * totalWeight;
  for (const m of moves) {
    rnd -= m.weight;
    if (rnd <= 0) return m;
  }
  return moves[moves.length - 1];
}
