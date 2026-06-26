import { PieceColor, Piece, PieceType, PIECE_VALUES } from '../engine/types';
import { useGameStore } from '../store/gameStore';
import ChessPiece from './pieces/ChessPieces';

interface PlayerInfoProps {
  color: PieceColor;
  name: string;
  isActive: boolean;
  captured: Piece[];
  isThinking?: boolean;
}

const PIECE_ORDER: PieceType[] = ['queen', 'rook', 'bishop', 'knight', 'pawn'];

function formatClock(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerInfo({ color, name, isActive, captured, isThinking }: PlayerInfoProps) {
  const { clock, gameConfig, playerName } = useGameStore();
  const hasClock = clock.active || (clock.white > 0 || clock.black > 0);
  const timeMs = clock[color];
  const isLow = hasClock && timeMs < 30000; // under 30s

  const sorted = [...captured].sort((a, b) => PIECE_ORDER.indexOf(a.type) - PIECE_ORDER.indexOf(b.type));
  const materialValue = captured.reduce((sum, p) => sum + PIECE_VALUES[p.type], 0);
  const advantage = Math.round(materialValue / 100);

  // Use saved player name for human player
  const displayName = (() => {
    if (name === 'You' && playerName) return playerName;
    return name;
  })();

  const initials = displayName.slice(0, 2).toUpperCase() || '??';

  return (
    <div className={`player-bar ${isActive ? 'player-bar-active' : ''}`}>
      {/* Avatar */}
      <div className={`player-avatar ${color === 'white' ? 'player-avatar-white' : 'player-avatar-black'}`}>
        {initials}
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
          <span className="player-name truncate">{displayName}</span>
          {isActive && !isThinking && (
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', animation:'pulseDot 2s infinite', display:'block', flexShrink:0 }} />
          )}
          {isThinking && (
            <div className="thinking-indicator">
              <span>Thinking</span>
              <div className="thinking-dots">
                <div className="thinking-dot"/><div className="thinking-dot"/><div className="thinking-dot"/>
              </div>
            </div>
          )}
        </div>
        {/* Captured pieces */}
        <div style={{ display:'flex', alignItems:'center', gap:1, minHeight:20, flexWrap:'wrap' }}>
          {sorted.map((piece, i) => (
            <div key={i} style={{ width:17, height:17, marginRight:-2, filter:'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }}>
              <ChessPiece type={piece.type} color={piece.color} className="w-full h-full" style={{ opacity:0.85 }} />
            </div>
          ))}
          {advantage > 0 && (
            <span style={{ fontSize:11, fontWeight:700, marginLeft:6, padding:'1px 5px', borderRadius:4, background:'rgba(0,0,0,0.3)', color:'var(--text-secondary)' }}>
              +{advantage}
            </span>
          )}
        </div>
      </div>

      {/* Clock */}
      {hasClock && (
        <div className={`player-clock ${isActive && hasClock ? 'player-clock-active' : ''} ${isLow ? 'player-clock-low' : ''}`}>
          {formatClock(timeMs)}
        </div>
      )}
    </div>
  );
}
