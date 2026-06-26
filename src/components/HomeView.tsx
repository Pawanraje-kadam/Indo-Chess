import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Difficulty, GameMode, PieceColor, TimeControl } from '../engine/types';
import { sounds } from '../utils/sounds';
import ChessPiece from './pieces/ChessPieces';
import { logoDataUrl } from '../assets/logoBase64';

const TIME_PRESETS = [
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
  const [timePreset, setTimePreset] = useState(0);

  const diffs = [
    { value: 'beginner', label: 'Beginner', elo: '~800' },
    { value: 'intermediate', label: 'Medium', elo: '~1200' },
    { value: 'advanced', label: 'Advanced', elo: '~1600' },
    { value: 'master', label: 'Master', elo: '~2000' },
  ];

  const handlePlay = () => {
    sounds.gameStart();
    const tc = TIME_PRESETS[timePreset].tc;
    newGame({ mode, difficulty, playerColor, timeControl: tc ?? undefined });
  };

  return (
    <div className="home-container">
      <div className="home-content max-w-[460px] w-full px-4">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="w-24 h-24 mx-auto mb-4 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
            <img src={logoDataUrl} alt="MindMove" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-5xl font-bold tracking-tighter">MIND<span className="text-[#3d9cf5]">MOVE</span></h1>
          <p className="text-lg text-white/60 mt-1">Think · Strategize · Win</p>
        </div>

        {/* Main Setup Card */}
        <div className="bg-[#111827] rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-[#1e3a8a] to-[#3d9cf5]">
            <h2 className="text-2xl font-semibold text-white">New Game</h2>
            <p className="text-white/70 text-sm mt-0.5">Configure your match</p>
          </div>

          <div className="p-8 space-y-7">
            {/* Name */}
            <div>
              <label className="text-xs font-semibold tracking-widest text-white/50 block mb-2">YOUR NAME</label>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="input w-full"
                placeholder="Enter your name"
                maxLength={22}
              />
            </div>

            {/* Game Mode */}
            <div>
              <label className="text-xs font-semibold tracking-widest text-white/50 block mb-3">GAME MODE</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { v: 'hvh', label: 'Local', icon: '👥' },
                  { v: 'hva', label: 'vs AI', icon: '🤖' },
                  { v: 'ava', label: 'Watch', icon: '👁️' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setMode(opt.v as GameMode)}
                    className={`option-btn flex flex-col items-center py-5 rounded-2xl ${mode === opt.v ? 'option-btn-active' : ''}`}
                  >
                    <div className="text-3xl mb-1.5">{opt.icon}</div>
                    <div className="font-semibold">{opt.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            {(mode === 'hva' || mode === 'ava') && (
              <div>
                <label className="text-xs font-semibold tracking-widest text-white/50 mb-2 block">DIFFICULTY</label>
                <div className="flex flex-wrap gap-2">
                  {diffs.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setDifficulty(d.value as Difficulty)}
                      className={`diff-pill flex-1 min-w-[78px] py-2 text-sm ${difficulty === d.value ? 'diff-pill-active' : ''}`}
                    >
                      {d.label} <span className="text-[10px] opacity-70">({d.elo})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Time Control */}
            <div>
              <label className="text-xs font-semibold tracking-widest text-white/50 mb-2 block">TIME CONTROL</label>
              <div className="flex flex-wrap gap-2">
                {TIME_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setTimePreset(i)}
                    className={`diff-pill flex-1 py-2 text-sm ${timePreset === i ? 'diff-pill-active' : ''}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Selection */}
            {mode === 'hva' && (
              <div>
                <label className="text-xs font-semibold tracking-widest text-white/50 mb-2 block">PLAY AS</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['white', 'black'] as PieceColor[]).map((color) => (
                    <button
                      key={color}
                      onClick={() => setPlayerColor(color)}
                      className={`option-btn flex items-center gap-4 px-4 py-4 rounded-2xl ${playerColor === color ? 'option-btn-active' : ''}`}
                    >
                      <div className="w-9 h-9">
                        <ChessPiece type="king" color={color} className="w-full h-full" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold capitalize">{color}</div>
                        <div className="text-xs text-white/50">{color === 'white' ? 'Move first' : 'Move second'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handlePlay} className="play-btn w-full h-[58px] text-xl font-bold mt-4">
              Play Now
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <button onClick={() => { sounds.gameStart(); newGame({ mode: 'hva', difficulty: 'beginner' }); }} className="quick-action">
            ⚡ Quick Play
          </button>
          <button onClick={() => setView('analysis')} className="quick-action">
            🔬 Analyze
          </button>
          <button onClick={() => setView('settings')} className="quick-action">
            ⚙️ Settings
          </button>
        </div>
      </div>
    </div>
  );
}
