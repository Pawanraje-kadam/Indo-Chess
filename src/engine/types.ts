/** Core chess types for Indo Chess engine */

export type PieceColor = 'white' | 'black';
export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

export interface Piece {
  type: PieceType;
  color: PieceColor;
}

export type Square = Piece | null;
export type Board = Square[][];

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  from: Position;
  to: Position;
  piece: Piece;
  captured?: Piece;
  promotion?: PieceType;
  isEnPassant?: boolean;
  isCastle?: boolean;
  isKingsideCastle?: boolean;
  isQueensideCastle?: boolean;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isStalemate?: boolean;
  san?: string;
  classification?: MoveClassification;
}

export type MoveClassification = 'brilliant' | 'great' | 'best' | 'excellent' | 'good' | 'book' | 'inaccuracy' | 'mistake' | 'blunder' | 'forced';

export interface CastlingRights {
  whiteKingside: boolean;
  whiteQueenside: boolean;
  blackKingside: boolean;
  blackQueenside: boolean;
}

export interface GameState {
  board: Board;
  turn: PieceColor;
  castlingRights: CastlingRights;
  enPassantTarget: Position | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  moveHistory: Move[];
  positionHistory: string[];
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  drawReason?: DrawReason;
  isGameOver: boolean;
  winner?: PieceColor;
  capturedPieces: { white: Piece[]; black: Piece[] };
}

export type DrawReason = 'stalemate' | 'insufficient_material' | 'threefold_repetition' | 'fifty_move_rule' | 'agreement';

export type GameMode = 'hvh' | 'hva' | 'ava';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'master';
export type AppView = 'home' | 'play' | 'puzzles' | 'learn' | 'analysis' | 'leaderboard' | 'settings';

export interface GameConfig {
  mode: GameMode;
  difficulty: Difficulty;
  playerColor: PieceColor;
  timeControl?: TimeControl;
}

export interface TimeControl {
  initial: number;
  increment: number;
}

export interface EvalResult {
  score: number;
  bestMove?: Move;
  depth: number;
  nodes: number;
  pv: Move[];
}

export const PIECE_VALUES: Record<PieceType, number> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 20000,
};

export const PIECE_SYMBOLS: Record<PieceType, string> = {
  king: 'K',
  queen: 'Q',
  rook: 'R',
  bishop: 'B',
  knight: 'N',
  pawn: '',
};

export const FILE_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANK_NUMBERS = ['8', '7', '6', '5', '4', '3', '2', '1'];
