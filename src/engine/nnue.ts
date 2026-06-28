/**
 * MindMove NNUE — Efficiently Updatable Neural Network Evaluation
 *
 * Architecture: 768 → 256 → 32 → 1
 *   Input:  768 features (6 piece types × 2 colors × 64 squares), binary
 *   L1:     256 neurons, ClippedReLU activation, computed from both perspectives
 *   L2:     32 neurons, ClippedReLU
 *   Output: 1 scalar (centipawns, white-positive)
 *
 * The key trick (HalfKP-style): we maintain two accumulators — one from
 * White's perspective and one from Black's. On each move we only update
 * the features that changed (typically 1-4 of 768), not the whole network.
 * This makes NNUE evaluation nearly free compared to a full forward pass.
 */

// ── Constants ─────────────────────────────────────────────────────────────────
const INPUT_SIZE  = 768;  // 6 pieces × 2 colors × 64 squares
const L1_SIZE     = 256;  // hidden layer 1 (both perspectives concatenated = 512)
const L2_SIZE     = 32;   // hidden layer 2
const SCALE       = 400;  // output scaling to centipawns
const CRELU_MAX   = 127;  // ClippedReLU ceiling

// Piece index: [pawn=0, knight=1, bishop=2, rook=3, queen=4, king=5]
const PIECE_IDX: Record<string, number> = {
  pawn: 0, knight: 1, bishop: 2, rook: 3, queen: 4, king: 5,
};

// ── Weight storage (initialized with Xavier, replaced by trained weights) ─────
export class NNUEWeights {
  // L1: 768 → 256  (stored as Float32, quantized to Int8 at inference)
  L1w: Float32Array;   // [256 × 768]
  L1b: Float32Array;   // [256]
  // L2: 512 → 32  (L1 outputs from BOTH perspectives concatenated)
  L2w: Float32Array;   // [32 × 512]
  L2b: Float32Array;   // [32]
  // L3: 32 → 1
  L3w: Float32Array;   // [32]
  L3b: Float32Array;   // [1]

  constructor() {
    this.L1w = new Float32Array(L1_SIZE * INPUT_SIZE);
    this.L1b = new Float32Array(L1_SIZE);
    this.L2w = new Float32Array(L2_SIZE * L1_SIZE * 2);
    this.L2b = new Float32Array(L2_SIZE);
    this.L3w = new Float32Array(L2_SIZE);
    this.L3b = new Float32Array(1);
    this.initXavier();
  }

  private initXavier() {
    // Xavier initialization — keeps gradients stable at the start of training
    const initLayer = (w: Float32Array, fanIn: number) => {
      const std = Math.sqrt(2.0 / fanIn);
      for (let i = 0; i < w.length; i++) {
        // Box-Muller for normally distributed weights
        const u1 = Math.random() + 1e-10;
        const u2 = Math.random();
        w[i] = std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      }
    };
    initLayer(this.L1w, INPUT_SIZE);
    initLayer(this.L2w, L1_SIZE * 2);
    initLayer(this.L3w, L2_SIZE);
    // Biases start at zero
    this.L1b.fill(0);
    this.L2b.fill(0);
    this.L3b.fill(0);
  }

  /** Serialize to a compact binary buffer for storage/transmission */
  serialize(): ArrayBuffer {
    const totalFloats =
      this.L1w.length + this.L1b.length +
      this.L2w.length + this.L2b.length +
      this.L3w.length + this.L3b.length;
    const buf = new ArrayBuffer(totalFloats * 4);
    const view = new Float32Array(buf);
    let offset = 0;
    for (const arr of [this.L1w, this.L1b, this.L2w, this.L2b, this.L3w, this.L3b]) {
      view.set(arr, offset);
      offset += arr.length;
    }
    return buf;
  }

  /** Load weights from a binary buffer (output of training) */
  deserialize(buf: ArrayBuffer) {
    const view = new Float32Array(buf);
    let offset = 0;
    const load = (arr: Float32Array) => {
      arr.set(view.subarray(offset, offset + arr.length));
      offset += arr.length;
    };
    load(this.L1w); load(this.L1b);
    load(this.L2w); load(this.L2b);
    load(this.L3w); load(this.L3b);
  }
}

// ── Global weight instance (singleton, lazy-loaded from trained file) ─────────
export const NNUE_WEIGHTS = new NNUEWeights();
let nnueReady = false;
let nnueTrained = false; // true only when weights loaded from file, not Xavier init

export function isNNUEReady(): boolean { return nnueReady && nnueTrained; }
export function isNNUETrained(): boolean { return nnueTrained; }

export async function loadNNUEWeights(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    NNUE_WEIGHTS.deserialize(buf);
    nnueReady = true;
    nnueTrained = true;
    console.log('[NNUE] Trained weights loaded successfully');
    return true;
  } catch (e) {
    console.warn('[NNUE] Could not load weights, using Xavier init');
    return false;
  }
}

// ── Feature index computation ─────────────────────────────────────────────────
// For each piece on the board we compute two feature indices:
//   - from White's perspective (king-relative would be HalfKP, we use simpler HalfKA)
//   - from Black's perspective (board mirrored vertically)
//
// Feature index = pieceType * 2 * 64 + colorBit * 64 + square
//   where square = row * 8 + col  (0=a8, 63=h1 from white's POV)

function featureIndex(pieceType: string, pieceColor: string, row: number, col: number, perspective: 'white' | 'black'): number {
  const sq = perspective === 'white' ? (row * 8 + col) : ((7 - row) * 8 + col);
  const colorBit = (pieceColor === perspective) ? 0 : 1;
  return PIECE_IDX[pieceType] * 128 + colorBit * 64 + sq;
}

// ── Accumulator ───────────────────────────────────────────────────────────────
// Stores the L1 activations for both perspectives.
// Updated incrementally on make/unmake move.

export class Accumulator {
  white: Int16Array;  // L1 output from White's perspective
  black: Int16Array;  // L1 output from Black's perspective

  constructor() {
    this.white = new Int16Array(L1_SIZE);
    this.black = new Int16Array(L1_SIZE);
    // Initialize from biases
    for (let i = 0; i < L1_SIZE; i++) {
      this.white[i] = Math.round(NNUE_WEIGHTS.L1b[i] * 64);
      this.black[i] = Math.round(NNUE_WEIGHTS.L1b[i] * 64);
    }
  }

  clone(): Accumulator {
    const acc = new Accumulator();
    acc.white.set(this.white);
    acc.black.set(this.black);
    return acc;
  }

  /** Add a piece's contribution to both perspectives */
  addFeature(pieceType: string, pieceColor: string, row: number, col: number) {
    this._updateFeature(pieceType, pieceColor, row, col, +1);
  }

  /** Remove a piece's contribution from both perspectives */
  removeFeature(pieceType: string, pieceColor: string, row: number, col: number) {
    this._updateFeature(pieceType, pieceColor, row, col, -1);
  }

  private _updateFeature(pieceType: string, pieceColor: string, row: number, col: number, sign: 1 | -1) {
    const wIdx = featureIndex(pieceType, pieceColor, row, col, 'white');
    const bIdx = featureIndex(pieceType, pieceColor, row, col, 'black');

    // Update white perspective
    const wBase = wIdx;
    for (let i = 0; i < L1_SIZE; i++) {
      this.white[i] += sign * Math.round(NNUE_WEIGHTS.L1w[i * INPUT_SIZE + wBase] * 64);
    }
    // Update black perspective
    const bBase = bIdx;
    for (let i = 0; i < L1_SIZE; i++) {
      this.black[i] += sign * Math.round(NNUE_WEIGHTS.L1w[i * INPUT_SIZE + bBase] * 64);
    }
  }
}

// ── Forward pass (inference) ──────────────────────────────────────────────────
// ClippedReLU: clamp to [0, CRELU_MAX]
function crelu(x: number): number {
  return x < 0 ? 0 : x > CRELU_MAX ? CRELU_MAX : x;
}

/**
 * Full NNUE forward pass.
 * Takes the two L1 accumulators and runs L2 → L3.
 * Returns evaluation in centipawns (positive = side-to-move is better).
 */
export function nnueEval(acc: Accumulator, sideToMove: 'white' | 'black'): number {
  const w = NNUE_WEIGHTS;

  // L1 → L2 input: concatenate [stm perspective, opponent perspective]
  // Convention: stm's accumulator first
  const stmAcc   = sideToMove === 'white' ? acc.white : acc.black;
  const oppAcc   = sideToMove === 'white' ? acc.black  : acc.white;

  // L1 output (ClippedReLU, 512 values)
  const l1Out = new Float32Array(L1_SIZE * 2);
  for (let i = 0; i < L1_SIZE; i++) {
    l1Out[i]           = crelu(stmAcc[i]) / 64;
    l1Out[i + L1_SIZE] = crelu(oppAcc[i]) / 64;
  }

  // L2 forward: 512 → 32
  const l2Out = new Float32Array(L2_SIZE);
  for (let i = 0; i < L2_SIZE; i++) {
    let sum = w.L2b[i];
    const base = i * L1_SIZE * 2;
    for (let j = 0; j < L1_SIZE * 2; j++) sum += w.L2w[base + j] * l1Out[j];
    l2Out[i] = crelu(sum * 64) / 64;
  }

  // L3 forward: 32 → 1
  let output = w.L3b[0];
  for (let i = 0; i < L2_SIZE; i++) output += w.L3w[i] * l2Out[i];

  return Math.round(output * SCALE);
}

// ── Full board → Accumulator (used at root / after FEN import) ───────────────
export function buildAccumulator(board: (({ type: string; color: string } | null))[][]): Accumulator {
  const acc = new Accumulator();
  // Reset to biases
  for (let i = 0; i < L1_SIZE; i++) {
    const bVal = Math.round(NNUE_WEIGHTS.L1b[i] * 64);
    acc.white[i] = bVal;
    acc.black[i] = bVal;
  }
  // Add all pieces
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) acc.addFeature(p.type, p.color, r, c);
    }
  }
  return acc;
}

// ── Training: Texel-style gradient descent ────────────────────────────────────
// Run this offline in Node.js with a dataset of positions + outcomes.
// Each position: { board, sideToMove, result }  where result ∈ {1, 0.5, 0}

export interface TrainingPosition {
  features: Uint8Array;   // 768-bit sparse input (1 per piece)
  result: number;         // 1=white wins, 0.5=draw, 0=black wins
}

const K = 1.0 / 400; // sigmoid scaling constant (tuned to match centipawn scale)

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-K * x));
}

/**
 * One SGD step on a batch of positions.
 * lr: learning rate (start 0.001, decay to 0.0001)
 * Returns mean squared error for this batch.
 */
export function trainBatch(
  positions: TrainingPosition[],
  lr: number,
  weights: NNUEWeights,
): number {
  let totalError = 0;

  for (const pos of positions) {
    // Build accumulator from features
    const acc = new Accumulator();
    for (let i = 0; i < L1_SIZE; i++) {
      acc.white[i] = Math.round(weights.L1b[i] * 64);
      acc.black[i] = Math.round(weights.L1b[i] * 64);
    }

    // Activate features from sparse input
    for (let fi = 0; fi < INPUT_SIZE; fi++) {
      if (!pos.features[fi]) continue;
      // Feature fi encodes: pieceType*128 + colorBit*64 + square
      const pieceTypeIdx = Math.floor(fi / 128);
      const remainder    = fi % 128;
      const colorBit     = Math.floor(remainder / 64);
      const sq           = remainder % 64;
      const row = Math.floor(sq / 8), col = sq % 8;
      const pieceType  = Object.keys(PIECE_IDX)[pieceTypeIdx];
      const pieceColor = colorBit === 0 ? 'white' : 'black';

      for (let i = 0; i < L1_SIZE; i++) {
        const ww = Math.round(weights.L1w[i * INPUT_SIZE + fi] * 64);
        acc.white[i] += ww;
        // Mirror for black
        const mirrorFi = pieceTypeIdx * 128 + (1 - colorBit) * 64 + ((7 - row) * 8 + col);
        const bw = Math.round(weights.L1w[i * INPUT_SIZE + mirrorFi] * 64);
        acc.black[i] += bw;
      }
    }

    // Forward pass
    const eval_ = nnueEval(acc, 'white');
    const predicted = sigmoid(eval_);
    const error = predicted - pos.result;
    totalError += error * error;

    // Backward pass (gradient of MSE loss through sigmoid)
    const dLoss = 2 * error * predicted * (1 - predicted) * K;

    // L3 gradient
    const l1Out = new Float32Array(L1_SIZE * 2);
    for (let i = 0; i < L1_SIZE; i++) {
      l1Out[i]           = crelu(acc.white[i]) / 64;
      l1Out[i + L1_SIZE] = crelu(acc.black[i]) / 64;
    }
    const l2Out = new Float32Array(L2_SIZE);
    for (let i = 0; i < L2_SIZE; i++) {
      let s = weights.L2b[i];
      for (let j = 0; j < L1_SIZE * 2; j++) s += weights.L2w[i * L1_SIZE * 2 + j] * l1Out[j];
      l2Out[i] = crelu(s * 64) / 64;
    }

    // Update L3 weights
    weights.L3b[0] -= lr * dLoss;
    for (let i = 0; i < L2_SIZE; i++) {
      const dL3 = dLoss * l2Out[i];
      weights.L3w[i] -= lr * dL3;
    }

    // L2 gradient (simplified — full backprop through ClippedReLU)
    for (let i = 0; i < L2_SIZE; i++) {
      const dL2 = dLoss * weights.L3w[i];
      weights.L2b[i] -= lr * dL2;
      for (let j = 0; j < L1_SIZE * 2; j++) {
        weights.L2w[i * L1_SIZE * 2 + j] -= lr * dL2 * l1Out[j];
      }
    }

    // L1 gradient (only update active features — sparse)
    for (let fi = 0; fi < INPUT_SIZE; fi++) {
      if (!pos.features[fi]) continue;
      for (let i = 0; i < L1_SIZE; i++) {
        if (acc.white[i] <= 0 || acc.white[i] >= CRELU_MAX * 64) continue;
        let dL1 = 0;
        for (let j = 0; j < L2_SIZE; j++) {
          dL1 += weights.L2w[j * L1_SIZE * 2 + i] * dLoss * weights.L3w[j];
        }
        weights.L1w[i * INPUT_SIZE + fi] -= lr * dL1 / 64;
      }
    }
  }

  return totalError / positions.length;
}

// ── Feature extraction from a board position ─────────────────────────────────
export function extractFeatures(
  board: (({ type: string; color: string } | null))[][],
): Uint8Array {
  const features = new Uint8Array(INPUT_SIZE);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const sq = r * 8 + c;
      const colorBit = p.color === 'white' ? 0 : 1;
      const fi = PIECE_IDX[p.type] * 128 + colorBit * 64 + sq;
      features[fi] = 1;
    }
  }
  return features;
}
