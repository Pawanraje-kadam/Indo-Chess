import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import Board from './Board';
import EvalBar from './EvalBar';
import MoveList from './MoveList';
import GameControls from './GameControls';
import { sounds } from '../utils/sounds';

export default function AnalysisView() {
  const { importFEN, importPGN, exportFEN, newGame } = useGameStore();
  const [input, setInput] = useState('');

  const handleLoad = () => {
    if (!input.trim()) return;
    if (input.includes('[') || input.includes('1.')) {
      importPGN(input);
    } else {
      importFEN(input);
    }
    setInput('');
    sounds.gameStart();
  };

  const handleReset = () => {
    newGame({ mode: 'hvh', difficulty: 'intermediate', playerColor: 'white' });
    sounds.gameStart();
  };

  return (
    <div className="game-container">
      <div className="board-section">
        <div className="board-with-eval">
          <div className="hidden md:block">
            <EvalBar />
          </div>
          <div className="board-frame">
            <Board />
          </div>
        </div>
      </div>

      <div className="game-panel">
        {/* Import Card */}
        <div className="card">
          <div className="card-header">
            <h3>Analysis Board</h3>
          </div>
          <div className="card-body space-y-4">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Paste FEN or PGN to analyze..."
              className="input textarea text-xs font-mono"
            />
            <div className="flex gap-2">
              <button onClick={handleLoad} disabled={!input.trim()} className="btn btn-primary btn-sm flex-1">
                Load
              </button>
              <button onClick={handleReset} className="btn btn-secondary btn-sm">
                Reset
              </button>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Current FEN
              </label>
              <div 
                className="mt-1 p-2 rounded-lg text-[10px] font-mono break-all cursor-pointer transition-colors"
                style={{ background: 'var(--bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                onClick={() => navigator.clipboard.writeText(exportFEN())}
                title="Click to copy"
              >
                {exportFEN()}
              </div>
            </div>
          </div>
        </div>

        {/* Moves */}
        <div className="card flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            <MoveList />
          </div>
          <GameControls />
        </div>
      </div>
    </div>
  );
}
