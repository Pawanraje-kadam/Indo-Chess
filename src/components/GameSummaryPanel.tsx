import { useGameStore } from '../store/gameStore';
import { goToMove } from '../store/gameStore';

const CLASS_COLOR: Record<string, string> = {
  brilliant: '#a78bfa', best: '#3d9cf5', excellent: '#4ade80',
  good: '#86efac', inaccuracy: '#fbbf24', mistake: '#fb923c', blunder: '#f87171',
};
const CLASS_SYMBOL: Record<string, string> = {
  brilliant: '!!', best: '✓', excellent: '!', good: '·',
  inaccuracy: '?!', mistake: '?', blunder: '??',
};

function AccuracyBar({ label, accuracy, color }: { label: string; accuracy: number; color: string }) {
  const grade = accuracy >= 90 ? 'Brilliant' : accuracy >= 75 ? 'Good' : accuracy >= 60 ? 'Average' : 'Struggling';
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
        <span style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)' }}>{label}</span>
        <div style={{ textAlign:'right' }}>
          <span style={{ fontSize:18, fontWeight:800, color, letterSpacing:'-0.02em' }}>{accuracy.toFixed(1)}%</span>
          <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:6 }}>{grade}</span>
        </div>
      </div>
      <div style={{ height:6, background:'var(--bg)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${accuracy}%`, background:color, borderRadius:3, transition:'width 600ms ease-out' }} />
      </div>
    </div>
  );
}

function MoveCountRow({ label, counts, color }: { label: string; counts: Record<string,number>; color: string }) {
  const entries = [
    { key:'best',       sym:'✓',  label:'Best'        },
    { key:'excellent',  sym:'!',  label:'Excellent'   },
    { key:'good',       sym:'·',  label:'Good'        },
    { key:'inaccuracy', sym:'?!', label:'Inaccuracy'  },
    { key:'mistake',    sym:'?',  label:'Mistake'     },
    { key:'blunder',    sym:'??', label:'Blunder'     },
  ].filter(e => counts[e.key] > 0);

  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-muted)', marginBottom:7 }}>{label}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {entries.map(e => (
          <div key={e.key} style={{
            display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
            borderRadius:20, background:`${CLASS_COLOR[e.key]}18`,
            border:`1px solid ${CLASS_COLOR[e.key]}30`,
          }}>
            <span style={{ fontSize:11, fontWeight:800, color:CLASS_COLOR[e.key] }}>{e.sym}</span>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--text-secondary)' }}>{counts[e.key]} {e.label}</span>
          </div>
        ))}
        {entries.length === 0 && <span style={{ fontSize:12, color:'var(--text-muted)' }}>No moves yet</span>}
      </div>
    </div>
  );
}

export default function GameSummaryPanel() {
  const { gameSummary, analyzedMoves, goToMove: goto } = useGameStore();

  if (!gameSummary) return null;

  const copyReport = () => {
    const lines = [
      '── MindMove Analysis Report ──',
      `White accuracy: ${gameSummary.whiteAccuracy.toFixed(1)}%`,
      `Black accuracy: ${gameSummary.blackAccuracy.toFixed(1)}%`,
      '',
      'White: ' + Object.entries(gameSummary.white).filter(([,v])=>v>0).map(([k,v])=>`${v} ${k}`).join(', '),
      'Black: ' + Object.entries(gameSummary.black).filter(([,v])=>v>0).map(([k,v])=>`${v} ${k}`).join(', '),
      '',
      gameSummary.narrative,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
  };

  return (
    <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:2 }}>

      {/* Accuracy */}
      <div style={{ marginBottom:4 }}>
        <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-muted)', marginBottom:12 }}>
          Accuracy
        </div>
        <AccuracyBar label="White" accuracy={gameSummary.whiteAccuracy} color="#e4ecf7" />
        <AccuracyBar label="Black" accuracy={gameSummary.blackAccuracy} color="#3d9cf5" />
      </div>

      <div style={{ height:1, background:'var(--border-subtle)', margin:'4px 0 12px' }} />

      {/* Move breakdown */}
      <MoveCountRow label="White moves" counts={gameSummary.white} color="var(--text)" />
      <MoveCountRow label="Black moves" counts={gameSummary.black} color="var(--accent)" />

      <div style={{ height:1, background:'var(--border-subtle)', margin:'4px 0 12px' }} />

      {/* Key moments */}
      {gameSummary.keyMoments.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-muted)', marginBottom:8 }}>
            ⚡ Key Moments
          </div>
          {gameSummary.keyMoments.map((m, i) => (
            <button key={i} onClick={() => goto(m.moveIndex)} style={{
              display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 12px',
              borderRadius:9, border:'none', cursor:'pointer', marginBottom:6,
              background:`${CLASS_COLOR[m.classification]}12`,
              transition:'background 150ms',
            }}
            onMouseEnter={e => e.currentTarget.style.background = `${CLASS_COLOR[m.classification]}22`}
            onMouseLeave={e => e.currentTarget.style.background = `${CLASS_COLOR[m.classification]}12`}>
              <span style={{ fontSize:14, fontWeight:800, color:CLASS_COLOR[m.classification], minWidth:22, textAlign:'center' }}>
                {CLASS_SYMBOL[m.classification] || '·'}
              </span>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>
                  Move {Math.ceil(m.moveIndex / 2)}: {m.san}
                  <span style={{ marginLeft:6, fontSize:11, color:'var(--text-muted)', textTransform:'capitalize' }}>({m.color})</span>
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>
                  {m.classification.charAt(0).toUpperCase() + m.classification.slice(1)} · lost {(m.evalLoss / 100).toFixed(1)} pawns
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Narrative */}
      {gameSummary.narrative && (
        <div style={{
          padding:'11px 14px', borderRadius:9,
          background:'var(--elevated, rgba(30,42,61,0.5))',
          border:'1px solid var(--border-subtle)',
          fontSize:12, color:'var(--text-secondary)', lineHeight:1.65,
          marginBottom:10,
        }}>
          {gameSummary.narrative}
        </div>
      )}

      {/* Copy report */}
      <button onClick={copyReport} style={{
        width:'100%', padding:'9px', borderRadius:9,
        border:'1px solid var(--border)', background:'var(--bg)',
        color:'var(--text-muted)', fontSize:12, fontWeight:600,
        cursor:'pointer', transition:'all 150ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
        📋 Copy Analysis Report
      </button>
    </div>
  );
}
