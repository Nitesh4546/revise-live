import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CountdownTimer from './CountdownTimer.jsx';
import AnswerTile from './AnswerTile.jsx';
import Leaderboard from './Leaderboard.jsx';
import QRJoinCard from './QRJoinCard.jsx';

describe('Client UI Component Tests', () => {
  describe('CountdownTimer', () => {
    it('renders the remaining seconds clearly', () => {
      render(<CountdownTimer secondsLeft={14} totalSeconds={20} />);
      expect(screen.getByText('14')).toBeDefined();
      expect(screen.getByText('sec')).toBeDefined();
    });
  });

  describe('AnswerTile', () => {
    it('renders shape and text with proper accessible ARIA label', () => {
      const handleClick = vi.fn();
      render(
        <AnswerTile
          index={0}
          text="Mitochondrial Matrix"
          onClick={handleClick}
          showText={true}
        />
      );

      // Check primary letter A chip
      expect(screen.getByText('A')).toBeDefined();
      // Check text
      expect(screen.getByText('Mitochondrial Matrix')).toBeDefined();

      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-label')).toContain('Option A (Hexagon): Mitochondrial Matrix');

      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('applies dimmed styles when not correct on reveal', () => {
      render(
        <AnswerTile
          index={1}
          text="Wrong Option"
          isDimmed={true}
          isCorrect={false}
        />
      );

      const button = screen.getByRole('button');
      expect(button.className).toContain('opacity-30');
    });
  });

  describe('Leaderboard', () => {
    it('renders top players with scores and personal rank', () => {
      const topPlayers = [
        { playerId: 'p1', name: 'Alice', score: 1500, rank: 1, rankChange: 0, pointsGained: 500 },
        { playerId: 'p2', name: 'Bob', score: 1200, rank: 2, rankChange: 1, pointsGained: 400 }
      ];
      const you = { rank: 12, score: 350 };

      render(<Leaderboard topPlayers={topPlayers} you={you} />);

      expect(screen.getByText('Alice')).toBeDefined();
      expect(screen.getByText('1,500')).toBeDefined();
      expect(screen.getByText('+500 pts')).toBeDefined();
      expect(screen.getByText('Bob')).toBeDefined();

      // Outside top 5 student position
      expect(screen.getByText('Your Position')).toBeDefined();
      expect(screen.getByText('Rank 12')).toBeDefined();
      expect(screen.getByText('350 pts')).toBeDefined();
    });
  });

  describe('QRJoinCard', () => {
    it('renders on a high-contrast white tile with dark fgColor for reliable scanning in any theme', () => {
      const { container } = render(<QRJoinCard pin="849201" origin="http://localhost:5173" />);
      const tile = container.querySelector('.bg-white');
      expect(tile).toBeDefined();
      expect(tile.className).toContain('bg-white');
      const svg = container.querySelector('svg');
      expect(svg).toBeDefined();
      expect(screen.getByText('849201')).toBeDefined();
      expect(screen.getByText(/Scan the QR code/i)).toBeDefined();
    });
  });
});
