import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import Board from './Board';
import EvalBar from './EvalBar';
import MoveList from './MoveList';
import GameControls from './GameControls';
import PlayerInfo from './PlayerInfo';
import ToolsPanel from './ToolsPanel';

export default function GameView() {
  const { gameState, gameConfig, boardFlipped, isThinking, playerName } = useGameStore();
  const [showMobileSheet, setShowMobileSheet] = useState(false);

  const { turn, capturedPieces } = gameState;

  const getPlayerName = (color: 'white' | 'black') => {
    if (gameConfig.mode === 'hvh') return color === 'white' ? 'Player 1' : 'Player 2';
    if (gameConfig.mode === 'hva') return color === gameConfig.playerColor ? 'You' : 'MindMove AI';
    return `AI ${color === 'white' ? '1' : '2'}`;
  };

  const topColor = boardFlipped ? 'white' : 'black';
  const bottomColor = boardFlipped ? 'black' : 'white';

  return (
    <div className="game-container">

      {/* Board Section */}
      <div className="board-section">

        {/* Top Player */}
        <div style={{ width:'100%', marginBottom:8 }}>
          <PlayerInfo
            color={topColor}
            name={getPlayerName(topColor)}
            isActive={turn === topColor && !gameState.isGameOver}
            captured={capturedPieces[topColor]}
            isThinking={isThinking && turn === topColor}
          />
        </div>

        {/* Board + Eval */}
        <div className="board-with-eval">
          <div className="hidden md:block">
            <EvalBar />
          </div>
          <div className="board-frame">
            <Board />
          </div>
        </div>

        {/* Bottom Player */}
        <div style={{ width:'100%', marginTop:8 }}>
          <PlayerInfo
            color={bottomColor}
            name={getPlayerName(bottomColor)}
            isActive={turn === bottomColor && !gameState.isGameOver}
            captured={capturedPieces[bottomColor]}
            isThinking={isThinking && turn === bottomColor}
          />
        </div>

        {/* Mobile Controls */}
        <div className="lg:hidden" style={{ width:'100%', marginTop:10 }}>
          <MobileControls onOpenSheet={() => setShowMobileSheet(true)} />
        </div>
      </div>

      {/* Desktop Panel */}
      <div className="game-panel">
        <div className="card" style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
          <div style={{ flex:1, minHeight:0, overflow:'hidden' }}>
            <MoveList />
          </div>
          <GameControls />
        </div>
        <div className="card" style={{ height:180 }}>
          <ToolsPanel />
        </div>
      </div>

      {/* Mobile Sheet */}
      {showMobileSheet && <MobileSheet onClose={() => setShowMobileSheet(false)} />}
    </div>
  );
}

function MobileControls({ onOpenSheet }: { onOpenSheet: () => void }) {
  const { undoMove, redoMove, flipBoard, historyIndex, gameHistory, gameState } = useGameStore();
  const canUndo = historyIndex > 0 && !gameState.isGameOver;
  const canRedo = historyIndex < gameHistory.length - 1;

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8, padding:'10px 12px',
      borderRadius:12, background:'var(--raised)', border:'1px solid var(--border-subtle)',
    }}>
      <div className="control-group">
        <button onClick={undoMove} disabled={!canUndo} className="control-btn" title="Takeback">
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

      <div style={{ flex:1, textAlign:'center' }}>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)' }}>
          {gameState.isGameOver
            ? (gameState.isCheckmate ? '♔ Checkmate' : gameState.isDraw ? '½-½ Draw' : '🏳 Resigned')
            : `Move ${Math.ceil(gameState.moveHistory.length / 2) || '—'}`}
        </span>
      </div>

      <button onClick={flipBoard} className="control-btn" title="Flip board">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"/>
        </svg>
      </button>

      <button onClick={onOpenSheet}
        style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, border:'none', background:'var(--accent)', color:'#fff', cursor:'pointer' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
        </svg>
      </button>
    </div>
  );
}

function MobileSheet({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'moves' | 'tools'>('moves');
  return (
    <>
      <div className="fixed inset-0 z-50 animate-fade-in"
        style={{ background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}
        onClick={onClose} />
      <div className="bottom-sheet animate-slide-up" style={{ zIndex:51 }}>
        <div className="bottom-sheet-handle" />
        <div className="bottom-sheet-tabs">
          {(['moves','tools'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`bottom-sheet-tab ${tab === t ? 'bottom-sheet-tab-active' : 'bottom-sheet-tab-inactive'}`}>
              {t === 'moves' ? 'Moves' : 'Tools'}
            </button>
          ))}
        </div>
        <div className="bottom-sheet-content" style={{ height:340 }}>
          {tab === 'moves' ? (
            <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
              <div style={{ flex:1, overflow:'hidden' }}><MoveList /></div>
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
