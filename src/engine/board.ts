import {
  Board, Piece, PieceColor, PieceType, Position, Move,
  CastlingRights, GameState, Square,
  FILE_LETTERS, PIECE_SYMBOLS,
} from './types';

/** Create initial board position */
export function createInitialBoard(): Board {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));

  const backRank: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: backRank[col], color: 'black' };
    board[1][col] = { type: 'pawn', color: 'black' };
    board[6][col] = { type: 'pawn', color: 'white' };
    board[7][col] = { type: backRank[col], color: 'white' };
  }
  return board;
}

export function createInitialGameState(): GameState {
  const board = createInitialBoard();
  const state: GameState = {
    board,
    turn: 'white',
    castlingRights: {
      whiteKingside: true, whiteQueenside: true,
      blackKingside: true, blackQueenside: true,
    },
    enPassantTarget: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    moveHistory: [],
    positionHistory: [],
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    isDraw: false,
    isGameOver: false,
    capturedPieces: { white: [], black: [] },
  };
  state.positionHistory.push(boardToFENPosition(state));
  return state;
}

export function cloneBoard(board: Board): Board {
  return board.map(row => row.map(sq => sq ? { ...sq } : null));
}

export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    board: cloneBoard(state.board),
    castlingRights: { ...state.castlingRights },
    enPassantTarget: state.enPassantTarget ? { ...state.enPassantTarget } : null,
    moveHistory: [...state.moveHistory],
    positionHistory: [...state.positionHistory],
    capturedPieces: {
      white: [...state.capturedPieces.white],
      black: [...state.capturedPieces.black],
    },
  };
}

export function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function getPieceAt(board: Board, pos: Position): Square {
  return board[pos.row][pos.col];
}

export function findKing(board: Board, color: PieceColor): Position {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'king' && p.color === color) return { row: r, col: c };
    }
  }
  return { row: 0, col: 0 };
}

export function isSquareAttacked(board: Board, pos: Position, byColor: PieceColor): boolean {
  const { row, col } = pos;

  // Knight attacks
  const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (const [dr, dc] of knightMoves) {
    const r = row + dr, c = col + dc;
    if (isInBounds(r, c)) {
      const p = board[r][c];
      if (p && p.color === byColor && p.type === 'knight') return true;
    }
  }

  // Pawn attacks
  const pawnDir = byColor === 'white' ? 1 : -1;
  for (const dc of [-1, 1]) {
    const r = row + pawnDir, c = col + dc;
    if (isInBounds(r, c)) {
      const p = board[r][c];
      if (p && p.color === byColor && p.type === 'pawn') return true;
    }
  }

  // King attacks
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr, c = col + dc;
      if (isInBounds(r, c)) {
        const p = board[r][c];
        if (p && p.color === byColor && p.type === 'king') return true;
      }
    }
  }

  // Sliding pieces: bishop/queen diagonals
  const diagonals = [[-1,-1],[-1,1],[1,-1],[1,1]];
  for (const [dr, dc] of diagonals) {
    let r = row + dr, c = col + dc;
    while (isInBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === byColor && (p.type === 'bishop' || p.type === 'queen')) return true;
        break;
      }
      r += dr; c += dc;
    }
  }

  // Sliding pieces: rook/queen straights
  const straights = [[-1,0],[1,0],[0,-1],[0,1]];
  for (const [dr, dc] of straights) {
    let r = row + dr, c = col + dc;
    while (isInBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === byColor && (p.type === 'rook' || p.type === 'queen')) return true;
        break;
      }
      r += dr; c += dc;
    }
  }

  return false;
}

export function isInCheck(board: Board, color: PieceColor): boolean {
  const kingPos = findKing(board, color);
  return isSquareAttacked(board, kingPos, color === 'white' ? 'black' : 'white');
}

/** Generate all pseudo-legal moves for a color (not checking for self-check) */
function generatePseudoLegalMoves(state: GameState, color: PieceColor): Move[] {
  const moves: Move[] = [];
  const { board, enPassantTarget, castlingRights } = state;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) continue;

      const from: Position = { row, col };

      switch (piece.type) {
        case 'pawn': {
          const dir = color === 'white' ? -1 : 1;
          const startRow = color === 'white' ? 6 : 1;
          const promoRow = color === 'white' ? 0 : 7;

          // Single push
          const fr = row + dir;
          if (isInBounds(fr, col) && !board[fr][col]) {
            if (fr === promoRow) {
              for (const promo of ['queen', 'rook', 'bishop', 'knight'] as PieceType[]) {
                moves.push({ from, to: { row: fr, col }, piece, promotion: promo });
              }
            } else {
              moves.push({ from, to: { row: fr, col }, piece });
            }

            // Double push
            if (row === startRow) {
              const fr2 = row + 2 * dir;
              if (!board[fr2][col]) {
                moves.push({ from, to: { row: fr2, col }, piece });
              }
            }
          }

          // Captures
          for (const dc of [-1, 1]) {
            const c = col + dc;
            if (!isInBounds(fr, c)) continue;
            const target = board[fr][c];
            if (target && target.color !== color) {
              if (fr === promoRow) {
                for (const promo of ['queen', 'rook', 'bishop', 'knight'] as PieceType[]) {
                  moves.push({ from, to: { row: fr, col: c }, piece, captured: target, promotion: promo });
                }
              } else {
                moves.push({ from, to: { row: fr, col: c }, piece, captured: target });
              }
            }

            // En passant
            if (enPassantTarget && fr === enPassantTarget.row && c === enPassantTarget.col) {
              const capturedPawn = board[row][c];
              moves.push({
                from, to: { row: fr, col: c }, piece,
                captured: capturedPawn || { type: 'pawn', color: color === 'white' ? 'black' : 'white' },
                isEnPassant: true,
              });
            }
          }
          break;
        }

        case 'knight': {
          const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
          for (const [dr, dc] of offsets) {
            const r = row + dr, c = col + dc;
            if (!isInBounds(r, c)) continue;
            const target = board[r][c];
            if (!target || target.color !== color) {
              moves.push({ from, to: { row: r, col: c }, piece, captured: target || undefined });
            }
          }
          break;
        }

        case 'bishop': {
          const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
          for (const [dr, dc] of dirs) {
            let r = row + dr, c = col + dc;
            while (isInBounds(r, c)) {
              const target = board[r][c];
              if (target) {
                if (target.color !== color) moves.push({ from, to: { row: r, col: c }, piece, captured: target });
                break;
              }
              moves.push({ from, to: { row: r, col: c }, piece });
              r += dr; c += dc;
            }
          }
          break;
        }

        case 'rook': {
          const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
          for (const [dr, dc] of dirs) {
            let r = row + dr, c = col + dc;
            while (isInBounds(r, c)) {
              const target = board[r][c];
              if (target) {
                if (target.color !== color) moves.push({ from, to: { row: r, col: c }, piece, captured: target });
                break;
              }
              moves.push({ from, to: { row: r, col: c }, piece });
              r += dr; c += dc;
            }
          }
          break;
        }

        case 'queen': {
          const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
          for (const [dr, dc] of dirs) {
            let r = row + dr, c = col + dc;
            while (isInBounds(r, c)) {
              const target = board[r][c];
              if (target) {
                if (target.color !== color) moves.push({ from, to: { row: r, col: c }, piece, captured: target });
                break;
              }
              moves.push({ from, to: { row: r, col: c }, piece });
              r += dr; c += dc;
            }
          }
          break;
        }

        case 'king': {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const r = row + dr, c = col + dc;
              if (!isInBounds(r, c)) continue;
              const target = board[r][c];
              if (!target || target.color !== color) {
                moves.push({ from, to: { row: r, col: c }, piece, captured: target || undefined });
              }
            }
          }

          // Castling
          const kingRow = color === 'white' ? 7 : 0;
          if (row === kingRow && col === 4) {
            const enemy = color === 'white' ? 'black' : 'white';
            // Kingside
            const ksRight = color === 'white' ? castlingRights.whiteKingside : castlingRights.blackKingside;
            if (ksRight && !board[kingRow][5] && !board[kingRow][6]
              && board[kingRow][7]?.type === 'rook' && board[kingRow][7]?.color === color
              && !isSquareAttacked(board, { row: kingRow, col: 4 }, enemy)
              && !isSquareAttacked(board, { row: kingRow, col: 5 }, enemy)
              && !isSquareAttacked(board, { row: kingRow, col: 6 }, enemy)) {
              moves.push({
                from, to: { row: kingRow, col: 6 }, piece,
                isCastle: true, isKingsideCastle: true,
              });
            }
            // Queenside
            const qsRight = color === 'white' ? castlingRights.whiteQueenside : castlingRights.blackQueenside;
            if (qsRight && !board[kingRow][3] && !board[kingRow][2] && !board[kingRow][1]
              && board[kingRow][0]?.type === 'rook' && board[kingRow][0]?.color === color
              && !isSquareAttacked(board, { row: kingRow, col: 4 }, enemy)
              && !isSquareAttacked(board, { row: kingRow, col: 3 }, enemy)
              && !isSquareAttacked(board, { row: kingRow, col: 2 }, enemy)) {
              moves.push({
                from, to: { row: kingRow, col: 2 }, piece,
                isCastle: true, isQueensideCastle: true,
              });
            }
          }
          break;
        }
      }
    }
  }
  return moves;
}

/** Generate all legal moves */
export function generateLegalMoves(state: GameState, color?: PieceColor): Move[] {
  const c = color || state.turn;
  const pseudoMoves = generatePseudoLegalMoves(state, c);
  const legalMoves: Move[] = [];

  for (const move of pseudoMoves) {
    const newBoard = cloneBoard(state.board);
    applyMoveToBoard(newBoard, move);
    if (!isInCheck(newBoard, c)) {
      // Check if this move gives check or checkmate
      const enemy = c === 'white' ? 'black' : 'white';
      move.isCheck = isInCheck(newBoard, enemy);
      move.san = moveToSAN(state, move);
      legalMoves.push(move);
    }
  }
  return legalMoves;
}

/** Get legal moves from a specific square */
export function getLegalMovesFromSquare(state: GameState, pos: Position): Move[] {
  return generateLegalMoves(state).filter(m => m.from.row === pos.row && m.from.col === pos.col);
}

/** Apply a move directly to a board (mutating) */
export function applyMoveToBoard(board: Board, move: Move): void {
  const { from, to } = move;

  // En passant capture
  if (move.isEnPassant) {
    board[from.row][to.col] = null;
  }

  // Castling - move rook
  if (move.isCastle) {
    const row = from.row;
    if (move.isKingsideCastle) {
      board[row][5] = board[row][7];
      board[row][7] = null;
    } else {
      board[row][3] = board[row][0];
      board[row][0] = null;
    }
  }

  // Move piece
  board[to.row][to.col] = move.promotion
    ? { type: move.promotion, color: move.piece.color }
    : board[from.row][from.col];
  board[from.row][from.col] = null;
}

/** Make a move and return new game state */
export function makeMove(state: GameState, move: Move): GameState {
  const newState = cloneGameState(state);
  const { board } = newState;

  // Track captured pieces
  if (move.captured) {
    if (move.piece.color === 'white') {
      newState.capturedPieces.white.push(move.captured);
    } else {
      newState.capturedPieces.black.push(move.captured);
    }
  }

  applyMoveToBoard(board, move);

  // Update castling rights
  if (move.piece.type === 'king') {
    if (move.piece.color === 'white') {
      newState.castlingRights.whiteKingside = false;
      newState.castlingRights.whiteQueenside = false;
    } else {
      newState.castlingRights.blackKingside = false;
      newState.castlingRights.blackQueenside = false;
    }
  }
  if (move.piece.type === 'rook') {
    if (move.from.row === 7 && move.from.col === 0) newState.castlingRights.whiteQueenside = false;
    if (move.from.row === 7 && move.from.col === 7) newState.castlingRights.whiteKingside = false;
    if (move.from.row === 0 && move.from.col === 0) newState.castlingRights.blackQueenside = false;
    if (move.from.row === 0 && move.from.col === 7) newState.castlingRights.blackKingside = false;
  }
  // If a rook is captured on its starting square
  if (move.to.row === 7 && move.to.col === 0) newState.castlingRights.whiteQueenside = false;
  if (move.to.row === 7 && move.to.col === 7) newState.castlingRights.whiteKingside = false;
  if (move.to.row === 0 && move.to.col === 0) newState.castlingRights.blackQueenside = false;
  if (move.to.row === 0 && move.to.col === 7) newState.castlingRights.blackKingside = false;

  // Update en passant target
  if (move.piece.type === 'pawn' && Math.abs(move.from.row - move.to.row) === 2) {
    newState.enPassantTarget = {
      row: (move.from.row + move.to.row) / 2,
      col: move.from.col,
    };
  } else {
    newState.enPassantTarget = null;
  }

  // Update clocks
  if (move.piece.type === 'pawn' || move.captured) {
    newState.halfMoveClock = 0;
  } else {
    newState.halfMoveClock++;
  }
  if (state.turn === 'black') {
    newState.fullMoveNumber++;
  }

  // Switch turn
  newState.turn = state.turn === 'white' ? 'black' : 'white';
  newState.moveHistory.push(move);

  // Position tracking for repetition
  const posKey = boardToFENPosition(newState);
  newState.positionHistory.push(posKey);

  // Check game status
  const enemyMoves = generateLegalMoves(newState);
  newState.isCheck = isInCheck(newState.board, newState.turn);

  if (enemyMoves.length === 0) {
    newState.isGameOver = true;
    if (newState.isCheck) {
      newState.isCheckmate = true;
      newState.winner = state.turn;
      // Update the SAN of the last move
      if (move.san) {
        move.san = move.san.replace(/\+$/, '#');
        if (!move.san.endsWith('#')) move.san += '#';
      }
      move.isCheckmate = true;
    } else {
      newState.isStalemate = true;
      newState.isDraw = true;
      newState.drawReason = 'stalemate';
    }
  }

  // Fifty-move rule
  if (newState.halfMoveClock >= 100) {
    newState.isDraw = true;
    newState.isGameOver = true;
    newState.drawReason = 'fifty_move_rule';
  }

  // Threefold repetition
  const currentPos = posKey;
  const count = newState.positionHistory.filter(p => p === currentPos).length;
  if (count >= 3) {
    newState.isDraw = true;
    newState.isGameOver = true;
    newState.drawReason = 'threefold_repetition';
  }

  // Insufficient material
  if (isInsufficientMaterial(newState.board)) {
    newState.isDraw = true;
    newState.isGameOver = true;
    newState.drawReason = 'insufficient_material';
  }

  return newState;
}

function isInsufficientMaterial(board: Board): boolean {
  const pieces: Piece[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]) pieces.push(board[r][c]!);
    }
  }

  // King vs King
  if (pieces.length === 2) return true;
  // King + minor vs King
  if (pieces.length === 3) {
    const nonKing = pieces.find(p => p.type !== 'king');
    if (nonKing && (nonKing.type === 'bishop' || nonKing.type === 'knight')) return true;
  }
  // King + Bishop vs King + Bishop (same color bishops)
  if (pieces.length === 4) {
    const bishops = pieces.filter(p => p.type === 'bishop');
    if (bishops.length === 2 && bishops[0].color !== bishops[1].color) {
      // Check if bishops are on same color square
      const bishopSquares: number[] = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (board[r][c]?.type === 'bishop') {
            bishopSquares.push((r + c) % 2);
          }
        }
      }
      if (bishopSquares.length === 2 && bishopSquares[0] === bishopSquares[1]) return true;
    }
  }
  return false;
}

/** Convert board position to a FEN-like string for repetition tracking */
export function boardToFENPosition(state: GameState): string {
  let fen = '';
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) { empty++; continue; }
      if (empty > 0) { fen += empty; empty = 0; }
      const ch = pieceToFENChar(p);
      fen += ch;
    }
    if (empty > 0) fen += empty;
    if (r < 7) fen += '/';
  }
  fen += ` ${state.turn[0]}`;
  let castling = '';
  if (state.castlingRights.whiteKingside) castling += 'K';
  if (state.castlingRights.whiteQueenside) castling += 'Q';
  if (state.castlingRights.blackKingside) castling += 'k';
  if (state.castlingRights.blackQueenside) castling += 'q';
  fen += ` ${castling || '-'}`;
  if (state.enPassantTarget) {
    fen += ` ${FILE_LETTERS[state.enPassantTarget.col]}${8 - state.enPassantTarget.row}`;
  } else {
    fen += ' -';
  }
  return fen;
}

export function gameStateToFEN(state: GameState): string {
  return `${boardToFENPosition(state)} ${state.halfMoveClock} ${state.fullMoveNumber}`;
}

export function fenToGameState(fen: string): GameState {
  const parts = fen.trim().split(/\s+/);
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));
  const rows = parts[0].split('/');

  for (let r = 0; r < 8; r++) {
    let c = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        c += parseInt(ch);
      } else {
        board[r][c] = fenCharToPiece(ch);
        c++;
      }
    }
  }

  const turn: PieceColor = parts[1] === 'b' ? 'black' : 'white';
  const castling = parts[2] || '-';
  const castlingRights: CastlingRights = {
    whiteKingside: castling.includes('K'),
    whiteQueenside: castling.includes('Q'),
    blackKingside: castling.includes('k'),
    blackQueenside: castling.includes('q'),
  };

  let enPassantTarget: Position | null = null;
  if (parts[3] && parts[3] !== '-') {
    const file = parts[3].charCodeAt(0) - 97;
    const rank = 8 - parseInt(parts[3][1]);
    enPassantTarget = { row: rank, col: file };
  }

  const state: GameState = {
    board, turn, castlingRights, enPassantTarget,
    halfMoveClock: parseInt(parts[4] || '0'),
    fullMoveNumber: parseInt(parts[5] || '1'),
    moveHistory: [],
    positionHistory: [],
    isCheck: false, isCheckmate: false, isStalemate: false,
    isDraw: false, isGameOver: false,
    capturedPieces: { white: [], black: [] },
  };

  state.isCheck = isInCheck(board, turn);
  const legalMoves = generateLegalMoves(state);
  if (legalMoves.length === 0) {
    state.isGameOver = true;
    if (state.isCheck) {
      state.isCheckmate = true;
      state.winner = turn === 'white' ? 'black' : 'white';
    } else {
      state.isStalemate = true;
      state.isDraw = true;
      state.drawReason = 'stalemate';
    }
  }

  state.positionHistory.push(boardToFENPosition(state));
  return state;
}

function pieceToFENChar(p: Piece): string {
  const map: Record<PieceType, string> = {
    king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p',
  };
  const ch = map[p.type];
  return p.color === 'white' ? ch.toUpperCase() : ch;
}

function fenCharToPiece(ch: string): Piece {
  const color: PieceColor = ch === ch.toUpperCase() ? 'white' : 'black';
  const map: Record<string, PieceType> = {
    k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn',
  };
  return { type: map[ch.toLowerCase()], color };
}

/** Convert move to Standard Algebraic Notation */
function moveToSAN(state: GameState, move: Move): string {
  if (move.isKingsideCastle) return 'O-O' + (move.isCheck ? '+' : '');
  if (move.isQueensideCastle) return 'O-O-O' + (move.isCheck ? '+' : '');

  let san = '';
  const { piece, from, to, captured, promotion } = move;

  if (piece.type !== 'pawn') {
    san += PIECE_SYMBOLS[piece.type];

    // Disambiguation
    const allMoves = generatePseudoLegalMovesForSAN(state, state.turn);
    const ambiguous = allMoves.filter(m =>
      m.piece.type === piece.type &&
      m.to.row === to.row && m.to.col === to.col &&
      (m.from.row !== from.row || m.from.col !== from.col)
    );

    if (ambiguous.length > 0) {
      const sameFile = ambiguous.some(m => m.from.col === from.col);
      const sameRank = ambiguous.some(m => m.from.row === from.row);
      if (!sameFile) {
        san += FILE_LETTERS[from.col];
      } else if (!sameRank) {
        san += (8 - from.row);
      } else {
        san += FILE_LETTERS[from.col] + (8 - from.row);
      }
    }
  } else if (captured) {
    san += FILE_LETTERS[from.col];
  }

  if (captured) san += 'x';
  san += FILE_LETTERS[to.col] + (8 - to.row);
  if (promotion) san += '=' + PIECE_SYMBOLS[promotion];
  if (move.isCheck) san += '+';

  return san;
}

function generatePseudoLegalMovesForSAN(state: GameState, color: PieceColor): Move[] {
  // Minimal version for SAN disambiguation - we just need piece type and positions
  const moves: Move[] = [];
  const { board } = state;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color || piece.type === 'pawn') continue;
      const from: Position = { row, col };
      const directions = getDirections(piece.type);
      const sliding = piece.type !== 'knight' && piece.type !== 'king';

      for (const [dr, dc] of directions) {
        let r = row + dr, c = col + dc;
        while (isInBounds(r, c)) {
          const target = board[r][c];
          if (!target || target.color !== color) {
            moves.push({ from, to: { row: r, col: c }, piece });
          }
          if (target || !sliding) break;
          r += dr; c += dc;
        }
      }
    }
  }
  return moves;
}

function getDirections(type: PieceType): number[][] {
  switch (type) {
    case 'knight': return [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    case 'bishop': return [[-1,-1],[-1,1],[1,-1],[1,1]];
    case 'rook': return [[-1,0],[1,0],[0,-1],[0,1]];
    case 'queen':
    case 'king': return [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    default: return [];
  }
}

/** PGN Export */
export function exportPGN(state: GameState, headers?: Record<string, string>): string {
  const defaultHeaders: Record<string, string> = {
    Event: 'Indo Chess Game',
    Site: 'Indo Chess Platform',
    Date: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
    Round: '1',
    White: 'Player 1',
    Black: 'Player 2',
    Result: getResult(state),
    ...headers,
  };

  let pgn = '';
  for (const [key, value] of Object.entries(defaultHeaders)) {
    pgn += `[${key} "${value}"]\n`;
  }
  pgn += '\n';

  const moves = state.moveHistory;
  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) pgn += `${Math.floor(i / 2) + 1}. `;
    pgn += (moves[i].san || '??') + ' ';
  }
  pgn += getResult(state);

  return pgn;
}

function getResult(state: GameState): string {
  if (!state.isGameOver) return '*';
  if (state.isDraw) return '1/2-1/2';
  return state.winner === 'white' ? '1-0' : '0-1';
}

/** Import PGN - returns moves to replay */
export function parsePGN(pgn: string): string[] {
  const moveSection = pgn.replace(/\[.*?\]\s*/g, '').replace(/\{.*?\}/g, '').trim();
  const tokens = moveSection.split(/\s+/).filter(t =>
    t && !t.match(/^\d+\./) && t !== '1-0' && t !== '0-1' && t !== '1/2-1/2' && t !== '*'
  );
  return tokens;
}

export function findMoveFromSAN(state: GameState, san: string): Move | null {
  const legalMoves = generateLegalMoves(state);
  for (const move of legalMoves) {
    if (move.san === san || move.san === san.replace(/[+#!?]/g, '')) return move;
    // Try without check symbols
    const cleanSan = (move.san || '').replace(/[+#]/g, '');
    const cleanInput = san.replace(/[+#!?]/g, '');
    if (cleanSan === cleanInput) return move;
  }
  return null;
}
