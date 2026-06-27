import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { AnalyzedMove } from '../engine/types';

const CLASS_COLOR: Record<string, string> = {
  brilliant: '#a78bfa', best: '#3d9cf5', excellent: '#4ade80',
  good: '#86efac', inaccuracy: '#fbbf24', mistake: '#fb923c', blunder: '#f87171',
  book: '#94a3b8', forced: '#94a3b8', great: '#4ade80',
};
const CLASS_SYMBOL: Record<string, string> = {
  brilliant: '!!', best: '', excellent: '!', good: '',
  inaccuracy: '?!', mistake: '?', blunder: '??', book: '', forced: '', great: '!',
};

interface MovePopup {
  moveIndex: number;
  x: number;
  y: number;
}

export default function AnalysisMoveList() {
  const { gameState, analyzedMoves, historyIndex, goToMove, exportGamePGN } = useGameStore();
  const moves = gameState.moveHistory;
  const activeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [popup, setPopup] = useState<MovePopup | null>(null);

  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [historyIndex]);

  const getAnalyzed = (moveIndex: number): AnalyzedMove | undefined =>
    analyzedMoves.find(m => m.moveIndex === moveIndex);

  const pairs: { num: number; wIdx: number; bIdx: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({ num: Math.floor(i / 2) + 1, wIdx: i + 1, bIdx: i + 2 });
  }

  const copyPGN = () => {
    navigator.clipboard.writeText(exportGamePGN()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleMoveClick = (moveIndex: number, e: React.MouseEvent) => {
    goToMove(moveIndex);
    const analyzed = getAnalyzed(moveIndex);
    if (analyzed && analyzed.classification !== 'best' && analyzed.classification !== 'good' && analyzed.classification !== 'excellent') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setPopup({ moveIndex, x: rect.left, y: rect.bottom });
    } else {
      setPopup(null);
    }
  };

  const renderMoveCell = (moveIndex: number) => {
    const move = moves[moveIndex - 1];
    if (!move) return <div className="move-cell" />;
    const analyzed = getAnalyzed(moveIndex);
    const cls = analyzed?.classification;
    const color = cls ? CLASS_COLOR[cls] : undefined;
    const sym = cls ? CLASS_SYMBOL[cls] : '';
    const isActive = historyIndex === moveIndex;
    const isKeyMoment = analyzed?.isKeyMoment;

    return (
      <button
        ref={isActive ? activeRef : null}
        onClick={e => handleMoveClick(moveIndex, e)}
        className={`move-cell ${isActive ? 'move-cell-active' : ''}`}
        style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          boxShadow: isKeyMoment ? `inset 0 0 0 1px ${color}40` : undefined,
          background: isKeyMoment && !isActive ? `${color}08` : undefined,
        }}
      >
        <span style={{ color: isActive ? 'var(--accent-bright)' : (cls === 'inaccuracy' || cls === 'mistake' || cls === 'blunder') ? 'var(--text)' : undefined }}>
          {move.san}
        </span>
        {sym && (
          <span style={{ fontSize:11, fontWeight:800, color: color || 'transparent', marginLeft:4, flexShrink:0 }}>
            {sym}
          </span>
        )}
      </button>
    );
  };

  // Popup for explaining a bad move
  const popupMove = popup ? getAnalyzed(popup.moveIndex) : null;

  return (
    <div className="move-list" onClick={() => setPopup(null)}>
      <div className="move-list-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <h3>Moves</h3>
        <button onClick={copyPGN} style={{
          fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:6,
          border:'1px solid var(--border)', background:'var(--bg)',
          color: copied ? 'var(--accent)' : 'var(--text-muted)',
          cursor:'pointer', transition:'all 150ms', letterSpacing:'0.04em',
        }}>
          {copied ? '✓ Copied' : 'PGN'}
        </button>
      </div>

      <div className="move-list-body">
        {pairs.length === 0 ? (
          <div className="move-list-empty">
            <div className="move-list-empty-icon">♟</div>
            <div className="move-list-empty-text">No moves to analyze</div>
          </div>
        ) : (
          pairs.map(pair => (
            <div key={pair.num} className="move-row">
              <div className="move-number">{pair.num}</div>
              {renderMoveCell(pair.wIdx)}
              {moves[pair.bIdx - 1] ? renderMoveCell(pair.bIdx) : <div className="move-cell" />}
            </div>
          ))
        )}
      </div>

      {/* Inline popup for bad moves */}
      {popupMove && popupMove.bestMove && (
        <div onClick={e => e.stopPropagation()} style={{
          position:'absolute', bottom:'100%', left:12, right:12, zIndex:60,
          background:'var(--raised)', border:'1px solid var(--border)',
          borderRadius:10, padding:'12px 14px', boxShadow:'var(--shadow-lg)',
          animation:'fadeInScale 150ms ease-out',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:12, fontWeight:700, color:CLASS_COLOR[popupMove.classification] }}>
              {CLASS_SYMBOL[popupMove.classification]} {popupMove.classification.charAt(0).toUpperCase() + popupMove.classification.slice(1)}
            </span>
            <button onClick={() => setPopup(null)} style={{ border:'none', background:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:16, lineHeight:1 }}>×</button>
          </div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>
            <span style={{ color:'var(--text)' }}>{popupMove.san}</span> lost{' '}
            <span style={{ color:CLASS_COLOR[popupMove.classification], fontWeight:700 }}>
              {(popupMove.evalLoss / 100).toFixed(1)} pawns
            </span>
            {popupMove.bestMove.san && (
              <> · Best was <span style={{ color:'var(--accent)', fontWeight:700 }}>{popupMove.bestMove.san}</span></>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
