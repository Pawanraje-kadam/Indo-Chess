import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import Board from './Board';
import EvalBar from './EvalBar';
import MoveList from './MoveList';
import GameControls from './GameControls';
import PlayerInfo from './PlayerInfo';
import ToolsPanel from './ToolsPanel';

export default function GameView() {
  const { 
    gameState, 
    gameConfig, 
    boardFlipped, 
    isThinking, 
    playerName,
    evaluation,
    view
  } = useGameStore();

  const [showMobileSheet, setShowMobileSheet] = useState(false);

  const { turn, capturedPieces } = gameState;

  // Determine if we're in analysis mode
  const isAnalysisMode = view === 'analysis';

  const getPlayerName = (color: 'white' | 'black') => {
    if (gameConfig.mode === 'hvh') return color === 'white' ? 'Player 1' : 'Player 2';
    if (gameConfig.mode === 'hva') return color === gameConfig.playerColor ? 'You' : 'MindMove AI';
    return `AI ${color === 'white' ? '1' : '2'}`;
  };

  const topColor = boardFlipped ? 'white' : 'black';
  const bottomColor = boardFlipped ? 'black' : 'white';

  return (
    <div className="game-container">
      {/* ==================== BOARD SECTION ==================== */}
      <div className="board-section w-full max-w-[620px]">
        {/* Top Player */}
        <div className="w-full mb-2">
          <PlayerInfo
            color={topColor}
            name={getPlayerName(topColor)}
            isActive={turn === topColor && !gameState.isGameOver}
            captured={capturedPieces[topColor]}
            isThinking={isThinking && turn === topColor}
          />
        </div>

        {/* Board + Eval Bar */}
        <div className="board-with-eval flex gap-3 items-stretch w-full">
          {/* Evaluation Bar (Desktop + Analysis) */}
          <div className="hidden md:block">
            <EvalBar evaluation={evaluation} />
          </div>

          {/* Chess Board */}
          <div className="board-frame flex-1">
            <Board 
              showArrows={isAnalysisMode} 
              bestMove={isAnalysisMode ? null : null} // Connect with engine later
            />
          </div>
        </div>

        {/* Bottom Player */}
        <div className="w-full mt-2">
          <PlayerInfo
            color={bottomColor}
            name={getPlayerName(bottomColor)}
            isActive={turn === bottomColor && !gameState.isGameOver}
            captured={capturedPieces[bottomColor]}
            isThinking={isThinking && turn === bottomColor}
          />
        </div>

        {/* Mobile Controls */}
        <div className="lg:hidden mt-4 w-full">
          <MobileControls onOpenSheet={() => setShowMobileSheet(true)} />
        </div>
      </div>

      {/* ==================== DESKTOP RIGHT PANEL ==================== */}
      <div className="game-panel hidden lg:flex">
        <div className="card flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            <MoveList />
          </div>
          <GameControls />
        </div>

        <div className="card h-[200px]">
          <ToolsPanel />
        </div>
      </div>

      {/* ==================== MOBILE BOTTOM SHEET ==================== */}
      {showMobileSheet && (
        <MobileSheet onClose={() => setShowMobileSheet(false)} />
      )}
    </div>
  );
}

/* ==================== MOBILE CONTROLS ==================== */
function MobileControls({ onOpenSheet }: { onOpenSheet: () => void }) {
  const { undoMove, redoMove, flipBoard, historyIndex, gameHistory, gameState } = useGameStore();

  const canUndo = historyIndex > 0 && !gameState.isGameOver;
  const canRedo = historyIndex < gameHistory.length - 1;

  return (
    <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#111827] border border-white/10">
      <div className="control-group">
        <button onClick={undoMove} disabled={!canUndo} className="control-btn" title="Undo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
          </svg>
        </button>
        <button onClick={redoMove} disabled={!canRedo} className="control-btn" title="Redo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 text-center text-sm font-medium text-white/70">
        {gameState.isGameOver 
          ? (gameState.isCheckmate ? 'Checkmate' : gameState.isDraw ? 'Draw' : 'Game Over')
          : `Move ${Math.ceil(gameState.moveHistory.length / 2) || '—'}`}
      </div>

      <button onClick={flipBoard} className="control-btn" title="Flip Board">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"/>
        </svg>
      </button>

      <button 
        onClick={onOpenSheet}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#3d9cf5] text-black"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
        </svg>
      </button>
    </div>
  );
}

/* ==================== MOBILE SHEET ==================== */
function MobileSheet({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'moves' | 'tools'>('moves');

  return (
    <>
      <div 
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose} 
      />
      <div className="bottom-sheet z-[51]">
        <div className="bottom-sheet-handle" />
        
        <div className="bottom-sheet-tabs">
          {(['moves', 'tools'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`bottom-sheet-tab ${tab === t ? 'bottom-sheet-tab-active' : 'bottom-sheet-tab-inactive'}`}
            >
              {t === 'moves' ? 'Moves' : 'Tools'}
            </button>
          ))}
        </div>

        <div className="bottom-sheet-content h-[380px]">
          {tab === 'moves' ? (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-hidden">
                <MoveList />
              </div>
              <GameControls />
            </div>
          ) : (
            <ToolsPanel />
          )}
        </div>
      </div>
    </>
  );
}
