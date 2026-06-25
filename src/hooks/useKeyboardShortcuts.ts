import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export function useKeyboardShortcuts() {
  const { undoMove, redoMove, flipBoard, goToMove, gameHistory, historyIndex } = useGameStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          undoMove();
          break;
        case 'ArrowRight':
          e.preventDefault();
          redoMove();
          break;
        case 'ArrowUp':
          e.preventDefault();
          goToMove(0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          goToMove(gameHistory.length - 1);
          break;
        case 'f':
        case 'F':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            flipBoard();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoMove, redoMove, flipBoard, goToMove, gameHistory.length, historyIndex]);
}
