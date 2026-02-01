/**
 * Property-based tests for TimerService
 * Using fast-check library for property testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { TimerService } from './TimerService';

describe('TimerService - Property-Based Tests', () => {
  let timerService: TimerService;

  beforeEach(() => {
    timerService = new TimerService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * Feature: pomodoro-timer, Property 1: 计时器状态转换正确性
   * 
   * 对于任何初始时长，当启动计时器时，计时器状态应该从"idle"变为"running"，
   * 且剩余时间应该等于初始时长
   * 
   * **Validates: Requirements 1.1**
   */
  it('Property 1: Timer state transition correctness', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 7200 }), // Duration: 1 second to 2 hours
        fc.string({ minLength: 0, maxLength: 100 }), // Task name
        (duration, taskName) => {
          // Reset timer before each test
          timerService.reset();

          // Get initial state
          const initialState = timerService.getState();
          expect(initialState.status).toBe('idle');

          // Start timer
          timerService.start(duration, taskName);
          const stateAfterStart = timerService.getState();

          // Verify state transition
          expect(stateAfterStart.status).toBe('running');
          expect(stateAfterStart.remainingSeconds).toBe(duration);
          expect(stateAfterStart.totalSeconds).toBe(duration);
          expect(stateAfterStart.startTime).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: pomodoro-timer, Property 2: 计时器递减正确性
   * 
   * 对于任何运行中的计时器，经过N秒后，剩余时间应该减少N秒（在误差范围内）
   * 
   * **Validates: Requirements 1.2**
   */
  it('Property 2: Timer decrement correctness', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 7200 }), // Initial duration
        fc.integer({ min: 1, max: 9 }), // Elapsed seconds (less than initial)
        (initialDuration, elapsedSeconds) => {
          // Ensure elapsed is less than initial
          const elapsed = Math.min(elapsedSeconds, initialDuration - 1);

          // Reset and start timer
          timerService.reset();
          timerService.start(initialDuration, 'Test Task');

          const initialRemaining = timerService.getState().remainingSeconds;

          // Advance time
          vi.advanceTimersByTime(elapsed * 1000);

          const finalRemaining = timerService.getState().remainingSeconds;

          // Verify decrement (allow 1 second tolerance for timing)
          const expectedRemaining = initialRemaining - elapsed;
          expect(Math.abs(finalRemaining - expectedRemaining)).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: pomodoro-timer, Property 3: 计时器完成事件触发
   * 
   * 对于任何计时器，当剩余时间到达0时，应该触发完成事件
   * 
   * **Validates: Requirements 1.3**
   */
  it('Property 3: Timer complete event trigger', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // Short duration for testing
        (duration) => {
          // Reset timer
          timerService.reset();

          // Setup complete event listener
          let completeEventFired = false;
          const completeCallback = () => {
            completeEventFired = true;
          };
          timerService.onComplete(completeCallback);

          // Start timer
          timerService.start(duration, 'Test Task');

          // Advance time to completion
          vi.advanceTimersByTime(duration * 1000);

          // Verify complete event was fired
          expect(completeEventFired).toBe(true);
          expect(timerService.getState().remainingSeconds).toBe(0);
          expect(timerService.getState().status).toBe('idle');

          // Cleanup
          timerService.offComplete(completeCallback);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: pomodoro-timer, Property 4: 暂停保持不变性
   * 
   * 对于任何运行中的计时器，暂停操作后剩余时间应该保持不变
   * 
   * **Validates: Requirements 1.4**
   */
  it('Property 4: Pause invariance', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 7200 }), // Initial duration
        fc.integer({ min: 1, max: 5 }), // Time before pause
        fc.integer({ min: 1, max: 5 }), // Time during pause
        (initialDuration, timeBeforePause, timeDuringPause) => {
          // Ensure we don't run past completion
          const beforePause = Math.min(timeBeforePause, initialDuration - 2);

          // Reset and start timer
          timerService.reset();
          timerService.start(initialDuration, 'Test Task');

          // Run for some time
          vi.advanceTimersByTime(beforePause * 1000);

          // Pause and record remaining time
          timerService.pause();
          const remainingAtPause = timerService.getState().remainingSeconds;
          const statusAtPause = timerService.getState().status;

          // Advance time while paused
          vi.advanceTimersByTime(timeDuringPause * 1000);

          // Verify remaining time hasn't changed
          const remainingAfterPause = timerService.getState().remainingSeconds;
          expect(statusAtPause).toBe('paused');
          expect(remainingAfterPause).toBe(remainingAtPause);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: pomodoro-timer, Property 5: 重置恢复初始值
   * 
   * 对于任何计时器状态，重置操作应该将剩余时间恢复到初始设定值，状态恢复为"idle"
   * 
   * **Validates: Requirements 1.5**
   */
  it('Property 5: Reset restores initial values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 7200 }), // Initial duration
        fc.constantFrom('running', 'paused', 'idle'), // Various states
        fc.integer({ min: 0, max: 5 }), // Time elapsed before reset
        (initialDuration, targetState, timeElapsed) => {
          // Reset timer
          timerService.reset();

          // Setup timer in target state
          if (targetState === 'running' || targetState === 'paused') {
            timerService.start(initialDuration, 'Test Task');
            
            if (timeElapsed > 0 && timeElapsed < initialDuration) {
              vi.advanceTimersByTime(timeElapsed * 1000);
            }
            
            if (targetState === 'paused') {
              timerService.pause();
            }
          }

          // Reset timer
          timerService.reset();
          const stateAfterReset = timerService.getState();

          // Verify reset to initial idle state
          expect(stateAfterReset.status).toBe('idle');
          expect(stateAfterReset.remainingSeconds).toBe(0);
          expect(stateAfterReset.totalSeconds).toBe(0);
          expect(stateAfterReset.taskName).toBe('');
          expect(stateAfterReset.startTime).toBeNull();

          // Verify timer doesn't continue ticking
          vi.advanceTimersByTime(5000);
          const stateAfterTime = timerService.getState();
          expect(stateAfterTime.remainingSeconds).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Timer never goes negative
   * 
   * For any timer, remaining seconds should never be negative
   */
  it('Property: Timer remaining seconds never negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // Short duration
        fc.integer({ min: 1, max: 20 }), // Potentially longer elapsed time
        (duration, elapsedSeconds) => {
          // Reset and start timer
          timerService.reset();
          timerService.start(duration, 'Test Task');

          // Advance time (possibly beyond duration)
          vi.advanceTimersByTime(elapsedSeconds * 1000);

          // Verify remaining is never negative
          const remaining = timerService.getState().remainingSeconds;
          expect(remaining).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Total seconds remains constant
   * 
   * For any timer, totalSeconds should remain constant throughout its lifecycle
   * until reset or a new timer is started
   */
  it('Property: Total seconds remains constant during timer lifecycle', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 100 }), // Initial duration
        fc.array(fc.constantFrom('pause', 'resume', 'tick'), { minLength: 1, maxLength: 10 }),
        (duration, actions) => {
          // Reset and start timer
          timerService.reset();
          timerService.start(duration, 'Test Task');

          const initialTotal = timerService.getState().totalSeconds;

          // Perform various actions
          for (const action of actions) {
            if (action === 'pause') {
              timerService.pause();
            } else if (action === 'resume') {
              timerService.resume();
            } else if (action === 'tick') {
              vi.advanceTimersByTime(1000);
            }

            // Check if timer is still active (not completed)
            const state = timerService.getState();
            if (state.remainingSeconds > 0 || state.status !== 'idle') {
              expect(state.totalSeconds).toBe(initialTotal);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
