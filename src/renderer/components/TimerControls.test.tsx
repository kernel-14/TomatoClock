/**
 * Unit tests for TimerControls component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimerControls } from './TimerControls';

describe('TimerControls', () => {
  const mockHandlers = {
    onStart: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onReset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('idle state', () => {
    it('should show only Start button when idle', () => {
      render(<TimerControls status="idle" {...mockHandlers} />);
      expect(screen.getByLabelText('Start timer')).toBeInTheDocument();
      expect(screen.queryByLabelText('Pause timer')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Resume timer')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Reset timer')).not.toBeInTheDocument();
    });

    it('should call onStart when Start button is clicked', () => {
      render(<TimerControls status="idle" {...mockHandlers} />);
      fireEvent.click(screen.getByLabelText('Start timer'));
      expect(mockHandlers.onStart).toHaveBeenCalledTimes(1);
    });
  });

  describe('running state', () => {
    it('should show Pause and Reset buttons when running', () => {
      render(<TimerControls status="running" {...mockHandlers} />);
      expect(screen.getByLabelText('Pause timer')).toBeInTheDocument();
      expect(screen.getByLabelText('Reset timer')).toBeInTheDocument();
      expect(screen.queryByLabelText('Start timer')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Resume timer')).not.toBeInTheDocument();
    });

    it('should call onPause when Pause button is clicked', () => {
      render(<TimerControls status="running" {...mockHandlers} />);
      fireEvent.click(screen.getByLabelText('Pause timer'));
      expect(mockHandlers.onPause).toHaveBeenCalledTimes(1);
    });

    it('should call onReset when Reset button is clicked', () => {
      render(<TimerControls status="running" {...mockHandlers} />);
      fireEvent.click(screen.getByLabelText('Reset timer'));
      expect(mockHandlers.onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('paused state', () => {
    it('should show Resume and Reset buttons when paused', () => {
      render(<TimerControls status="paused" {...mockHandlers} />);
      expect(screen.getByLabelText('Resume timer')).toBeInTheDocument();
      expect(screen.getByLabelText('Reset timer')).toBeInTheDocument();
      expect(screen.queryByLabelText('Start timer')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Pause timer')).not.toBeInTheDocument();
    });

    it('should call onResume when Resume button is clicked', () => {
      render(<TimerControls status="paused" {...mockHandlers} />);
      fireEvent.click(screen.getByLabelText('Resume timer'));
      expect(mockHandlers.onResume).toHaveBeenCalledTimes(1);
    });

    it('should call onReset when Reset button is clicked', () => {
      render(<TimerControls status="paused" {...mockHandlers} />);
      fireEvent.click(screen.getByLabelText('Reset timer'));
      expect(mockHandlers.onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('button styling', () => {
    it('should apply primary button style to Start button', () => {
      render(<TimerControls status="idle" {...mockHandlers} />);
      const startButton = screen.getByLabelText('Start timer');
      expect(startButton).toHaveClass('bg-blue-500');
    });

    it('should apply warning button style to Pause button', () => {
      render(<TimerControls status="running" {...mockHandlers} />);
      const pauseButton = screen.getByLabelText('Pause timer');
      expect(pauseButton).toHaveClass('bg-yellow-500');
    });

    it('should apply secondary button style to Reset button', () => {
      render(<TimerControls status="running" {...mockHandlers} />);
      const resetButton = screen.getByLabelText('Reset timer');
      expect(resetButton).toHaveClass('bg-gray-200');
    });
  });
});
