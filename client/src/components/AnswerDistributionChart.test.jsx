import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnswerDistributionChart from './AnswerDistributionChart.jsx';
import Bar from './ui/Bar.jsx';

describe('AnswerDistributionChart', () => {
  it('[0,1,0,0] gives B full scale (100%) and A zero scale with no fill', () => {
    render(
      <AnswerDistributionChart counts={[0, 1, 0, 0]} mode="reveal" correctIndex={1} />
    );

    // Option B has 1 vote out of 1 (100% full scale)
    const barB = screen.getByTestId('bar-container-b');
    const fillB = barB.querySelector('[data-testid="bar-fill"]');
    expect(fillB).not.toBeNull();
    expect(fillB.dataset.scale).toBe('1');
    expect(fillB.dataset.percentage).toBe('100');
    expect(fillB.style.height).toBe('100%');
    expect(fillB.style.transform).toBe('scaleY(1)');
    expect(fillB.style.display).not.toBe('none');
    expect(barB.textContent).toContain('1 · 100%');

    // Option A has 0 votes (0 scale, NO fill at all, no sliver)
    const barA = screen.getByTestId('bar-container-a');
    const fillA = barA.querySelector('[data-testid="bar-fill"]');
    expect(fillA).not.toBeNull();
    expect(fillA.dataset.scale).toBe('0');
    expect(fillA.dataset.percentage).toBe('0');
    expect(fillA.style.height).toBe('0px');
    expect(fillA.style.transform).toBe('scaleY(0)');
    expect(fillA.style.display).toBe('none'); // strictly hidden / no sliver
    expect(barA.textContent).toContain('0 · 0%');

    // Options C and D also have 0 votes
    const barC = screen.getByTestId('bar-container-c');
    const fillC = barC.querySelector('[data-testid="bar-fill"]');
    expect(fillC.dataset.scale).toBe('0');
    expect(fillC.style.display).toBe('none');

    const barD = screen.getByTestId('bar-container-d');
    const fillD = barD.querySelector('[data-testid="bar-fill"]');
    expect(fillD.dataset.scale).toBe('0');
    expect(fillD.style.display).toBe('none');
  });

  it('[3,1,0,0] gives 75% and 25%', () => {
    render(<AnswerDistributionChart counts={[3, 1, 0, 0]} mode="reveal" correctIndex={0} />);

    // Total = 4. Option A = 3/4 = 75%
    const barA = screen.getByTestId('bar-container-a');
    const fillA = barA.querySelector('[data-testid="bar-fill"]');
    expect(fillA.dataset.scale).toBe('0.75');
    expect(fillA.dataset.percentage).toBe('75');
    expect(fillA.style.height).toBe('75%');
    expect(fillA.style.display).not.toBe('none');
    expect(screen.getByText('3 · 75%')).toBeDefined();

    // Option B = 1/4 = 25%
    const barB = screen.getByTestId('bar-container-b');
    const fillB = barB.querySelector('[data-testid="bar-fill"]');
    expect(fillB.dataset.scale).toBe('0.25');
    expect(fillB.dataset.percentage).toBe('25');
    expect(fillB.style.height).toBe('25%');
    expect(fillB.style.display).not.toBe('none');
    expect(screen.getByText('1 · 25%')).toBeDefined();

    // Option C and D = 0
    const barC = screen.getByTestId('bar-container-c');
    const fillC = barC.querySelector('[data-testid="bar-fill"]');
    expect(fillC.dataset.scale).toBe('0');
    expect(fillC.style.display).toBe('none');
  });

  it('[0,0,0,0] shows the empty state with "No responses yet"', () => {
    render(<AnswerDistributionChart counts={[0, 0, 0, 0]} mode="live" />);

    expect(screen.getByText(/No responses yet/i)).toBeDefined();

    // All four bars must have 0 scale and display none
    ['a', 'b', 'c', 'd'].forEach((letter) => {
      const container = screen.getByTestId(`bar-container-${letter}`);
      const fill = container.querySelector('[data-testid="bar-fill"]');
      expect(fill.dataset.scale).toBe('0');
      expect(fill.style.display).toBe('none');
    });
  });

  it('correct marker appears ONLY in reveal mode and ONLY on correctIndex', () => {
    // 1. Reveal mode with correctIndex = 2 (Option C)
    const { rerender } = render(
      <AnswerDistributionChart counts={[1, 1, 2, 0]} mode="reveal" correctIndex={2} />
    );

    const markers = screen.getAllByTestId('correct-marker');
    expect(markers.length).toBe(1);

    const barC = screen.getByTestId('bar-container-c');
    expect(barC.querySelector('[data-testid="correct-marker"]')).not.toBeNull();

    const barA = screen.getByTestId('bar-container-a');
    expect(barA.querySelector('[data-testid="correct-marker"]')).toBeNull();

    // 2. Live mode shows NO correct answer indicator even if correctIndex is passed
    rerender(
      <AnswerDistributionChart counts={[1, 1, 2, 0]} mode="live" correctIndex={2} />
    );

    expect(screen.queryByTestId('correct-marker')).toBeNull();
    expect(screen.queryByText(/Answer Revealed/i)).toBeNull();
  });

  it('reduced motion still renders final heights and scales', () => {
    render(<AnswerDistributionChart counts={[3, 1, 0, 0]} mode="reveal" correctIndex={0} />);

    const barA = screen.getByTestId('bar-container-a');
    const fillA = barA.querySelector('[data-testid="bar-fill"]');

    // Fill has motion-reduce:transition-none class so CSS transitions are bypassed
    expect(fillA.className).toContain('motion-reduce:transition-none');

    // Final computed inline height and scale are present immediately
    expect(fillA.style.height).toBe('75%');
    expect(fillA.dataset.scale).toBe('0.75');
    expect(fillA.dataset.percentage).toBe('75');
  });

  it('handles 300 players (3-digit counts) without breaking', () => {
    render(<AnswerDistributionChart counts={[150, 75, 45, 30]} mode="live" />);

    expect(screen.getByText('150 · 50%')).toBeDefined();
    expect(screen.getByText('75 · 25%')).toBeDefined();
    expect(screen.getByText('45 · 15%')).toBeDefined();
    expect(screen.getByText('30 · 10%')).toBeDefined();
  });

  it('renders accessible img role with summary aria-label and hidden table', () => {
    const { container } = render(
      <AnswerDistributionChart counts={[0, 1, 0, 0]} mode="reveal" correctIndex={1} />
    );

    const chart = container.querySelector('[role="img"]');
    expect(chart).not.toBeNull();
    expect(chart.getAttribute('aria-label')).toContain('Option B: 1 (100%)');
    expect(chart.getAttribute('aria-label')).toContain('Option A: 0 (0%)');

    // Screen reader accessible data table
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table.textContent).toContain('Option A');
    expect(table.textContent).toContain('Option B');
    expect(table.textContent).toContain('Yes'); // Correct answer column
  });
});

describe('Bar Primitive', () => {
  it('strictly renders zero fill when value is 0', () => {
    render(<Bar value={0} max={100} orientation="vertical" />);
    const fill = screen.getByTestId('bar-fill');
    expect(fill.dataset.scale).toBe('0');
    expect(fill.style.display).toBe('none');
    expect(fill.style.height).toBe('0px');
    expect(fill.style.transform).toBe('scaleY(0)');
  });

  it('fills completely (100%) when value equals max', () => {
    render(<Bar value={1} max={1} orientation="vertical" />);
    const fill = screen.getByTestId('bar-fill');
    expect(fill.dataset.scale).toBe('1');
    expect(fill.style.height).toBe('100%');
    expect(fill.style.transform).toBe('scaleY(1)');
  });

  it('enforces minNonZeroPx when value is small but positive', () => {
    render(<Bar value={1} max={300} orientation="vertical" minNonZeroPx={6} />);
    const fill = screen.getByTestId('bar-fill');
    expect(fill.style.minHeight).toBe('6px');
    expect(fill.style.display).not.toBe('none');
  });

  it('supports horizontal orientation', () => {
    render(<Bar value={50} max={100} orientation="horizontal" />);
    const fill = screen.getByTestId('bar-fill');
    expect(fill.dataset.scale).toBe('0.5');
    expect(fill.style.width).toBe('50%');
    expect(fill.style.height).toBe('100%');
  });
});
