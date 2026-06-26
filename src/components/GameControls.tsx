import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { sounds } from '../utils/sounds';

export default function GameControls() {
  const { undoMove, redoMove, flipBoard, resign, offerDraw, gameState, newGame, gameConfig, historyIndex, gameHistory, goToMove } = useGameStore();
  const [showConfirm, setShowConfirm] = useState<'resign' | 'draw' | null>(null);

  const canUndo = historyIndex > 0 && !gameState.isGameOver;
  const canRedo = historyIndex < gameHistory.length - 1;

  const handleResign = () => { resign(); sounds.gameEnd(); setShowConfirm(null); };
  const handleDraw   = () => { offerDraw(); setShowConfirm(null); };

  return (
    <div className="game-controls" style={{ position:'relative' }}>
      {/* Navigation */}
      <div className="control-group">
        <button onClick={() => goToMove(0)} disabled={!canUndo} className="control-btn" title="Start">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6 1.41-1.41zM6 6h2v12H6V6z"/></svg>
        </button>
        <button onClick={undoMove} disabled={!canUndo} className="control-btn" title="Takeback">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
        </button>
        <button onClick={redoMove} disabled={!canRedo} className="control-btn" title="Next">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
        </button>
        <button onClick={() => goToMove(gameHistory.length - 1)} disabled={!canRedo} className="control-btn" title="End">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6-1.41 1.41zM16 6h2v12h-2V6z"/></svg>
        </button>
      </div>

      <div style={{ flex:1 }} />

      {!gameState.isGameOver && (
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <button onClick={flipBoard} className="control-btn" title="Flip board">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"/></svg>
          </button>
          <button onClick={() => setShowConfirm('draw')} className="control-btn" title="Offer draw" style={{ fontSize:13, fontWeight:800 }}>½</button>
          <button onClick={() => setShowConfirm('resign')} className="control-btn control-btn-danger" title="Resign">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z"/></svg>
          </button>
        </div>
      )}

      {gameState.isGameOver && (
        <button onClick={() => { sounds.gameStart(); newGame(gameConfig); }} className="btn btn-primary btn-sm">
          New Game
        </button>
      )}

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="animate-fade-in-scale" style={{
          position:'absolute', bottom:'calc(100% + 8px)', left:0, right:0,
          padding:16, borderRadius:12, background:'var(--raised)',
          border:'1px solid var(--border)', boxShadow:'var(--shadow-lg)', zIndex:50,
        }}>
          <p style={{ fontSize:13, fontWeight:600, textAlign:'center', marginBottom:12, color:'var(--text)' }}>
            {showConfirm === 'resign' ? 'Resign this game?' : 'Offer a draw?'}
          </p>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setShowConfirm(null)} className="btn btn-secondary btn-sm" style={{ flex:1 }}>Cancel</button>
            <button
              onClick={showConfirm === 'resign' ? handleResign : handleDraw}
              className="btn btn-sm" style={{ flex:1, background: showConfirm === 'resign' ? 'var(--error)' : 'var(--warning)', color:'#000' }}>
              {showConfirm === 'resign' ? 'Resign' : 'Offer Draw'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
