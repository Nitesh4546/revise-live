import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlayerGamePad from './PlayerGamePad.jsx';

// Comprehensive localStorage mock
const createStorageMock = () => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (idx) => Object.keys(store)[idx] || null
  };
};

const storageMock = createStorageMock();
Object.defineProperty(window, 'localStorage', {
  value: storageMock,
  writable: true
});
Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams({ pin: '123456' }), vi.fn()],
    useLocation: () => ({ state: null })
  };
});

const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
};

vi.mock('../context/SocketContext.jsx', () => ({
  useSocket: () => ({
    socket: mockSocket,
    connected: true
  })
}));

describe('Player Leave & History Guard Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.clear();
    // Setup player session
    storageMock.setItem(
      'reviselive:player:123456',
      JSON.stringify({
        playerId: 'p-1',
        reconnectToken: 'rec-1',
        name: 'Alex',
        pin: '123456'
      })
    );
  });

  it('opens confirm leave dialog on popstate (system back gesture)', async () => {
    render(
      <MemoryRouter>
        <PlayerGamePad />
      </MemoryRouter>
    );

    // Initial state: dialog is not visible
    expect(screen.queryByText(/leave this game\?/i)).toBeNull();

    // Trigger popstate event (simulating phone back gesture)
    act(() => {
      window.dispatchEvent(new Event('popstate'));
    });

    // Confirm dialog is displayed with exact warning text
    expect(screen.getByText(/leave this game\?/i)).toBeDefined();
    expect(
      screen.getByText(/your score so far stays on the leaderboard, but you won't be able to rejoin this seat/i)
    ).toBeDefined();

    // Clicking Stay closes the dialog
    const stayBtn = screen.getByRole('button', { name: /^stay$/i });
    fireEvent.click(stayBtn);
    expect(screen.queryByText(/leave this game\?/i)).toBeNull();
  });

  it('receipt storage survives leaving the game', async () => {
    // Pre-seed receipt storage
    storageMock.setItem('reviselive:lastReceipt', 'receipt-token-abc');

    render(
      <MemoryRouter>
        <PlayerGamePad />
      </MemoryRouter>
    );

    // Open leave dialog via the top-left Leave button
    const leaveHeaderBtn = screen.getByRole('button', { name: /leave game/i });
    fireEvent.click(leaveHeaderBtn);

    // Click confirm Leave button
    const confirmLeaveBtn = screen.getByRole('button', { name: /^leave$/i });
    fireEvent.click(confirmLeaveBtn);

    // Emits player:leave
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'player:leave',
      expect.objectContaining({ pin: '123456', playerId: 'p-1' })
    );

    // Clears player session
    expect(storageMock.getItem('reviselive:player:123456')).toBeNull();

    // Crucially: DOES NOT delete the stored receipt token!
    expect(storageMock.getItem('reviselive:lastReceipt')).toBe('receipt-token-abc');

    // Navigates to home
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
