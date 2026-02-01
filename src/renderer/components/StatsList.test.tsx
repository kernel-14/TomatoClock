/**
 * Unit tests for StatsList component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsList, formatDuration, formatTime } from './StatsList';
import type { FocusSession } from '../../shared/types';

describe('StatsList', () => {
  const mockSessions: FocusSession[] = [
    {
      id: '1',
      taskName: 'Write code',
      duration: 1500,
      startTime: new Date('2024-01-01T10:00:00'),
      endTime: new Date('2024-01-01T10:25:00'),
      completed: true,
    },
    {
      id: '2',
      taskName: 'Review PR',
      duration: 900,
      startTime: new Date('2024-01-01T11:00:00'),
      endTime: new Date('2024-01-01T11:15:00'),
      completed: false,
    },
  ];

  it('should render empty state when no sessions', () => {
    render(<StatsList sessions={[]} />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
    expect(screen.getByText('Start a focus session to see statistics')).toBeInTheDocument();
  });

  it('should render list of sessions', () => {
    render(<StatsList sessions={mockSessions} />);
    expect(screen.getByText('Write code')).toBeInTheDocument();
    expect(screen.getByText('Review PR')).toBeInTheDocument();
  });

  it('should display task names', () => {
    render(<StatsList sessions={mockSessions} />);
    expect(screen.getByText('Write code')).toBeInTheDocument();
    expect(screen.getByText('Review PR')).toBeInTheDocument();
  });

  it('should display formatted durations', () => {
    render(<StatsList sessions={mockSessions} />);
    expect(screen.getByText('25m')).toBeInTheDocument();
    expect(screen.getByText('15m')).toBeInTheDocument();
  });

  it('should show completed badge for completed sessions', () => {
    render(<StatsList sessions={mockSessions} />);
    const completedBadges = screen.getAllByText('✓ Completed');
    expect(completedBadges).toHaveLength(1);
  });

  it('should not show completed badge for incomplete sessions', () => {
    const incompleteSessions: FocusSession[] = [
      {
        id: '1',
        taskName: 'Task',
        duration: 1500,
        startTime: new Date(),
        endTime: new Date(),
        completed: false,
      },
    ];
    render(<StatsList sessions={incompleteSessions} />);
    expect(screen.queryByText('✓ Completed')).not.toBeInTheDocument();
  });

  it('should render correct number of session items', () => {
    const { container } = render(<StatsList sessions={mockSessions} />);
    const items = container.querySelectorAll('.stats-list-item');
    expect(items).toHaveLength(2);
  });
});

describe('formatDuration', () => {
  it('should format seconds to minutes', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(300)).toBe('5m');
    expect(formatDuration(1500)).toBe('25m');
  });

  it('should format seconds to hours and minutes', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(3660)).toBe('1h 1m');
    expect(formatDuration(7200)).toBe('2h 0m');
    expect(formatDuration(5400)).toBe('1h 30m');
  });

  it('should handle zero seconds', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('should handle partial minutes', () => {
    expect(formatDuration(90)).toBe('1m');
    expect(formatDuration(150)).toBe('2m');
  });
});

describe('formatTime', () => {
  it('should format time correctly', () => {
    const date = new Date('2024-01-01T14:30:00');
    const formatted = formatTime(date);
    // The exact format depends on locale, but should contain time components
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });
});
