/**
 * Integration Tests for Complete Timer Workflow
 * 
 * These tests verify the end-to-end timer workflow:
 * 1. Start timer with a task name
 * 2. Timer counts down correctly
 * 3. Timer completes and triggers notification
 * 4. Session data is saved to database
 * 5. Saved session can be loaded back
 * 6. Complete flow works end-to-end
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 2.4, 3.1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimerService } from './TimerService';
import { DataService } from './DataService';
import { NotificationService } from './NotificationService';
import { FocusSession } from '../shared/types';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Helper function to generate unique IDs
function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Mock Electron's Notification API
const mockNotification = {
  show: vi.fn(),
};

vi.mock('electron', () => ({
  Notification: vi.fn(() => mockNotification),
}));

// Add isSupported static method to the mocked Notification
const { Notification } = await import('electron');
(Notification as any).isSupported = vi.fn(() => true);

describe('Timer Flow Integration Tests', () => {
  let timerService: TimerService;
  let dataService: DataService;
  let notificationService: NotificationService;
  let testDbPath: string;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pomodoro-timer-flow-test-'));
    testDbPath = path.join(tempDir, 'test.db');

    // Initialize services
    dataService = new DataService(testDbPath);
    await dataService.initialize();
    
    timerService = new TimerService();
    notificationService = new NotificationService(true);

    // Use fake timers for controlled time advancement
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Clean up
    dataService.close();
    vi.restoreAllMocks();
    vi.useRealTimers();

    // Clean up temp directory
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (e) {
            // Ignore cleanup errors
          }
        });
        fs.rmdirSync(tempDir);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Timer Workflow', () => {
    it('should complete full timer workflow from start to completion', async () => {
      // Validates: Requirements 1.1, 1.2, 1.3, 2.4, 3.1
      
      const taskName = 'Write integration tests';
      const duration = 60; // 60 seconds (minimum valid duration)
      let completionTriggered = false;
      const tickValues: number[] = [];

      // Set up event listeners
      timerService.onTick((remainingSeconds) => {
        tickValues.push(remainingSeconds);
      });

      timerService.onComplete(() => {
        completionTriggered = true;
      });

      // Step 1: Start timer with task name (Requirement 1.1)
      timerService.start(duration, taskName);

      const initialState = timerService.getState();
      expect(initialState.status).toBe('running');
      expect(initialState.totalSeconds).toBe(duration);
      expect(initialState.remainingSeconds).toBe(duration);
      expect(initialState.taskName).toBe(taskName);
      expect(initialState.startTime).toBeInstanceOf(Date);

      // Step 2: Timer counts down correctly (Requirement 1.2)
      // Advance time by 10 seconds
      vi.advanceTimersByTime(10000);
      expect(timerService.getState().remainingSeconds).toBe(50);

      // Advance time by 20 more seconds
      vi.advanceTimersByTime(20000);
      expect(timerService.getState().remainingSeconds).toBe(30);

      // Advance time by 30 more seconds to complete
      vi.advanceTimersByTime(30000);
      expect(timerService.getState().remainingSeconds).toBe(0);

      // Step 3: Timer completes and triggers notification (Requirement 1.3)
      expect(completionTriggered).toBe(true);
      expect(timerService.getState().status).toBe('idle');

      // Verify tick events were emitted
      expect(tickValues.length).toBeGreaterThan(0);
      expect(tickValues[0]).toBe(duration); // Initial tick

      // Step 4: Session data is saved to database (Requirements 2.4, 3.1)
      const sessionId = generateId();
      const startTime = initialState.startTime!;
      const endTime = new Date(startTime.getTime() + duration * 1000);

      const session: FocusSession = {
        id: sessionId,
        taskName: taskName,
        duration: duration,
        startTime: startTime,
        endTime: endTime,
        completed: true,
      };

      await dataService.saveFocusSession(session);

      // Step 5: Saved session can be loaded back (Requirement 3.1)
      const loadedSessions = await dataService.getFocusSessions(new Date());
      expect(loadedSessions).toHaveLength(1);
      
      const loadedSession = loadedSessions[0];
      expect(loadedSession.id).toBe(sessionId);
      expect(loadedSession.taskName).toBe(taskName);
      expect(loadedSession.duration).toBe(duration);
      expect(loadedSession.completed).toBe(true);
      expect(loadedSession.startTime.getTime()).toBe(startTime.getTime());
      expect(loadedSession.endTime.getTime()).toBe(endTime.getTime());
    });

    it('should handle timer pause and resume in workflow', async () => {
      // Validates: Requirements 1.1, 1.2, 1.4
      
      const taskName = 'Test pause and resume';
      const duration = 10;

      // Start timer
      timerService.start(duration, taskName);
      expect(timerService.getState().status).toBe('running');

      // Run for 3 seconds
      vi.advanceTimersByTime(3000);
      expect(timerService.getState().remainingSeconds).toBe(7);

      // Pause timer (Requirement 1.4)
      timerService.pause();
      expect(timerService.getState().status).toBe('paused');
      const pausedTime = timerService.getState().remainingSeconds;
      expect(pausedTime).toBe(7);

      // Advance time while paused - should not change
      vi.advanceTimersByTime(2000);
      expect(timerService.getState().remainingSeconds).toBe(pausedTime);

      // Resume timer
      timerService.resume();
      expect(timerService.getState().status).toBe('running');

      // Continue for 3 more seconds
      vi.advanceTimersByTime(3000);
      expect(timerService.getState().remainingSeconds).toBe(4);

      // Complete the timer
      vi.advanceTimersByTime(4000);
      expect(timerService.getState().remainingSeconds).toBe(0);
      expect(timerService.getState().status).toBe('idle');
    });

    it('should handle timer reset in workflow', async () => {
      // Validates: Requirements 1.1, 1.5
      
      const taskName = 'Test reset';
      const duration = 10;

      // Start timer
      timerService.start(duration, taskName);
      expect(timerService.getState().status).toBe('running');

      // Run for 5 seconds
      vi.advanceTimersByTime(5000);
      expect(timerService.getState().remainingSeconds).toBe(5);

      // Reset timer (Requirement 1.5)
      timerService.reset();
      
      const state = timerService.getState();
      expect(state.status).toBe('idle');
      expect(state.remainingSeconds).toBe(0);
      expect(state.totalSeconds).toBe(0);
      expect(state.taskName).toBe('');
      expect(state.startTime).toBeNull();
    });

    it('should handle empty task name with default value', async () => {
      // Validates: Requirements 2.3, 2.4, 3.1
      
      const duration = 60; // 60 seconds (minimum valid duration)
      const emptyTaskName = '   '; // Whitespace only

      // Start timer with empty task name
      timerService.start(duration, emptyTaskName);

      const state = timerService.getState();
      expect(state.taskName).toBe('未命名任务'); // Default task name

      // Complete the timer
      vi.advanceTimersByTime(60000);
      expect(timerService.getState().status).toBe('idle');

      // Save session with default task name
      const sessionId = generateId();
      const session: FocusSession = {
        id: sessionId,
        taskName: state.taskName,
        duration: duration,
        startTime: state.startTime!,
        endTime: new Date(state.startTime!.getTime() + duration * 1000),
        completed: true,
      };

      await dataService.saveFocusSession(session);

      // Load and verify
      const loadedSessions = await dataService.getFocusSessions(new Date());
      expect(loadedSessions).toHaveLength(1);
      expect(loadedSessions[0].taskName).toBe('未命名任务');
    });

    it('should save multiple completed sessions', async () => {
      // Validates: Requirements 2.4, 3.1
      
      const sessions: FocusSession[] = [];

      // Complete first session
      timerService.start(60, 'Task 1');
      const startTime1 = timerService.getState().startTime!;
      vi.advanceTimersByTime(60000);
      
      sessions.push({
        id: generateId(),
        taskName: 'Task 1',
        duration: 60,
        startTime: startTime1,
        endTime: new Date(startTime1.getTime() + 60000),
        completed: true,
      });

      // Complete second session
      timerService.start(90, 'Task 2');
      const startTime2 = timerService.getState().startTime!;
      vi.advanceTimersByTime(90000);
      
      sessions.push({
        id: generateId(),
        taskName: 'Task 2',
        duration: 90,
        startTime: startTime2,
        endTime: new Date(startTime2.getTime() + 90000),
        completed: true,
      });

      // Complete third session
      timerService.start(120, 'Task 3');
      const startTime3 = timerService.getState().startTime!;
      vi.advanceTimersByTime(120000);
      
      sessions.push({
        id: generateId(),
        taskName: 'Task 3',
        duration: 120,
        startTime: startTime3,
        endTime: new Date(startTime3.getTime() + 120000),
        completed: true,
      });

      // Save all sessions
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      // Load and verify all sessions
      const loadedSessions = await dataService.getFocusSessions(new Date());
      expect(loadedSessions).toHaveLength(3);
      
      // Verify they are in chronological order
      expect(loadedSessions[0].taskName).toBe('Task 1');
      expect(loadedSessions[1].taskName).toBe('Task 2');
      expect(loadedSessions[2].taskName).toBe('Task 3');
    });

    it('should handle incomplete session (timer stopped before completion)', async () => {
      // Validates: Requirements 2.4, 3.1
      
      const taskName = 'Incomplete task';
      const duration = 120; // 2 minutes

      // Start timer
      timerService.start(duration, taskName);
      const startTime = timerService.getState().startTime!;

      // Run for only 60 seconds
      vi.advanceTimersByTime(60000);
      expect(timerService.getState().remainingSeconds).toBe(60);

      // Reset timer before completion
      timerService.reset();

      // Save as incomplete session
      const sessionId = generateId();
      const session: FocusSession = {
        id: sessionId,
        taskName: taskName,
        duration: 60, // Only 60 seconds completed
        startTime: startTime,
        endTime: new Date(startTime.getTime() + 60000),
        completed: false, // Not completed
      };

      await dataService.saveFocusSession(session);

      // Load and verify
      const loadedSessions = await dataService.getFocusSessions(new Date());
      expect(loadedSessions).toHaveLength(1);
      expect(loadedSessions[0].completed).toBe(false);
      expect(loadedSessions[0].duration).toBe(60);
    });

    it('should integrate with notification service on completion', async () => {
      // Validates: Requirement 1.3
      
      const showNotificationSpy = vi.spyOn(notificationService, 'showNotification');
      const playSoundSpy = vi.spyOn(notificationService, 'playSound');

      const taskName = 'Test notification';
      const duration = 60; // 60 seconds

      let completionTriggered = false;
      timerService.onComplete(() => {
        completionTriggered = true;
        // Simulate what the main process would do
        notificationService.showNotification(
          'Pomodoro Completed!',
          `You completed: ${taskName}`
        );
        notificationService.playSound('complete');
      });

      // Start and complete timer
      timerService.start(duration, taskName);
      vi.advanceTimersByTime(60000);

      // Verify completion and notifications
      expect(completionTriggered).toBe(true);
      expect(showNotificationSpy).toHaveBeenCalledWith(
        'Pomodoro Completed!',
        `You completed: ${taskName}`
      );
      expect(playSoundSpy).toHaveBeenCalledWith('complete');
    });

    it('should handle rapid start-stop cycles', async () => {
      // Validates: Requirements 1.1, 1.5
      
      // Start and immediately reset
      timerService.start(10, 'Task 1');
      expect(timerService.getState().status).toBe('running');
      timerService.reset();
      expect(timerService.getState().status).toBe('idle');

      // Start again
      timerService.start(10, 'Task 2');
      expect(timerService.getState().status).toBe('running');
      expect(timerService.getState().taskName).toBe('Task 2');

      // Run for a bit
      vi.advanceTimersByTime(2000);
      expect(timerService.getState().remainingSeconds).toBe(8);

      // Start a new timer (should stop the old one)
      timerService.start(5, 'Task 3');
      expect(timerService.getState().status).toBe('running');
      expect(timerService.getState().totalSeconds).toBe(5);
      expect(timerService.getState().taskName).toBe('Task 3');
    });

    it('should maintain data consistency across timer lifecycle', async () => {
      // Validates: Requirements 1.1, 1.2, 2.4, 3.1
      
      const taskName = 'Consistency test';
      const duration = 100; // 100 seconds

      // Start timer
      timerService.start(duration, taskName);
      const startTime = timerService.getState().startTime!;

      // Track state at different points
      const states: Array<{ time: number; remaining: number }> = [];

      timerService.onTick((remaining) => {
        states.push({ time: Date.now(), remaining });
      });

      // Run timer for full duration
      for (let i = 0; i < duration; i++) {
        vi.advanceTimersByTime(1000);
      }

      // Verify timer completed
      expect(timerService.getState().status).toBe('idle');
      expect(timerService.getState().remainingSeconds).toBe(0);

      // Save session
      const sessionId = generateId();
      const session: FocusSession = {
        id: sessionId,
        taskName: taskName,
        duration: duration,
        startTime: startTime,
        endTime: new Date(startTime.getTime() + duration * 1000),
        completed: true,
      };

      await dataService.saveFocusSession(session);

      // Load and verify consistency
      const loadedSessions = await dataService.getFocusSessions(new Date());
      expect(loadedSessions).toHaveLength(1);
      
      const loadedSession = loadedSessions[0];
      const actualDuration = (loadedSession.endTime.getTime() - loadedSession.startTime.getTime()) / 1000;
      expect(actualDuration).toBe(duration);
      expect(loadedSession.completed).toBe(true);
    });

    it('should handle sessions across different dates', async () => {
      // Validates: Requirements 2.4, 3.1
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create session for today
      const todaySession: FocusSession = {
        id: generateId(),
        taskName: 'Today task',
        duration: 1500,
        startTime: today,
        endTime: new Date(today.getTime() + 1500000),
        completed: true,
      };

      // Create session for yesterday
      const yesterdaySession: FocusSession = {
        id: generateId(),
        taskName: 'Yesterday task',
        duration: 1500,
        startTime: yesterday,
        endTime: new Date(yesterday.getTime() + 1500000),
        completed: true,
      };

      // Save both sessions
      await dataService.saveFocusSession(todaySession);
      await dataService.saveFocusSession(yesterdaySession);

      // Load today's sessions
      const todaySessions = await dataService.getFocusSessions(today);
      expect(todaySessions).toHaveLength(1);
      expect(todaySessions[0].taskName).toBe('Today task');

      // Load yesterday's sessions
      const yesterdaySessions = await dataService.getFocusSessions(yesterday);
      expect(yesterdaySessions).toHaveLength(1);
      expect(yesterdaySessions[0].taskName).toBe('Yesterday task');
    });
  });

  describe('Error Handling in Timer Flow', () => {
    it('should handle database errors during session save', async () => {
      // Validates: Requirement 3.4
      
      const taskName = 'Test error handling';
      const duration = 60; // 60 seconds

      // Start and complete timer
      timerService.start(duration, taskName);
      const startTime = timerService.getState().startTime!;
      vi.advanceTimersByTime(60000);

      // Close database to simulate error
      dataService.close();

      // Try to save session - should fail
      const session: FocusSession = {
        id: generateId(),
        taskName: taskName,
        duration: duration,
        startTime: startTime,
        endTime: new Date(startTime.getTime() + duration * 1000),
        completed: true,
      };

      await expect(dataService.saveFocusSession(session)).rejects.toThrow('Database not initialized');

      // Re-initialize database
      await dataService.initialize();

      // Retry save - should succeed
      await expect(dataService.saveFocusSession(session)).resolves.not.toThrow();

      // Verify session was saved
      const loadedSessions = await dataService.getFocusSessions(new Date());
      expect(loadedSessions).toHaveLength(1);
    });

    it('should handle invalid session data', async () => {
      // Validates: Requirements 2.2, 3.4
      
      const invalidSession: any = {
        id: generateId(),
        taskName: 'Test',
        duration: -1, // Invalid duration
        startTime: new Date(),
        endTime: new Date(Date.now() + 1000),
        completed: true,
      };

      await expect(dataService.saveFocusSession(invalidSession)).rejects.toThrow(
        'Focus session duration must be between 60 and 7200 seconds'
      );
    });

    it('should handle timer errors gracefully', () => {
      // Validates: Requirement 1.1
      
      // Try to start with invalid duration
      expect(() => timerService.start(0, 'Test')).toThrow('Duration must be positive');
      expect(() => timerService.start(-5, 'Test')).toThrow('Duration must be positive');

      // Timer should still be usable after error
      expect(() => timerService.start(10, 'Valid task')).not.toThrow();
      expect(timerService.getState().status).toBe('running');
    });
  });

  describe('Performance and Timing Accuracy', () => {
    it('should maintain accurate timing over longer durations', async () => {
      // Validates: Requirement 1.2
      
      const duration = 60; // 1 minute
      const taskName = 'Long duration test';

      timerService.start(duration, taskName);

      // Advance in 10-second increments
      for (let i = 0; i < 6; i++) {
        vi.advanceTimersByTime(10000);
        const expectedRemaining = duration - (i + 1) * 10;
        const actualRemaining = timerService.getState().remainingSeconds;
        
        // Allow small tolerance for timing
        expect(Math.abs(actualRemaining - expectedRemaining)).toBeLessThanOrEqual(1);
      }

      expect(timerService.getState().remainingSeconds).toBe(0);
      expect(timerService.getState().status).toBe('idle');
    });

    it('should handle multiple tick listeners efficiently', async () => {
      // Validates: Requirement 1.2
      
      const duration = 5;
      const listener1Values: number[] = [];
      const listener2Values: number[] = [];
      const listener3Values: number[] = [];

      timerService.onTick((remaining) => listener1Values.push(remaining));
      timerService.onTick((remaining) => listener2Values.push(remaining));
      timerService.onTick((remaining) => listener3Values.push(remaining));

      timerService.start(duration, 'Multi-listener test');
      vi.advanceTimersByTime(5000);

      // All listeners should receive all ticks
      expect(listener1Values.length).toBeGreaterThan(0);
      expect(listener2Values.length).toBe(listener1Values.length);
      expect(listener3Values.length).toBe(listener1Values.length);

      // All should have same values
      expect(listener1Values).toEqual(listener2Values);
      expect(listener2Values).toEqual(listener3Values);
    });
  });
});
