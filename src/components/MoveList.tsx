import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';

export default function MoveList() {
  const { gameState, historyIndex, goToMove, exportGamePGN } = useGameStore();
  const moves = gameState.moveHistory;
  const activeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [historyIndex]);

  const pairs: { num: number; white?: string; black?: string; wIdx: number; bIdx: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({ num: Math.floor(i / 2) + 1, white: moves[i]?.san, black: moves[i + 1]?.san, wIdx: i + 1, bIdx: i + 2 });
  }

  const getMoveClass = (san?: string) => {
    if (!san) return '';
    if (san.includes('#')) return 'move-checkmate';
    if (san.includes('+')) return 'move-check';
    return '';
  };

  const copyPGN = () => {
    navigator.clipboard.writeText(exportGamePGN()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="move-list">
      <div className="move-list-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <h3>Moves</h3>
        <button
          onClick={copyPGN}
          title="Copy PGN"
          style={{
            fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:6,
            border:'1px solid var(--border)', background:'var(--bg)',
            color: copied ? 'var(--accent)' : 'var(--text-muted)',
            cursor:'pointer', transition:'all 150ms', letterSpacing:'0.04em',
          }}
        >
          {copied ? '✓ Copied' : 'PGN'}
        </button>
      </div>

      <div className="move-list-body">
        {pairs.length === 0 ? (
          <div className="move-list-empty">
            <div className="move-list-empty-icon">♟</div>
            <div className="move-list-empty-text">No moves yet</div>
          </div>
        ) : (
          pairs.map(pair => (
            <div key={pair.num} className="move-row">
              <div className="move-number">{pair.num}</div>
              <button
                ref={historyIndex === pair.wIdx ? activeRef : null}
                onClick={() => goToMove(pair.wIdx)}
                className={`move-cell ${historyIndex === pair.wIdx ? 'move-cell-active' : ''} ${getMoveClass(pair.white)}`}
              >
                {pair.white}
              </button>
              {pair.black !== undefined ? (
                <button
                  ref={historyIndex === pair.bIdx ? activeRef : null}
                  onClick={() => goToMove(pair.bIdx)}
                  className={`move-cell ${historyIndex === pair.bIdx ? 'move-cell-active' : ''} ${getMoveClass(pair.black)}`}
                >
                  {pair.black}
                </button>
              ) : (
                <div className="move-cell" />
              )}
            </div>
          ))
        )}
      </div>

      {gameState.isGameOver && (
        <div className="game-result">
          {gameState.isCheckmate && (
            <><div className="game-result-title result-win">Checkmate</div>
            <div className="game-result-subtitle">{gameState.winner === 'white' ? 'White' : 'Black'} wins</div></>
          )}
          {gameState.isDraw && (
            <><div className="game-result-title result-draw">Draw</div>
            <div className="game-result-subtitle">{gameState.drawReason?.replace(/_/g, ' ')}</div></>
          )}
          {!gameState.isCheckmate && !gameState.isDraw && gameState.winner && (
            <><div className="game-result-title result-loss">Resigned</div>
            <div className="game-result-subtitle">{gameState.winner === 'white' ? 'White' : 'Black'} wins</div></>
          )}
        </div>
      )}
    </div>
  );
}
