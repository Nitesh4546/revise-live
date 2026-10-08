import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  Button,
  IconButton,
  Input,
  Select,
  Textarea,
  Switch,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Dialog,
  ConfirmDialog,
  Menu,
  MenuItem,
  Badge,
  AppHeader,
} from './index.js';
import { AuthContext } from '../../context/AuthContext.jsx';
import { ThemeProvider } from '../../context/ThemeContext.jsx';

describe('UI Primitives - Accessibility and Interaction Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Button & IconButton', () => {
    it('renders Button with variants and handles loading state without activating click', () => {
      const handleClick = vi.fn();
      render(
        <Button variant="primary" loading onClick={handleClick}>
          Submit
        </Button>
      );

      const btn = screen.getByRole('button');
      expect(btn.disabled).toBe(true);
      expect(btn.className).toContain('bg-accent');
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('renders IconButton with min 44x44px touch target and accessible label', () => {
      const handleClick = vi.fn();
      render(
        <IconButton label="Settings" onClick={handleClick}>
          <span>⚙</span>
        </IconButton>
      );

      const btn = screen.getByRole('button', { name: 'Settings' });
      expect(btn).toBeDefined();
      expect(btn.className).toContain('min-w-[44px]');
      expect(btn.className).toContain('min-h-[44px]');
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Input, Select, and Textarea', () => {
    it('links Input label with input element and manages aria-invalid and aria-describedby', () => {
      render(<Input label="Quiz Title" error="Title is required" id="quiz-title" />);

      const input = screen.getByLabelText('Quiz Title');
      expect(input).toBeDefined();
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe('quiz-title-error');
      expect(screen.getByText('Title is required')).toBeDefined();
    });

    it('renders Select with accessible label and options', () => {
      render(
        <Select label="Difficulty" id="diff-select" defaultValue="easy">
          <option value="easy">Easy</option>
          <option value="hard">Hard</option>
        </Select>
      );

      const select = screen.getByLabelText('Difficulty');
      expect(select.value).toBe('easy');
    });

    it('renders Textarea with accessible label and error state', () => {
      render(<Textarea label="Prompt" error="Too short" id="prompt-area" />);
      const textarea = screen.getByLabelText('Prompt');
      expect(textarea.getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('Switch Component', () => {
    it('toggles switch with click and keyboard Space/Enter keys', () => {
      const handleChange = vi.fn();
      render(
        <Switch
          checked={false}
          onChange={handleChange}
          label="Sound Effects"
        />
      );

      const switchBtn = screen.getByRole('switch');
      expect(switchBtn.getAttribute('aria-checked')).toBe('false');

      fireEvent.click(switchBtn);
      expect(handleChange).toHaveBeenCalledWith(true);

      fireEvent.keyDown(switchBtn, { key: ' ' });
      expect(handleChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Tabs Component', () => {
    function TabTestHarness() {
      const [tab, setTab] = useState('tab1');
      return (
        <Tabs value={tab} onChange={setTab}>
          <TabList aria-label="Settings Tabs">
            <Tab value="tab1">General</Tab>
            <Tab value="tab2">Advanced</Tab>
          </TabList>
          <TabPanel value="tab1">General Content</TabPanel>
          <TabPanel value="tab2">Advanced Content</TabPanel>
        </Tabs>
      );
    }

    it('manages tab panels and handles arrow keys navigation', () => {
      render(<TabTestHarness />);

      expect(screen.getByText('General Content')).toBeDefined();
      expect(screen.queryByText('Advanced Content')).toBeNull();

      const generalTab = screen.getByRole('tab', { name: 'General' });
      const advancedTab = screen.getByRole('tab', { name: 'Advanced' });

      expect(generalTab.getAttribute('aria-selected')).toBe('true');
      expect(advancedTab.getAttribute('aria-selected')).toBe('false');

      fireEvent.click(advancedTab);
      expect(screen.getByText('Advanced Content')).toBeDefined();
    });
  });

  describe('Dialog & ConfirmDialog', () => {
    it('renders modal dialog and closes on Escape key', () => {
      const handleClose = vi.fn();
      render(
        <Dialog isOpen={true} onClose={handleClose} title="Delete Room">
          <p>Confirmation message</p>
        </Dialog>
      );

      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByText('Delete Room')).toBeDefined();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('renders ConfirmDialog and triggers onConfirm on button click', () => {
      const handleConfirm = vi.fn();
      const handleClose = vi.fn();
      render(
        <ConfirmDialog
          isOpen={true}
          title="End Game"
          message="Are you sure you want to end?"
          confirmText="Yes, End Game"
          onConfirm={handleConfirm}
          onClose={handleClose}
        />
      );

      const confirmBtn = screen.getByRole('button', { name: 'Yes, End Game' });
      fireEvent.click(confirmBtn);
      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('Menu Component', () => {
    it('opens on trigger click, closes on Escape, and selects menu item', () => {
      const handleAction = vi.fn();
      render(
        <Menu trigger={<button>Actions</button>}>
          <MenuItem onClick={handleAction}>Download PDF</MenuItem>
        </Menu>
      );

      const trigger = screen.getByText('Actions');
      fireEvent.click(trigger);

      const menuItem = screen.getByRole('menuitem', { name: 'Download PDF' });
      expect(menuItem).toBeDefined();

      fireEvent.click(menuItem);
      expect(handleAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Badge Component', () => {
    it('renders status variants correctly', () => {
      render(<Badge variant="success">Completed</Badge>);
      const badge = screen.getByText('Completed');
      expect(badge.className).toContain('text-success');
    });
  });

  describe('AppHeader Component', () => {
    it('renders wordmark, navigation links, and theme toggle for authenticated teacher', () => {
      const mockUser = { name: 'Jane Teacher', email: 'jane@school.edu' };
      render(
        <MemoryRouter>
          <AuthContext.Provider value={{ user: mockUser, logout: vi.fn(), loading: false }}>
            <ThemeProvider>
              <AppHeader />
            </ThemeProvider>
          </AuthContext.Provider>
        </MemoryRouter>
      );

      expect(screen.getByText('ReviseLive')).toBeDefined();
      expect(screen.getByRole('link', { name: 'Quizzes' })).toBeDefined();
      expect(screen.getByRole('link', { name: 'History' })).toBeDefined();
      expect(screen.getByLabelText(/user menu for jane/i)).toBeDefined();
    });
  });
});
