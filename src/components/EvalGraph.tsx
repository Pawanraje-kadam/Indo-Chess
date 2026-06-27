import { useGameStore } from '../store/gameStore';

const GRAPH_H = 140;
const GRAPH_W = 100; // percentage, uses SVG viewBox
const CENTER = GRAPH_H / 2;

// Clamp centipawn eval to ±1000 for graph scaling
function clampEval(cp: number): number {
  return Math.max(-1000, Math.min(1000, cp));
}

// Convert centipawn to y coordinate (white wins = top)
function evalToY(cp: number): number {
  const clamped = clampEval(cp);
  return CENTER - (clamped / 1000) * (CENTER - 8);
}

const CLASS_COLOR: Record<string, string> = {
  brilliant: '#a78bfa',
  best:      '#3d9cf5',
  excellent: '#4ade80',
  good:      '#86efac',
  inaccuracy:'#fbbf24',
  mistake:   '#fb923c',
  blunder:   '#f87171',
  book:      '#94a3b8',
  forced:    '#94a3b8',
  great:     '#4ade80',
};

const CLASS_SYMBOL: Record<string, string> = {
  brilliant: '!!', best: '', excellent: '!', good: '',
  inaccuracy: '?!', mistake: '?', blunder: '??', book: '', forced: '', great: '!',
};

export default function EvalGraph() {
  const { analyzedMoves, historyIndex, goToMove, analysisLoading, analysisProgress } = useGameStore();

  if (analysisLoading) {
    return (
      <div style={{ padding:'12px 16px' }}>
        <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-muted)', marginBottom:10 }}>
          Evaluation Graph
        </div>
        <div style={{ height:8, background:'var(--bg)', borderRadius:4, overflow:'hidden', marginBottom:8 }}>
          <div style={{ height:'100%', width:`${analysisProgress}%`, background:'var(--accent)', borderRadius:4, transition:'width 300ms' }} />
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)' }}>Analyzing… {analysisProgress}%</div>
      </div>
    );
  }

  if (analyzedMoves.length === 0) return null;

  const points = analyzedMoves.map((m, i) => ({
    x: ((i + 1) / analyzedMoves.length) * 100,
    y: evalToY(m.playedEval),
    m,
  }));

  // Build SVG path strings
  const whiteAreaPath = [
    `M 0 ${CENTER}`,
    ...points.map(p => `L ${p.x} ${p.y}`),
    `L 100 ${CENTER}`,
    'Z',
  ].join(' ');

  const blackAreaPath = [
    `M 0 ${CENTER}`,
    ...points.map(p => `L ${p.x} ${Math.max(p.y, CENTER)}`),
    `L 100 ${CENTER}`,
    'Z',
  ].join(' ');

  const linePath = ['M 0 ' + CENTER, ...points.map(p => `L ${p.x} ${p.y}`)].join(' ');

  return (
    <div style={{ padding:'12px 16px 8px' }}>
      <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-muted)', marginBottom:10 }}>
        Evaluation Graph
      </div>

      <div style={{ borderRadius:8, overflow:'hidden', background:'var(--bg)', border:'1px solid var(--border-subtle)', position:'relative' }}>
        <svg
          viewBox={`0 0 100 ${GRAPH_H}`}
          preserveAspectRatio="none"
          style={{ width:'100%', height:GRAPH_H, display:'block' }}
        >
          {/* White advantage area */}
          <path d={whiteAreaPath} fill="rgba(232,237,245,0.85)" />
          {/* Black advantage area */}
          <path d={`M 0 ${CENTER} ${points.map(p => `L ${p.x} ${Math.min(p.y, CENTER)}`).join(' ')} L 100 ${CENTER} Z`} fill="rgba(20,30,48,0.88)" />
          {/* Center line */}
          <line x1="0" y1={CENTER} x2="100" y2={CENTER} stroke="rgba(150,160,180,0.35)" strokeWidth="0.5" />
          {/* Eval line */}
          <path d={linePath} fill="none" stroke="rgba(150,160,180,0.6)" strokeWidth="0.6" />
          {/* Move dots */}
          {points.map((p, i) => {
            const cls = p.m.classification;
            const color = CLASS_COLOR[cls] || '#94a3b8';
            const isActive = historyIndex === p.m.moveIndex;
            return (
              <g key={i} onClick={() => goToMove(p.m.moveIndex)} style={{ cursor:'pointer' }}>
                <circle cx={p.x} cy={p.y} r={isActive ? 2.5 : 1.8}
                  fill={color}
                  stroke={isActive ? '#fff' : 'none'}
                  strokeWidth={isActive ? 0.8 : 0}
                  opacity={p.m.isKeyMoment || isActive ? 1 : 0.7}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 10px', marginTop:8 }}>
        {Object.entries({ 'Best / !!': '#3d9cf5', 'Good': '#4ade80', 'Inaccuracy ?!': '#fbbf24', 'Mistake ?': '#fb923c', 'Blunder ??': '#f87171' }).map(([label, color]) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }} />
            <span style={{ fontSize:10, color:'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
