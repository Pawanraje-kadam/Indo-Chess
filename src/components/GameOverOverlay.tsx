import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { sounds } from '../utils/sounds';

export default function GameOverOverlay() {
  const { gameState, newGame, gameConfig, setView } = useGameStore();

  useEffect(() => {
    if (gameState.isGameOver) sounds.gameEnd();
  }, [gameState.isGameOver]);

  if (!gameState.isGameOver) return null;

  let icon = '🏆'; let title = ''; let subtitle = ''; let color = 'var(--accent)';

  if (gameState.isCheckmate) {
    icon = gameState.winner === 'white' ? '♔' : '♚';
    title = 'Checkmate';
    subtitle = `${gameState.winner === 'white' ? 'White' : 'Black'} wins!`;
    color = 'var(--success)';
  } else if (gameState.isDraw) {
    icon = '🤝'; title = 'Draw';
    subtitle = gameState.drawReason?.replace(/_/g, ' ') || 'Game drawn';
    color = 'var(--warning)';
  } else if (gameState.winner) {
    icon = '🏳️'; title = 'Resigned';
    subtitle = `${gameState.winner === 'white' ? 'White' : 'Black'} wins`;
    color = 'var(--error)';
  }

  const totalMoves = Math.ceil(gameState.moveHistory.length / 2);

  return (
    <div className="overlay animate-fade-in" style={{ position:'absolute', borderRadius:'var(--radius)' }}>
      <div className="modal animate-fade-in-scale" style={{ boxShadow:`0 0 60px ${color}28, var(--shadow-xl)` }}>
        <div style={{ height:4, background:`linear-gradient(90deg,${color},transparent)` }} />
        <div className="modal-body">
          <div className="modal-icon">{icon}</div>
          <div className="modal-title" style={{ color }}>{title}</div>
          <div className="modal-subtitle">{subtitle}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            <div style={{ padding:'10px 12px', borderRadius:'var(--radius)', background:'var(--bg)', border:'1px solid var(--border)', textAlign:'center' }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>Moves</div>
              <div style={{ fontSize:20, fontWeight:700, color:'var(--text)' }}>{totalMoves}</div>
            </div>
            <div style={{ padding:'10px 12px', borderRadius:'var(--radius)', background:'var(--bg)', border:'1px solid var(--border)', textAlign:'center' }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>Result</div>
              <div style={{ fontSize:20, fontWeight:700, color }}>
                {gameState.isCheckmate ? (gameState.winner === 'white' ? '1-0' : '0-1') : '½-½'}
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button onClick={() => { sounds.gameStart(); newGame(gameConfig); }} className="btn btn-primary w-full btn-lg">
              Play Again
            </button>
            <button onClick={() => setView('home')} className="btn btn-secondary w-full">
              Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
