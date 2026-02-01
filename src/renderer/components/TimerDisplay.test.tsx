/**
 * Unit tests for TimerDisplay component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimerDisplay, formatTime } from './TimerDisplay';

describe('TimerDisplay', () => {
  it('should render time in MM:SS format', () => {
    render(<TimerDisplay remainingSeconds={1500} status="idle" />);
    expect(screen.getByText('25:00')).toBeInTheDocument();
  });

  it('should format single digit seconds with leading zero', () => {
    render(<TimerDisplay remainingSeconds={65} status="idle" />);
    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('should display "Ready" status for idle state', () => {
    render(<TimerDisplay remainingSeconds={1500} status="idle" />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('should display "running" status for running state', () => {
    render(<TimerDisplay remainingSeconds={1500} status="running" />);
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('should display "paused" status for paused state', () => {
    render(<TimerDisplay remainingSeconds={1500} status="paused" />);
    expect(screen.getByText('paused')).toBeInTheDocument();
  });

  it('should apply correct color class for idle status', () => {
    const { container } = render(<TimerDisplay remainingSeconds={1500} status="idle" />);
    const timeElement = container.querySelector('.text-gray-600');
    expect(timeElement).toBeInTheDocument();
  });

  it('should apply correct color class for running status', () => {
    const { container } = render(<TimerDisplay remainingSeconds={1500} status="running" />);
    const timeElement = container.querySelector('.text-blue-600');
    expect(timeElement).toBeInTheDocument();
  });

  it('should apply correct color class for paused status', () => {
    const { container } = render(<TimerDisplay remainingSeconds={1500} status="paused" />);
    const timeElement = container.querySelector('.text-yellow-600');
    expect(timeElement).toBeInTheDocument();
  });

  it('should handle zero seconds', () => {
    render(<TimerDisplay remainingSeconds={0} status="idle" />);
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('should handle large time values', () => {
    render(<TimerDisplay remainingSeconds={3599} status="idle" />);
    expect(screen.getByText('59:59')).toBeInTheDocument();
  });
});

describe('formatTime', () => {
  it('should format 0 seconds as 00:00', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('should format 60 seconds as 01:00', () => {
    expect(formatTime(60)).toBe('01:00');
  });

  it('should format 1500 seconds as 25:00', () => {
    expect(formatTime(1500)).toBe('25:00');
  });

  it('should format 65 seconds as 01:05', () => {
    expect(formatTime(65)).toBe('01:05');
  });

  it('should pad single digit minutes and seconds', () => {
    expect(formatTime(5)).toBe('00:05');
    expect(formatTime(305)).toBe('05:05');
  });
});
