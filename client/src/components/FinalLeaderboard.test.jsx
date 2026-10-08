import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FinalLeaderboard from './FinalLeaderboard.jsx';

describe('FinalLeaderboard Component - F2 Client Tests', () => {
  const sampleLeaderboard = [
    { rank: 1, name: 'Alice', score: 3000, correct: 3, answered: 3, accuracy: 1.0, isYou: false, left: false },
    { rank: 2, name: 'Bob', score: 2500, correct: 2, answered: 3, accuracy: 0.667, isYou: false, left: false },
    { rank: 3, name: 'Charlie', score: 2000, correct: 2, answered: 3, accuracy: 0.667, isYou: false, left: true },
    { rank: 4, name: 'Dana', score: 1800, correct: 2, answered: 3, accuracy: 0.667, isYou: true, left: false },
    { rank: 5, name: 'Evan', score: 1200, correct: 1, answered: 3, accuracy: 0.333, isYou: false, left: false }
  ];

  const sampleYou = {
    rank: 4,
    score: 1800,
    correct: 2,
    answered: 3,
    accuracy: 0.667,
    streak: 2,
    missedTopics: ['Thermodynamics', 'Optics']
  };

  it('renders student standing header with rank, score, accuracy, and solved counts', () => {
    render(
      <MemoryRouter>
        <FinalLeaderboard
          pin="123456"
          you={sampleYou}
          totalPlayers={5}
          leaderboard={sampleLeaderboard}
          receiptToken="token-xyz"
        />
      </MemoryRouter>
    );

    expect(screen.getByText('You ranked #4 of 5')).toBeDefined();
    expect(screen.getByText('1,800 pts')).toBeDefined();
    expect(screen.getAllByText('2/3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('67%').length).toBeGreaterThan(0);
  });

  it('renders top 3 medal emojis and highlights student own row with You tag and left tag for dropouts', () => {
    render(
      <MemoryRouter>
        <FinalLeaderboard
          pin="123456"
          you={sampleYou}
          totalPlayers={5}
          leaderboard={sampleLeaderboard}
        />
      </MemoryRouter>
    );

    // Medals for ranks 1-3
    expect(screen.getByText('🥇')).toBeDefined();
    expect(screen.getByText('🥈')).toBeDefined();
    expect(screen.getByText('🥉')).toBeDefined();

    // You badge
    expect(screen.getByText('You')).toBeDefined();

    // Left badge for Charlie who left mid-game
    expect(screen.getByText('left')).toBeDefined();
  });

  it('filters players dynamically via the search box', () => {
    render(
      <MemoryRouter>
        <FinalLeaderboard
          pin="123456"
          you={sampleYou}
          totalPlayers={5}
          leaderboard={sampleLeaderboard}
        />
      </MemoryRouter>
    );

    const searchInput = screen.getByRole('textbox', { name: /search players by name/i });
    fireEvent.change(searchInput, { target: { value: 'alice' } });

    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.queryByText('Bob')).toBeNull();
    expect(screen.queryByText('Charlie')).toBeNull();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('paginates 300 rows into pages of 25 and provides page controls and jump to me', () => {
    // Generate 300 players, user is rank 70 (on page 3)
    const largeList = [];
    for (let i = 1; i <= 300; i++) {
      largeList.push({
        rank: i,
        name: `Student ${i}`,
        score: (301 - i) * 10,
        correct: 5,
        answered: 5,
        accuracy: 1.0,
        isYou: i === 70,
        left: false
      });
    }

    render(
      <MemoryRouter>
        <FinalLeaderboard
          pin="123456"
          you={{ rank: 70, score: 2310, correct: 5, answered: 5 }}
          totalPlayers={300}
          leaderboard={largeList}
        />
      </MemoryRouter>
    );

    // Initial page: Page 1 of 12
    expect(screen.getByText(/Page 1 of 12/i)).toBeDefined();
    expect(screen.getByText('Student 1')).toBeDefined();
    expect(screen.queryByText('Student 70')).toBeNull();

    // Sticky banner visible because user is not on current page
    expect(screen.getByText(/Student 70 \(You\)/i)).toBeDefined();

    // Click "Jump to me"
    const jumpBtn = screen.getByRole('button', { name: /jump to me/i });
    fireEvent.click(jumpBtn);

    // Should switch to page 3 (ranks 51-75)
    expect(screen.getByText(/Page 3 of 12/i)).toBeDefined();
    expect(screen.getByText('Student 70')).toBeDefined();
  });

  it('switches to My Results tab and renders personal stats, missed topics, and copy receipt button', async () => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue()
      }
    });

    render(
      <MemoryRouter>
        <FinalLeaderboard
          pin="123456"
          you={sampleYou}
          totalPlayers={5}
          leaderboard={sampleLeaderboard}
          receiptToken="receipt-token-123"
        />
      </MemoryRouter>
    );

    // Switch to "My Results" tab
    const myResultsTab = screen.getByRole('button', { name: /my results/i });
    fireEvent.click(myResultsTab);

    // Performance and topics displayed
    expect(screen.getByText('Personal Performance')).toBeDefined();
    expect(screen.getByText('Thermodynamics')).toBeDefined();
    expect(screen.getByText('Optics')).toBeDefined();

    // Receipt card and copy button
    expect(screen.getByText(/Take-Home Revision Receipt/i)).toBeDefined();
    const copyBtn = screen.getByRole('button', { name: /copy receipt link/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('/r/receipt-token-123')
    );
  });

  it('Exit button calls onExit directly without a confirm modal', () => {
    const handleExit = vi.fn();

    render(
      <MemoryRouter>
        <FinalLeaderboard
          pin="123456"
          you={sampleYou}
          totalPlayers={5}
          leaderboard={sampleLeaderboard}
          onExit={handleExit}
        />
      </MemoryRouter>
    );

    const exitBtn = screen.getByRole('button', { name: /exit game/i });
    fireEvent.click(exitBtn);

    expect(handleExit).toHaveBeenCalledTimes(1);
    // Confirm dialog should NOT be shown
    expect(screen.queryByText(/leave this game\?/i)).toBeNull();
  });
});
