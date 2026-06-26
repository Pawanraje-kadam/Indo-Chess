import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { Difficulty, GameMode, PieceColor, TimeControl } from '../engine/types';
import { sounds } from '../utils/sounds';
import ChessPiece from './pieces/ChessPieces';
import { logoDataUrl } from '../assets/logoBase64';

const TIME_PRESETS: { label: string; tc: TimeControl | null }[] = [
  { label: '∞', tc: null },
  { label: '1+0', tc: { initial: 60, increment: 0 } },
  { label: '3+0', tc: { initial: 180, increment: 0 } },
  { label: '5+0', tc: { initial: 300, increment: 0 } },
  { label: '10+0', tc: { initial: 600, increment: 0 } },
  { label: '15+5', tc: { initial: 900, increment: 5 } },
];

export default function HomeView() {
  const { newGame, setView, playerName, setPlayerName } = useGameStore();
  const [mode, setMode] = useState<GameMode>('hva');
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [playerColor, setPlayerColor] = useState<PieceColor>('white');
  const [timePreset, setTimePreset] = useState(0); // index into TIME_PRESETS

  const diffs: { value: Difficulty; label: string; elo: string }[] = [
    { value: 'beginner',     label: 'Beginner', elo: '~800'  },
    { value: 'intermediate', label: 'Medium',   elo: '~1200' },
    { value: 'advanced',     label: 'Advanced', elo: '~1600' },
    { value: 'master',       label: 'Master',   elo: '~2000' },
  ];

  const handlePlay = () => {
    sounds.gameStart();
    const tc = TIME_PRESETS[timePreset].tc;
    newGame({ mode, difficulty, playerColor, timeControl: tc ?? undefined });
  };

  return (
    <div className="home-container">
      <div className="home-content">

        {/* Hero */}
        <div className="home-hero">
          <div className="home-logo-wrap">
            <img src={logoDataUrl} alt="MindMove Chess" className="home-logo-img" />
          </div>
          <h1 className="home-title">MIND<span className="home-title-accent">MOVE</span></h1>
          <p className="home-subtitle">Think · Strategize · Win</p>
        </div>

        {/* Main Card */}
        <div className="home-card">
          <div className="home-card-header">
            <h2>New Game</h2>
            <p>Configure your match</p>
          </div>

          <div className="home-card-body" style={{ display:'flex', flexDirection:'column', gap:18 }}>

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

            {/* Game Mode */}
            <div>
              <label className="field-label">Game Mode</label>
              <div className="option-grid option-grid-3">
                {[
                  { value: 'hvh' as GameMode, label: 'Local', icon: '👥', desc: '2 Players' },
                  { value: 'hva' as GameMode, label: 'vs AI',  icon: '🤖', desc: 'Computer'  },
                  { value: 'ava' as GameMode, label: 'Watch', icon: '👁️', desc: 'AI vs AI'  },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setMode(opt.value)}
                    className={`option-btn ${mode === opt.value ? 'option-btn-active' : ''}`}>
                    <div className="option-icon">{opt.icon}</div>
                    <div className="option-label">{opt.label}</div>
                    <div className="option-desc">{opt.desc}</div>
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
                    {diffs.find(d => d.value === difficulty)?.elo} ELO
                  </span>
                </label>
                <div className="diff-row">
                  {diffs.map(d => (
                    <button key={d.value}
                      className={`diff-pill ${difficulty === d.value ? 'diff-pill-active' : ''}`}
                      onClick={() => setDifficulty(d.value)}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Time control */}
            <div>
              <label className="field-label">Time Control</label>
              <div className="diff-row" style={{ flexWrap:'wrap' }}>
                {TIME_PRESETS.map((p, i) => (
                  <button key={i}
                    className={`diff-pill ${timePreset === i ? 'diff-pill-active' : ''}`}
                    style={{ minWidth:44 }}
                    onClick={() => setTimePreset(i)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            {mode === 'hva' && (
              <div>
                <label className="field-label">Play as</label>
                <div className="option-grid option-grid-2">
                  {(['white', 'black'] as PieceColor[]).map(color => (
                    <button key={color} onClick={() => setPlayerColor(color)}
                      className={`option-btn ${playerColor === color ? 'option-btn-active' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10">
                          <ChessPiece type="king" color={color} className="w-full h-full" />
                        </div>
                        <div className="text-left">
                          <div className="option-label capitalize">{color}</div>
                          <div className="option-desc">{color === 'white' ? 'Move first' : 'Move second'}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handlePlay} className="play-btn">Play</button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <button onClick={() => { sounds.gameStart(); newGame({ mode:'hva', difficulty:'beginner', playerColor:'white' }); }} className="quick-action">
            <div className="quick-action-icon">⚡</div>
            <div className="quick-action-label">Quick Play</div>
          </button>
          <button onClick={() => setView('analysis')} className="quick-action">
            <div className="quick-action-icon">🔬</div>
            <div className="quick-action-label">Analyze</div>
          </button>
          <button onClick={() => setView('settings')} className="quick-action">
            <div className="quick-action-icon">⚙️</div>
            <div className="quick-action-label">Settings</div>
          </button>
        </div>

      </div>
    </div>
  );
}
