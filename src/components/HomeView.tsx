import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { Difficulty, GameMode, PieceColor } from '../engine/types';
import { sounds } from '../utils/sounds';
import { logoDataUrl } from '../assets/logoBase64';

export default function HomeView() {
  const { newGame, setView } = useGameStore();
  const [mode, setMode] = useState<GameMode>('hva');
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [playerColor, setPlayerColor] = useState<PieceColor>('white');
  const [playerName, setPlayerName] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('mm_name');
    if (saved) setPlayerName(saved);
  }, []);

  const handlePlay = () => {
    if (playerName.trim()) localStorage.setItem('mm_name', playerName.trim());
    sounds.gameStart();
    newGame({ mode, difficulty, playerColor });
  };

  const diffs: { value: Difficulty; label: string; elo: string }[] = [
    { value: 'beginner',     label: 'Beginner', elo: '~800'  },
    { value: 'intermediate', label: 'Medium',   elo: '~1200' },
    { value: 'advanced',     label: 'Advanced', elo: '~1600' },
    { value: 'master',       label: 'Master',   elo: '~2000' },
  ];

  return (
    <div className="home-container">
      <div className="home-content">

        {/* Hero — logo displayed properly, no cropping */}
        <div className="home-hero">
          <div className="home-logo-wrap">
            <img src={logoDataUrl} alt="MindMove Chess" className="home-logo-img" />
          </div>
          <h1 className="home-title">MIND<span className="home-title-blue">MOVE</span></h1>
          <p className="home-subtitle">Think · Strategize · Win</p>
        </div>

        {/* Main card */}
        <div className="home-card">
          <div className="home-card-header">
            <h2>New Game</h2>
            <p>Set up your match</p>
          </div>
          <div className="home-card-body">

            {/* Name */}
            <div>
              <label className="field-label">Your name</label>
              <input
                className="input"
                placeholder="Enter your name…"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                maxLength={22}
              />
            </div>

            {/* Mode */}
            <div>
              <label className="field-label">Game mode</label>
              <div className="option-grid option-grid-3">
                {([
                  { value:'hvh' as GameMode, icon:'👥', label:'Local',  desc:'2 Players' },
                  { value:'hva' as GameMode, icon:'🤖', label:'vs AI',  desc:'Computer'  },
                  { value:'ava' as GameMode, icon:'👁',  label:'Watch',  desc:'AI vs AI'  },
                ] as const).map(o => (
                  <button key={o.value}
                    className={`option-btn ${mode===o.value?'option-btn-active':''}`}
                    onClick={() => setMode(o.value)}>
                    <div className="option-icon">{o.icon}</div>
                    <div className="option-label">{o.label}</div>
                    <div className="option-desc">{o.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty pills */}
            {(mode === 'hva' || mode === 'ava') && (
              <div>
                <label className="field-label">
                  Difficulty
                  <span style={{ marginLeft:8, color:'var(--accent)', fontWeight:700 }}>
                    {diffs.find(d=>d.value===difficulty)?.elo} ELO
                  </span>
                </label>
                <div className="diff-row">
                  {diffs.map(d => (
                    <button key={d.value}
                      className={`diff-pill ${difficulty===d.value?'diff-pill-active':''}`}
                      onClick={() => setDifficulty(d.value)}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color */}
            {mode === 'hva' && (
              <div>
                <label className="field-label">Play as</label>
                <div className="option-grid option-grid-2">
                  {(['white','black'] as PieceColor[]).map(color => (
                    <button key={color}
                      className={`option-btn ${playerColor===color?'option-btn-active':''}`}
                      onClick={() => setPlayerColor(color)}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'2px 4px' }}>
                        <div style={{
                          width:28, height:28, borderRadius:7, flexShrink:0,
                          background: color==='white'
                            ? 'linear-gradient(135deg,#e4ecf7,#c4cedd)'
                            : 'linear-gradient(135deg,#1d2a3e,#0c1018)',
                          border:'1px solid var(--border)',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
                        }}>
                          {color==='white' ? '♔' : '♚'}
                        </div>
                        <div style={{ textAlign:'left' }}>
                          <div className="option-label" style={{ textTransform:'capitalize' }}>{color}</div>
                          <div className="option-desc">{color==='white'?'Move first':'Move second'}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button className="play-btn" onClick={handlePlay}>Play</button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="quick-actions">
          <button className="quick-action" onClick={() => { sounds.gameStart(); newGame({ mode:'hva', difficulty:'beginner', playerColor:'white' }); }}>
            <div className="quick-action-icon">⚡</div>
            <div className="quick-action-label">Quick Play</div>
          </button>
          <button className="quick-action" onClick={() => setView('analysis')}>
            <div className="quick-action-icon">🔬</div>
            <div className="quick-action-label">Analyze</div>
          </button>
          <button className="quick-action" onClick={() => setView('settings')}>
            <div className="quick-action-icon">⚙️</div>
            <div className="quick-action-label">Settings</div>
          </button>
        </div>

      </div>
    </div>
  );
}
