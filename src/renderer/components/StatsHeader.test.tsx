/**
 * Unit tests for StatsHeader component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatsHeader, formatTotalTime, formatDateForInput } from './StatsHeader';

describe('StatsHeader', () => {
  const mockProps = {
    totalFocusTime: 3600,
    sessionCount: 5,
    selectedDate: new Date('2024-01-15'),
    onDateChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display total focus time', () => {
    render(<StatsHeader {...mockProps} />);
    expect(screen.getByText('1h 0m')).toBeInTheDocument();
  });

  it('should display session count', () => {
    render(<StatsHeader {...mockProps} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should render date picker', () => {
    render(<StatsHeader {...mockProps} />);
    const dateInput = screen.getByLabelText('Select date') as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();
    expect(dateInput.value).toBe('2024-01-15');
  });

  it('should call onDateChange when date is changed', () => {
    render(<StatsHeader {...mockProps} />);
    const dateInput = screen.getByLabelText('Select date');
    fireEvent.change(dateInput, { target: { value: '2024-01-20' } });
    expect(mockProps.onDateChange).toHaveBeenCalled();
  });

  it('should render previous day button', () => {
    render(<StatsHeader {...mockProps} />);
    expect(screen.getByLabelText('Previous day')).toBeInTheDocument();
  });

  it('should render next day button', () => {
    render(<StatsHeader {...mockProps} />);
    expect(screen.getByLabelText('Next day')).toBeInTheDocument();
  });

  it('should call onDateChange when previous day button is clicked', () => {
    render(<StatsHeader {...mockProps} />);
    fireEvent.click(screen.getByLabelText('Previous day'));
    expect(mockProps.onDateChange).toHaveBeenCalled();
    const calledDate = mockProps.onDateChange.mock.calls[0][0];
    expect(calledDate.getDate()).toBe(14); // One day before Jan 15
  });

  it('should call onDateChange when next day button is clicked', () => {
    render(<StatsHeader {...mockProps} />);
    fireEvent.click(screen.getByLabelText('Next day'));
    expect(mockProps.onDateChange).toHaveBeenCalled();
    const calledDate = mockProps.onDateChange.mock.calls[0][0];
    expect(calledDate.getDate()).toBe(16); // One day after Jan 15
  });

  it('should show Today button when not viewing today', () => {
    render(<StatsHeader {...mockProps} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('should not show Today button when viewing today', () => {
    const todayProps = { ...mockProps, selectedDate: new Date() };
    const { container } = render(<StatsHeader {...todayProps} />);
    // Check that the Today button is not present (but "Today" text in date display is ok)
    const buttons = container.querySelectorAll('button');
    const todayButton = Array.from(buttons).find(btn => btn.textContent === 'Today');
    expect(todayButton).toBeUndefined();
  });

  it('should call onDateChange with today when Today button is clicked', () => {
    render(<StatsHeader {...mockProps} />);
    fireEvent.click(screen.getByText('Today'));
    expect(mockProps.onDateChange).toHaveBeenCalled();
    const calledDate = mockProps.onDateChange.mock.calls[0][0];
    const today = new Date();
    expect(calledDate.toDateString()).toBe(today.toDateString());
  });

  it('should display "Today" for current date', () => {
    const todayProps = { ...mockProps, selectedDate: new Date() };
    render(<StatsHeader {...todayProps} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});

describe('formatTotalTime', () => {
  it('should format seconds only', () => {
    expect(formatTotalTime(30)).toBe('30s');
    expect(formatTotalTime(59)).toBe('59s');
  });

  it('should format minutes only', () => {
    expect(formatTotalTime(60)).toBe('1m');
    expect(formatTotalTime(300)).toBe('5m');
    expect(formatTotalTime(1500)).toBe('25m');
  });

  it('should format hours and minutes', () => {
    expect(formatTotalTime(3600)).toBe('1h 0m');
    expect(formatTotalTime(3660)).toBe('1h 1m');
    expect(formatTotalTime(7200)).toBe('2h 0m');
    expect(formatTotalTime(5400)).toBe('1h 30m');
  });

  it('should handle zero', () => {
    expect(formatTotalTime(0)).toBe('0s');
  });
});

describe('formatDateForInput', () => {
  it('should format date as YYYY-MM-DD', () => {
    const date = new Date('2024-01-15');
    expect(formatDateForInput(date)).toBe('2024-01-15');
  });

  it('should pad single digit months and days', () => {
    const date = new Date('2024-03-05');
    expect(formatDateForInput(date)).toBe('2024-03-05');
  });
});
