/**
 * Unit tests for TimerService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimerService } from './TimerService';

describe('TimerService', () => {
  let timerService: TimerService;

  beforeEach(() => {
    timerService = new TimerService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should start in idle state', () => {
      const state = timerService.getState();
      expect(state.status).toBe('idle');
      expect(state.remainingSeconds).toBe(0);
      expect(state.totalSeconds).toBe(0);
      expect(state.taskName).toBe('');
      expect(state.startTime).toBeNull();
    });
  });

  describe('start()', () => {
    it('should transition from idle to running', () => {
      timerService.start(1500, 'Test Task');
      const state = timerService.getState();
      
      expect(state.status).toBe('running');
      expect(state.remainingSeconds).toBe(1500);
      expect(state.totalSeconds).toBe(1500);
      expect(state.taskName).toBe('Test Task');
      expect(state.startTime).toBeInstanceOf(Date);
    });

    it('should use default task name when empty string provided', () => {
      timerService.start(1500, '');
      const state = timerService.getState();
      
      expect(state.taskName).toBe('未命名任务');
    });

    it('should use default task name for whitespace-only strings', () => {
      timerService.start(1500, '   ');
      expect(timerService.getState().taskName).toBe('未命名任务');
      
      timerService.start(1500, '\t\t');
      expect(timerService.getState().taskName).toBe('未命名任务');
      
      timerService.start(1500, ' \n\t ');
      expect(timerService.getState().taskName).toBe('未命名任务');
    });

    it('should trim whitespace from task names', () => {
      timerService.start(1500, '  Task Name  ');
      expect(timerService.getState().taskName).toBe('Task Name');
    });

    it('should truncate task names longer than 100 characters', () => {
      const longTaskName = 'A'.repeat(150);
      timerService.start(1500, longTaskName);
      
      const state = timerService.getState();
      expect(state.taskName).toHaveLength(100);
      expect(state.taskName).toBe('A'.repeat(100));
    });

    it('should throw error for non-positive duration', () => {
      expect(() => timerService.start(0, 'Test')).toThrow('Duration must be positive');
      expect(() => timerService.start(-10, 'Test')).toThrow('Duration must be positive');
    });

    it('should emit initial tick event', () => {
      const tickCallback = vi.fn();
      timerService.onTick(tickCallback);
      
      timerService.start(1500, 'Test Task');
      
      expect(tickCallback).toHaveBeenCalledWith(1500);
    });

    it('should stop existing timer when starting new one', () => {
      timerService.start(1500, 'Task 1');
      vi.advanceTimersByTime(2000);
      
      timerService.start(1000, 'Task 2');
      const state = timerService.getState();
      
      expect(state.remainingSeconds).toBe(1000);
      expect(state.taskName).toBe('Task 2');
    });
  });

  describe('tick events', () => {
    it('should emit tick event every second', () => {
      const tickCallback = vi.fn();
      timerService.onTick(tickCallback);
      
      timerService.start(5, 'Test Task');
      tickCallback.mockClear(); // Clear the initial tick
      
      vi.advanceTimersByTime(1000);
      expect(tickCallback).toHaveBeenCalledWith(4);
      
      vi.advanceTimersByTime(1000);
      expect(tickCallback).toHaveBeenCalledWith(3);
      
      vi.advanceTimersByTime(1000);
      expect(tickCallback).toHaveBeenCalledWith(2);
    });

    it('should decrease remaining seconds correctly', () => {
      timerService.start(10, 'Test Task');
      
      vi.advanceTimersByTime(3000);
      expect(timerService.getState().remainingSeconds).toBe(7);
      
      vi.advanceTimersByTime(5000);
      expect(timerService.getState().remainingSeconds).toBe(2);
    });
  });

  describe('pause()', () => {
    it('should pause running timer', () => {
      timerService.start(10, 'Test Task');
      vi.advanceTimersByTime(3000);
      
      timerService.pause();
      const remainingBeforePause = timerService.getState().remainingSeconds;
      
      vi.advanceTimersByTime(5000);
      const remainingAfterPause = timerService.getState().remainingSeconds;
      
      expect(timerService.getState().status).toBe('paused');
      expect(remainingAfterPause).toBe(remainingBeforePause);
    });

    it('should do nothing when pausing non-running timer', () => {
      timerService.pause();
      expect(timerService.getState().status).toBe('idle');
    });
  });

  describe('resume()', () => {
    it('should resume paused timer', () => {
      timerService.start(10, 'Test Task');
      vi.advanceTimersByTime(3000);
      
      timerService.pause();
      const remainingAtPause = timerService.getState().remainingSeconds;
      
      timerService.resume();
      expect(timerService.getState().status).toBe('running');
      
      vi.advanceTimersByTime(2000);
      expect(timerService.getState().remainingSeconds).toBe(remainingAtPause - 2);
    });

    it('should do nothing when resuming non-paused timer', () => {
      timerService.start(10, 'Test Task');
      const stateBefore = timerService.getState();
      
      timerService.resume();
      const stateAfter = timerService.getState();
      
      expect(stateAfter.status).toBe(stateBefore.status);
    });
  });

  describe('reset()', () => {
    it('should reset timer to idle state', () => {
      timerService.start(1500, 'Test Task');
      vi.advanceTimersByTime(5000);
      
      timerService.reset();
      const state = timerService.getState();
      
      expect(state.status).toBe('idle');
      expect(state.remainingSeconds).toBe(0);
      expect(state.totalSeconds).toBe(0);
      expect(state.taskName).toBe('');
      expect(state.startTime).toBeNull();
    });

    it('should stop timer interval', () => {
      const tickCallback = vi.fn();
      timerService.onTick(tickCallback);
      
      timerService.start(10, 'Test Task');
      tickCallback.mockClear();
      
      timerService.reset();
      vi.advanceTimersByTime(5000);
      
      expect(tickCallback).not.toHaveBeenCalled();
    });
  });

  describe('complete event', () => {
    it('should emit complete event when timer reaches zero', () => {
      const completeCallback = vi.fn();
      timerService.onComplete(completeCallback);
      
      timerService.start(3, 'Test Task');
      vi.advanceTimersByTime(3000);
      
      expect(completeCallback).toHaveBeenCalled();
      expect(timerService.getState().status).toBe('idle');
      expect(timerService.getState().remainingSeconds).toBe(0);
    });

    it('should stop emitting tick events after completion', () => {
      const tickCallback = vi.fn();
      timerService.onTick(tickCallback);
      
      timerService.start(2, 'Test Task');
      tickCallback.mockClear();
      
      vi.advanceTimersByTime(2000);
      const tickCountAtCompletion = tickCallback.mock.calls.length;
      
      vi.advanceTimersByTime(5000);
      const tickCountAfterCompletion = tickCallback.mock.calls.length;
      
      expect(tickCountAfterCompletion).toBe(tickCountAtCompletion);
    });
  });

  describe('Event subscription', () => {
    it('should allow subscribing and unsubscribing from tick events', () => {
      const tickCallback = vi.fn();
      
      timerService.onTick(tickCallback);
      timerService.start(5, 'Test Task');
      tickCallback.mockClear();
      
      vi.advanceTimersByTime(1000);
      expect(tickCallback).toHaveBeenCalledTimes(1);
      
      timerService.offTick(tickCallback);
      vi.advanceTimersByTime(1000);
      expect(tickCallback).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should allow subscribing and unsubscribing from complete events', () => {
      const completeCallback = vi.fn();
      
      timerService.onComplete(completeCallback);
      timerService.start(2, 'Test Task');
      
      timerService.offComplete(completeCallback);
      vi.advanceTimersByTime(2000);
      
      expect(completeCallback).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle very short durations', () => {
      const completeCallback = vi.fn();
      timerService.onComplete(completeCallback);
      
      timerService.start(1, 'Test Task');
      vi.advanceTimersByTime(1000);
      
      expect(completeCallback).toHaveBeenCalled();
    });

    it('should not go below zero remaining seconds', () => {
      timerService.start(2, 'Test Task');
      vi.advanceTimersByTime(5000);
      
      expect(timerService.getState().remainingSeconds).toBe(0);
    });

    it('should handle pause and resume multiple times', () => {
      timerService.start(10, 'Test Task');
      
      vi.advanceTimersByTime(2000);
      timerService.pause();
      
      vi.advanceTimersByTime(1000);
      timerService.resume();
      
      vi.advanceTimersByTime(2000);
      timerService.pause();
      
      vi.advanceTimersByTime(1000);
      timerService.resume();
      
      vi.advanceTimersByTime(2000);
      
      expect(timerService.getState().remainingSeconds).toBe(4);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid duration (zero)', () => {
      expect(() => timerService.start(0, 'Test Task')).toThrow('Duration must be positive');
    });

    it('should throw error for invalid duration (negative)', () => {
      expect(() => timerService.start(-100, 'Test Task')).toThrow('Duration must be positive');
    });

    it('should handle errors during tick without crashing', () => {
      // Start a timer
      timerService.start(10, 'Test Task');
      
      // Mock emit to throw an error
      const originalEmit = timerService.emit.bind(timerService);
      vi.spyOn(timerService, 'emit').mockImplementation((event: string, ...args: any[]) => {
        if (event === 'tick') {
          throw new Error('Tick handler error');
        }
        return originalEmit(event, ...args);
      });

      // Timer should continue despite error
      expect(() => {
        vi.advanceTimersByTime(1000);
      }).not.toThrow();

      // Timer should still be running
      expect(timerService.getState().status).toBe('running');
    });

    it('should handle errors in event listeners gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalCallback = vi.fn();

      timerService.onTick(errorCallback);
      timerService.onTick(normalCallback);

      // Start timer - should not crash even if one listener throws
      expect(() => {
        timerService.start(5, 'Test Task');
      }).not.toThrow();

      // Normal callback should still be called
      expect(normalCallback).toHaveBeenCalled();
    });

    it('should handle pause on idle timer without error', () => {
      expect(() => {
        timerService.pause();
      }).not.toThrow();
      
      expect(timerService.getState().status).toBe('idle');
    });

    it('should handle resume on idle timer without error', () => {
      expect(() => {
        timerService.resume();
      }).not.toThrow();
      
      expect(timerService.getState().status).toBe('idle');
    });

    it('should handle resume on running timer without error', () => {
      timerService.start(10, 'Test Task');
      
      expect(() => {
        timerService.resume();
      }).not.toThrow();
      
      expect(timerService.getState().status).toBe('running');
    });

    it('should handle multiple reset calls without error', () => {
      timerService.start(10, 'Test Task');
      
      expect(() => {
        timerService.reset();
        timerService.reset();
        timerService.reset();
      }).not.toThrow();
      
      expect(timerService.getState().status).toBe('idle');
    });

    it('should handle reset on idle timer without error', () => {
      expect(() => {
        timerService.reset();
      }).not.toThrow();
      
      expect(timerService.getState().status).toBe('idle');
    });

    it('should clean up interval when timer completes', () => {
      const tickCallback = vi.fn();
      timerService.onTick(tickCallback);
      
      timerService.start(2, 'Test Task');
      tickCallback.mockClear();
      
      // Complete the timer
      vi.advanceTimersByTime(2000);
      
      // Clear tick count
      const ticksAtCompletion = tickCallback.mock.calls.length;
      
      // Advance more time - no more ticks should occur
      vi.advanceTimersByTime(5000);
      
      expect(tickCallback.mock.calls.length).toBe(ticksAtCompletion);
    });

    it('should handle starting new timer while one is running', () => {
      timerService.start(10, 'Task 1');
      vi.advanceTimersByTime(3000);
      
      const remainingBefore = timerService.getState().remainingSeconds;
      
      // Start new timer - should stop the old one
      expect(() => {
        timerService.start(5, 'Task 2');
      }).not.toThrow();
      
      const state = timerService.getState();
      expect(state.taskName).toBe('Task 2');
      expect(state.remainingSeconds).toBe(5);
      expect(state.totalSeconds).toBe(5);
    });

    it('should handle unsubscribing non-existent callback', () => {
      const callback = vi.fn();
      
      // Unsubscribe without subscribing first
      expect(() => {
        timerService.offTick(callback);
        timerService.offComplete(callback);
      }).not.toThrow();
    });

    it('should continue working after error in complete handler', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Complete handler error');
      });
      
      timerService.onComplete(errorCallback);
      timerService.start(1, 'Test Task');
      
      // Should not crash when complete event fires
      expect(() => {
        vi.advanceTimersByTime(1000);
      }).not.toThrow();
      
      // Should be able to start new timer
      expect(() => {
        timerService.start(5, 'New Task');
      }).not.toThrow();
      
      expect(timerService.getState().status).toBe('running');
    });
  });
});
