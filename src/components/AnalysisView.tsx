import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import Board from './Board';
import EvalBar from './EvalBar';
import AnalysisMoveList from './AnalysisMoveList';
import GameSummaryPanel from './GameSummaryPanel';
import GameControls from './GameControls';

type Tab = 'summary' | 'moves';

export default function AnalysisView() {
  const { gameHistory, startAnalysis, analyzedMoves, analysisLoading, gameSummary, setView, goToMove, historyIndex } = useGameStore();
  const [tab, setTab] = useState<Tab>('summary');
  const hasGame = gameHistory.length > 1;
  const hasAnalysis = analyzedMoves.length > 0 || analysisLoading;

  // Auto-start analysis if arriving with an unanalyzed finished game
  useEffect(() => {
    if (hasGame && analyzedMoves.length === 0 && !analysisLoading) {
      startAnalysis();
    }
  }, []);

  return (
    <div className="game-container">

      {/* Board Section */}
      <div className="board-section">

        {/* Board + Eval */}
        <div className="board-with-eval">
          <div className="hidden md:block">
            <EvalBar />
          </div>
          <div className="board-frame" style={{ position:'relative' }}>
            <Board />
            {/* Best move arrow overlay would go here via a separate SVG overlay component */}
          </div>
        </div>

        {/* Mobile controls */}
        <div className="lg:hidden" style={{ width:'100%', marginTop:10 }}>
          <MobileAnalysisBar />
        </div>
      </div>

      {/* Desktop Panel */}
      <div className="game-panel">

        {/* Empty state — no game loaded */}
        {!hasGame && (
          <div className="card" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:14, opacity:0.3 }}>♟</div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:6 }}>No game to analyze</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:20 }}>Play a game first, then come back here to review it move by move.</div>
            <button onClick={() => setView('home')} className="btn btn-primary btn-sm">
              Play a game
            </button>
          </div>
        )}

        {hasGame && (
          <>
      

            {/* Summary + Moves tabs */}
            <div className="card" style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
              {/* Tab row */}
              <div style={{
                display:'flex', borderBottom:'1px solid var(--border-subtle)',
                padding:'4px 6px 0', gap:4, flexShrink:0,
              }}>
                {(['summary', 'moves'] as Tab[]).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    flex:1, padding:'9px 10px', border:'none', borderRadius:'8px 8px 0 0',
                    cursor:'pointer', fontSize:12, fontWeight:700,
                    textTransform:'uppercase', letterSpacing:'0.06em', transition:'all 150ms',
                    background: tab === t ? 'var(--elevated)' : 'transparent',
                    color:      tab === t ? 'var(--accent)' : 'var(--text-muted)',
                    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  }}>
                    {t === 'summary' ? '📊 Summary' : '♟ Moves'}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ flex:1, minHeight:0, overflow:'hidden', position:'relative' }}>
                {tab === 'summary' ? (
                  <div style={{ height:'100%', overflowY:'auto' }}>
                    {analysisLoading && (
                      <div style={{ padding:'20px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', border:'3px solid var(--border)', borderTopColor:'var(--accent)', animation:'spin 1s linear infinite' }} />
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>Running engine analysis…</div>
                      </div>
                    )}
                    {!analysisLoading && gameSummary && <GameSummaryPanel />}
                    {!analysisLoading && !gameSummary && hasGame && (
                      <div style={{ padding:24, textAlign:'center' }}>
                        <button onClick={startAnalysis} className="btn btn-primary btn-sm">Start Analysis</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ height:'100%', display:'flex', flexDirection:'column', position:'relative' }}>
                    <div style={{ flex:1, minHeight:0, overflow:'hidden' }}>
                      <AnalysisMoveList />
                    </div>
                    <GameControls />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MobileAnalysisBar() {
  const { undoMove, redoMove, flipBoard, historyIndex, gameHistory, goToMove } = useGameStore();
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < gameHistory.length - 1;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8, padding:'10px 12px',
      borderRadius:12, background:'var(--raised)', border:'1px solid var(--border-subtle)',
    }}>
      <div className="control-group">
        <button onClick={() => goToMove(0)} disabled={!canUndo} className="control-btn" title="Start">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6 1.41-1.41zM6 6h2v12H6V6z"/></svg>
        </button>
        <button onClick={undoMove} disabled={!canUndo} className="control-btn" title="Previous">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
        <button onClick={redoMove} disabled={!canRedo} className="control-btn" title="Next">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
        </button>
        <button onClick={() => goToMove(gameHistory.length - 1)} disabled={!canRedo} className="control-btn" title="End">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6-1.41 1.41zM16 6h2v12h-2V6z"/></svg>
        </button>
      </div>
      <div style={{ flex:1, textAlign:'center', fontSize:13, fontWeight:600, color:'var(--text-secondary)' }}>
        Move {historyIndex} / {gameHistory.length - 1}
      </div>
      <button onClick={flipBoard} className="control-btn" title="Flip board">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"/></svg>
      </button>
    </div>
  );
}
