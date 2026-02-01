/**
 * Integration Tests for Statistics Functionality
 * 
 * These tests verify the end-to-end statistics workflow:
 * 1. Calculate statistics for multiple sessions
 * 2. Test date filtering (today, specific dates)
 * 3. Test time-based sorting
 * 4. Test aggregation (total time, session count)
 * 5. Test empty data handling
 * 
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Electron app for DataService
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/appdata'),
  },
}));
import { StatisticsModule } from './StatisticsModule';
import { DataService } from './DataService';
import { FocusSession } from '../shared/types';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Helper function to generate unique IDs
function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

describe('Statistics Integration Tests', () => {
  let dataService: DataService;
  let statisticsModule: StatisticsModule;
  let testDbPath: string;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pomodoro-stats-integration-'));
    testDbPath = path.join(tempDir, 'test.db');

    // Initialize services
    dataService = new DataService(testDbPath);
    await dataService.initialize();
    statisticsModule = new StatisticsModule(dataService);
  });

  afterEach(() => {
    // Clean up
    dataService.close();

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

  describe('Multiple Sessions Statistics', () => {
    it('should calculate statistics for multiple sessions on the same day', async () => {
      // Validates: Requirements 4.1, 4.2, 4.3
      
      const date = new Date('2024-01-15');
      const sessions: FocusSession[] = [
        {
          id: generateId(),
          taskName: 'Morning Task',
          duration: 1500, // 25 minutes
          startTime: new Date('2024-01-15T09:00:00Z'),
          endTime: new Date('2024-01-15T09:25:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Midday Task',
          duration: 900, // 15 minutes
          startTime: new Date('2024-01-15T12:00:00Z'),
          endTime: new Date('2024-01-15T12:15:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Afternoon Task',
          duration: 1800, // 30 minutes
          startTime: new Date('2024-01-15T15:00:00Z'),
          endTime: new Date('2024-01-15T15:30:00Z'),
          completed: false,
        },
        {
          id: generateId(),
          taskName: 'Evening Task',
          duration: 600, // 10 minutes
          startTime: new Date('2024-01-15T18:00:00Z'),
          endTime: new Date('2024-01-15T18:10:00Z'),
          completed: true,
        },
      ];

      // Save all sessions
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      // Calculate statistics
      const stats = await statisticsModule.calculateDailyStats(date);

      // Verify total focus time (Requirement 4.1)
      const expectedTotal = 1500 + 900 + 1800 + 600;
      expect(stats.totalFocusTime).toBe(expectedTotal);

      // Verify session count (Requirement 4.2)
      expect(stats.sessionCount).toBe(4);
      expect(stats.sessions).toHaveLength(4);

      // Verify sessions are sorted by time (Requirement 4.3)
      expect(stats.sessions[0].taskName).toBe('Morning Task');
      expect(stats.sessions[1].taskName).toBe('Midday Task');
      expect(stats.sessions[2].taskName).toBe('Afternoon Task');
      expect(stats.sessions[3].taskName).toBe('Evening Task');

      // Verify completion rate
      expect(stats.completionRate).toBe(0.75); // 3 out of 4 completed
    });

    it('should handle sessions with varying durations', async () => {
      // Validates: Requirements 4.1, 4.2
      
      const date = new Date('2024-02-20');
      const sessions: FocusSession[] = [
        {
          id: generateId(),
          taskName: 'Short Task',
          duration: 60, // 1 minute (minimum)
          startTime: new Date('2024-02-20T10:00:00Z'),
          endTime: new Date('2024-02-20T10:01:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Long Task',
          duration: 7200, // 2 hours (maximum)
          startTime: new Date('2024-02-20T11:00:00Z'),
          endTime: new Date('2024-02-20T13:00:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Medium Task',
          duration: 1500, // 25 minutes
          startTime: new Date('2024-02-20T14:00:00Z'),
          endTime: new Date('2024-02-20T14:25:00Z'),
          completed: true,
        },
      ];

      // Save all sessions
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      // Calculate statistics
      const stats = await statisticsModule.calculateDailyStats(date);

      // Verify total time calculation
      expect(stats.totalFocusTime).toBe(60 + 7200 + 1500);
      expect(stats.sessionCount).toBe(3);
      expect(stats.completionRate).toBe(1); // All completed
    });

    it('should calculate statistics for a full day of work', async () => {
      // Validates: Requirements 4.1, 4.2, 4.3
      
      const date = new Date('2024-03-10');
      const sessions: FocusSession[] = [];

      // Create 8 pomodoro sessions throughout the day
      const startHours = [9, 10, 11, 13, 14, 15, 16, 17];
      for (let i = 0; i < startHours.length; i++) {
        const hour = startHours[i];
        sessions.push({
          id: generateId(),
          taskName: `Task ${i + 1}`,
          duration: 1500, // 25 minutes each
          startTime: new Date(`2024-03-10T${String(hour).padStart(2, '0')}:00:00Z`),
          endTime: new Date(`2024-03-10T${String(hour).padStart(2, '0')}:25:00Z`),
          completed: i < 7, // Last one incomplete
        });
      }

      // Save all sessions
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      // Calculate statistics
      const stats = await statisticsModule.calculateDailyStats(date);

      // Verify aggregation
      expect(stats.totalFocusTime).toBe(1500 * 8); // 8 sessions * 25 minutes
      expect(stats.sessionCount).toBe(8);
      expect(stats.completionRate).toBe(7 / 8); // 7 completed out of 8

      // Verify chronological order
      for (let i = 1; i < stats.sessions.length; i++) {
        const prevTime = stats.sessions[i - 1].startTime.getTime();
        const currTime = stats.sessions[i].startTime.getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });
  });

  describe('Date Filtering', () => {
    it('should filter sessions by specific date correctly', async () => {
      // Validates: Requirement 4.4
      
      // Create sessions across multiple days
      const sessions: FocusSession[] = [
        {
          id: generateId(),
          taskName: 'Jan 14 Task',
          duration: 1500,
          startTime: new Date('2024-01-14T10:00:00Z'),
          endTime: new Date('2024-01-14T10:25:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Jan 15 Task 1',
          duration: 900,
          startTime: new Date('2024-01-15T09:00:00Z'),
          endTime: new Date('2024-01-15T09:15:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Jan 15 Task 2',
          duration: 1200,
          startTime: new Date('2024-01-15T14:00:00Z'),
          endTime: new Date('2024-01-15T14:20:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Jan 16 Task',
          duration: 1800,
          startTime: new Date('2024-01-16T11:00:00Z'),
          endTime: new Date('2024-01-16T11:30:00Z'),
          completed: true,
        },
      ];

      // Save all sessions
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      // Get statistics for Jan 15
      const stats15 = await statisticsModule.calculateDailyStats(new Date('2024-01-15'));

      // Should only include Jan 15 sessions
      expect(stats15.sessionCount).toBe(2);
      expect(stats15.sessions[0].taskName).toBe('Jan 15 Task 1');
      expect(stats15.sessions[1].taskName).toBe('Jan 15 Task 2');
      expect(stats15.totalFocusTime).toBe(900 + 1200);

      // Get statistics for Jan 14
      const stats14 = await statisticsModule.calculateDailyStats(new Date('2024-01-14'));

      // Should only include Jan 14 sessions
      expect(stats14.sessionCount).toBe(1);
      expect(stats14.sessions[0].taskName).toBe('Jan 14 Task');
      expect(stats14.totalFocusTime).toBe(1500);

      // Get statistics for Jan 16
      const stats16 = await statisticsModule.calculateDailyStats(new Date('2024-01-16'));

      // Should only include Jan 16 sessions
      expect(stats16.sessionCount).toBe(1);
      expect(stats16.sessions[0].taskName).toBe('Jan 16 Task');
      expect(stats16.totalFocusTime).toBe(1800);
    });

    it('should calculate today statistics correctly', async () => {
      // Validates: Requirements 4.1, 4.2, 4.4
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create sessions for today using UTC to avoid timezone issues
      const todayStart1 = new Date();
      todayStart1.setUTCHours(9, 0, 0, 0);
      const todayEnd1 = new Date(todayStart1.getTime() + 1500 * 1000);

      const todayStart2 = new Date();
      todayStart2.setUTCHours(14, 0, 0, 0);
      const todayEnd2 = new Date(todayStart2.getTime() + 900 * 1000);

      const todaySessions: FocusSession[] = [
        {
          id: generateId(),
          taskName: 'Today Morning',
          duration: 1500,
          startTime: todayStart1,
          endTime: todayEnd1,
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Today Afternoon',
          duration: 900,
          startTime: todayStart2,
          endTime: todayEnd2,
          completed: true,
        },
      ];

      // Create session for yesterday using UTC
      const yesterdayStart = new Date(yesterday);
      yesterdayStart.setUTCHours(10, 0, 0, 0);
      const yesterdayEnd = new Date(yesterdayStart.getTime() + 1200 * 1000);

      const yesterdaySession: FocusSession = {
        id: generateId(),
        taskName: 'Yesterday Task',
        duration: 1200,
        startTime: yesterdayStart,
        endTime: yesterdayEnd,
        completed: true,
      };

      // Save all sessions
      for (const session of todaySessions) {
        await dataService.saveFocusSession(session);
      }
      await dataService.saveFocusSession(yesterdaySession);

      // Calculate today's statistics
      const todayStats = await statisticsModule.calculateTodayStats();

      // Should only include today's sessions
      expect(todayStats.sessionCount).toBe(2);
      expect(todayStats.totalFocusTime).toBe(1500 + 900);
      expect(todayStats.sessions[0].taskName).toBe('Today Morning');
      expect(todayStats.sessions[1].taskName).toBe('Today Afternoon');
    });

    it('should handle sessions at midnight boundary correctly', async () => {
      // Validates: Requirement 4.4
      
      const sessions: FocusSession[] = [
        {
          id: generateId(),
          taskName: 'Before Midnight',
          duration: 1500,
          startTime: new Date('2024-01-15T23:45:00Z'),
          endTime: new Date('2024-01-16T00:10:00Z'), // Ends after midnight
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'At Midnight',
          duration: 900,
          startTime: new Date('2024-01-16T00:00:00Z'),
          endTime: new Date('2024-01-16T00:15:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'After Midnight',
          duration: 1200,
          startTime: new Date('2024-01-16T00:30:00Z'),
          endTime: new Date('2024-01-16T00:50:00Z'),
          completed: true,
        },
      ];

      // Save all sessions
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      // Get statistics for Jan 15
      const stats15 = await statisticsModule.calculateDailyStats(new Date('2024-01-15'));

      // Should only include session that started on Jan 15
      expect(stats15.sessionCount).toBe(1);
      expect(stats15.sessions[0].taskName).toBe('Before Midnight');

      // Get statistics for Jan 16
      const stats16 = await statisticsModule.calculateDailyStats(new Date('2024-01-16'));

      // Should include sessions that started on Jan 16
      expect(stats16.sessionCount).toBe(2);
      expect(stats16.sessions[0].taskName).toBe('At Midnight');
      expect(stats16.sessions[1].taskName).toBe('After Midnight');
      expect(stats16.totalFocusTime).toBe(900 + 1200);
    });

    it('should handle different timezones correctly', async () => {
      // Validates: Requirement 4.4
      
      // Create sessions with different timezone representations
      const sessions: FocusSession[] = [
        {
          id: generateId(),
          taskName: 'UTC Morning',
          duration: 1500,
          startTime: new Date('2024-01-15T08:00:00Z'),
          endTime: new Date('2024-01-15T08:25:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'UTC Evening',
          duration: 900,
          startTime: new Date('2024-01-15T20:00:00Z'),
          endTime: new Date('2024-01-15T20:15:00Z'),
          completed: true,
        },
      ];

      // Save all sessions
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      // Calculate statistics
      const stats = await statisticsModule.calculateDailyStats(new Date('2024-01-15'));

      // Both sessions should be included
      expect(stats.sessionCount).toBe(2);
      expect(stats.totalFocusTime).toBe(1500 + 900);
    });
  });

  describe('Time-Based Sorting', () => {
    it('should sort sessions chronologically regardless of insertion order', async () => {
      // Validates: Requirement 4.3
      
      const date = new Date('2024-01-20');
      const sessions: FocusSession[] = [
        {
          id: generateId(),
          taskName: 'Evening Task',
          duration: 600,
          startTime: new Date('2024-01-20T18:00:00Z'),
          endTime: new Date('2024-01-20T18:10:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Morning Task',
          duration: 1500,
          startTime: new Date('2024-01-20T09:00:00Z'),
          endTime: new Date('2024-01-20T09:25:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Afternoon Task',
          duration: 1200,
          startTime: new Date('2024-01-20T14:00:00Z'),
          endTime: new Date('2024-01-20T14:20:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Midday Task',
          duration: 900,
          startTime: new Date('2024-01-20T12:00:00Z'),
          endTime: new Date('2024-01-20T12:15:00Z'),
          completed: true,
        },
      ];

      // Save sessions in random order
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      // Calculate statistics
      const stats = await statisticsModule.calculateDailyStats(date);

      // Verify chronological order
      expect(stats.sessions[0].taskName).toBe('Morning Task');
      expect(stats.sessions[1].taskName).toBe('Midday Task');
      expect(stats.sessions[2].taskName).toBe('Afternoon Task');
      expect(stats.sessions[3].taskName).toBe('Evening Task');

      // Verify each session is not earlier than the previous
      for (let i = 1; i < stats.sessions.length; i++) {
        const prevTime = stats.sessions[i - 1].startTime.getTime();
        const currTime = stats.sessions[i].startTime.getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });

    it('should handle sessions with same start time', async () => {
      // Validates: Requirement 4.3
      
      const date = new Date('2024-01-25');
      const sameStartTime = new Date('2024-01-25T10:00:00Z');

      const sessions: FocusSession[] = [
        {
          id: generateId(),
          taskName: 'Task A',
          duration: 1500,
          startTime: sameStartTime,
          endTime: new Date('2024-01-25T10:25:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Task B',
          duration: 900,
          startTime: sameStartTime,
          endTime: new Date('2024-01-25T10:15:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Task C',
          duration: 1200,
          startTime: sameStartTime,
          endTime: new Date('2024-01-25T10:20:00Z'),
          completed: true,
        },
      ];

      // Save all sessions
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      // Calculate statistics
      const stats = await statisticsModule.calculateDailyStats(date);

      // All sessions should be included
      expect(stats.sessionCount).toBe(3);
      expect(stats.totalFocusTime).toBe(1500 + 900 + 1200);

      // All should have the same start time
      for (const session of stats.sessions) {
        expect(session.startTime.getTime()).toBe(sameStartTime.getTime());
      }
    });

    it('should maintain sort order across multiple queries', async () => {
      // Validates: Requirement 4.3
      
      const date = new Date('2024-02-01');
      const sessions: FocusSession[] = [];

      // Create 10 sessions at different times
      for (let i = 0; i < 10; i++) {
        sessions.push({
          id: generateId(),
          taskName: `Task ${i + 1}`,
          duration: 1500,
          startTime: new Date(`2024-02-01T${String(9 + i).padStart(2, '0')}:00:00Z`),
          endTime: new Date(`2024-02-01T${String(9 + i).padStart(2, '0')}:25:00Z`),
          completed: true,
        });
      }

      // Save all sessions
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      // Query multiple times
      const stats1 = await statisticsModule.calculateDailyStats(date);
      const stats2 = await statisticsModule.calculateDailyStats(date);
      const stats3 = await statisticsModule.calculateDailyStats(date);

      // All queries should return same order
      expect(stats1.sessions.length).toBe(10);
      expect(stats2.sessions.length).toBe(10);
      expect(stats3.sessions.length).toBe(10);

      for (let i = 0; i < 10; i++) {
        expect(stats1.sessions[i].taskName).toBe(stats2.sessions[i].taskName);
        expect(stats2.sessions[i].taskName).toBe(stats3.sessions[i].taskName);
      }
    });
  });

  describe('Aggregation', () => {
    it('should correctly aggregate total time across sessions', async () => {
      // Validates: Requirement 4.1
      
      const date = new Date('2024-03-05');
      const durations = [60, 300, 900, 1500, 1800, 3600, 7200];
      const sessions: FocusSession[] = [];

      let startHour = 9;
      for (const duration of durations) {
        const startTime = new Date(`2024-03-05T${String(startHour).padStart(2, '0')}:00:00Z`);
        const endTime = new Date(startTime.getTime() + duration * 1000);
        
        sessions.push({
          id: generateId(),
          taskName: `Task ${duration}s`,
          duration: duration,
          startTime: startTime,
          endTime: endTime,
          completed: true,
        });
        
        startHour++;
      }

      // Save all sessions
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      // Calculate statistics
      const stats = await statisticsModule.calculateDailyStats(date);

      // Verify total time is sum of all durations
      const expectedTotal = durations.reduce((sum, d) => sum + d, 0);
      expect(stats.totalFocusTime).toBe(expectedTotal);
      expect(stats.sessionCount).toBe(durations.length);
    });

    it('should correctly count sessions', async () => {
      // Validates: Requirement 4.2
      
      const date = new Date('2024-03-10');

      // Test with 0 sessions
      let stats = await statisticsModule.calculateDailyStats(date);
      expect(stats.sessionCount).toBe(0);

      // Add 1 session
      await dataService.saveFocusSession({
        id: generateId(),
        taskName: 'Task 1',
        duration: 1500,
        startTime: new Date('2024-03-10T09:00:00Z'),
        endTime: new Date('2024-03-10T09:25:00Z'),
        completed: true,
      });

      stats = await statisticsModule.calculateDailyStats(date);
      expect(stats.sessionCount).toBe(1);

      // Add 4 more sessions
      for (let i = 2; i <= 5; i++) {
        await dataService.saveFocusSession({
          id: generateId(),
          taskName: `Task ${i}`,
          duration: 1500,
          startTime: new Date(`2024-03-10T${String(9 + i - 1).padStart(2, '0')}:00:00Z`),
          endTime: new Date(`2024-03-10T${String(9 + i - 1).padStart(2, '0')}:25:00Z`),
          completed: true,
        });
      }

      stats = await statisticsModule.calculateDailyStats(date);
      expect(stats.sessionCount).toBe(5);
    });

    it('should calculate completion rate correctly', async () => {
      // Validates: Requirement 4.2
      
      const date = new Date('2024-03-15');
      const sessions: FocusSession[] = [
        {
          id: generateId(),
          taskName: 'Completed 1',
          duration: 1500,
          startTime: new Date('2024-03-15T09:00:00Z'),
          endTime: new Date('2024-03-15T09:25:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Completed 2',
          duration: 1500,
          startTime: new Date('2024-03-15T10:00:00Z'),
          endTime: new Date('2024-03-15T10:25:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Completed 3',
          duration: 1500,
          startTime: new Date('2024-03-15T11:00:00Z'),
          endTime: new Date('2024-03-15T11:25:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Incomplete 1',
          duration: 1500,
          startTime: new Date('2024-03-15T12:00:00Z'),
          endTime: new Date('2024-03-15T12:25:00Z'),
          completed: false,
        },
        {
          id: generateId(),
          taskName: 'Incomplete 2',
          duration: 1500,
          startTime: new Date('2024-03-15T13:00:00Z'),
          endTime: new Date('2024-03-15T13:25:00Z'),
          completed: false,
        },
      ];

      // Save all sessions
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      // Calculate statistics
      const stats = await statisticsModule.calculateDailyStats(date);

      // 3 completed out of 5 total
      expect(stats.completionRate).toBe(0.6);
      expect(stats.sessionCount).toBe(5);
    });

    it('should handle mixed completed and incomplete sessions', async () => {
      // Validates: Requirements 4.1, 4.2
      
      const date = new Date('2024-03-20');
      const sessions: FocusSession[] = [
        {
          id: generateId(),
          taskName: 'Complete Short',
          duration: 600,
          startTime: new Date('2024-03-20T09:00:00Z'),
          endTime: new Date('2024-03-20T09:10:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Incomplete Long',
          duration: 3600,
          startTime: new Date('2024-03-20T10:00:00Z'),
          endTime: new Date('2024-03-20T11:00:00Z'),
          completed: false,
        },
        {
          id: generateId(),
          taskName: 'Complete Medium',
          duration: 1500,
          startTime: new Date('2024-03-20T12:00:00Z'),
          endTime: new Date('2024-03-20T12:25:00Z'),
          completed: true,
        },
      ];

      // Save all sessions
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      // Calculate statistics
      const stats = await statisticsModule.calculateDailyStats(date);

      // Total time includes both completed and incomplete
      expect(stats.totalFocusTime).toBe(600 + 3600 + 1500);
      expect(stats.sessionCount).toBe(3);
      expect(stats.completionRate).toBeCloseTo(2 / 3, 5);
    });
  });

  describe('Empty Data Handling', () => {
    it('should return empty statistics for date with no sessions', async () => {
      // Validates: Requirement 4.5
      
      const date = new Date('2024-04-01');

      // Calculate statistics for empty date
      const stats = await statisticsModule.calculateDailyStats(date);

      // Should return zero values
      expect(stats.totalFocusTime).toBe(0);
      expect(stats.sessionCount).toBe(0);
      expect(stats.sessions).toEqual([]);
      expect(stats.completionRate).toBe(0);
      expect(stats.date).toEqual(new Date('2024-04-01T00:00:00.000Z'));
    });

    it('should handle empty database gracefully', async () => {
      // Validates: Requirement 4.5
      
      // Don't save any sessions
      const dates = [
        new Date('2024-01-01'),
        new Date('2024-06-15'),
        new Date('2024-12-31'),
      ];

      // All dates should return empty statistics
      for (const date of dates) {
        const stats = await statisticsModule.calculateDailyStats(date);
        expect(stats.totalFocusTime).toBe(0);
        expect(stats.sessionCount).toBe(0);
        expect(stats.sessions).toEqual([]);
        expect(stats.completionRate).toBe(0);
      }
    });

    it('should return empty stats for future dates', async () => {
      // Validates: Requirement 4.5
      
      // Create session for today
      const today = new Date();
      await dataService.saveFocusSession({
        id: generateId(),
        taskName: 'Today Task',
        duration: 1500,
        startTime: today,
        endTime: new Date(today.getTime() + 1500 * 1000),
        completed: true,
      });

      // Query for tomorrow
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const stats = await statisticsModule.calculateDailyStats(tomorrow);

      // Should return empty stats
      expect(stats.totalFocusTime).toBe(0);
      expect(stats.sessionCount).toBe(0);
      expect(stats.sessions).toEqual([]);
    });

    it('should transition from empty to populated correctly', async () => {
      // Validates: Requirements 4.1, 4.2, 4.5
      
      const date = new Date('2024-05-10');

      // Initially empty
      let stats = await statisticsModule.calculateDailyStats(date);
      expect(stats.sessionCount).toBe(0);
      expect(stats.totalFocusTime).toBe(0);

      // Add first session
      await dataService.saveFocusSession({
        id: generateId(),
        taskName: 'First Task',
        duration: 1500,
        startTime: new Date('2024-05-10T09:00:00Z'),
        endTime: new Date('2024-05-10T09:25:00Z'),
        completed: true,
      });

      stats = await statisticsModule.calculateDailyStats(date);
      expect(stats.sessionCount).toBe(1);
      expect(stats.totalFocusTime).toBe(1500);

      // Add more sessions
      await dataService.saveFocusSession({
        id: generateId(),
        taskName: 'Second Task',
        duration: 900,
        startTime: new Date('2024-05-10T10:00:00Z'),
        endTime: new Date('2024-05-10T10:15:00Z'),
        completed: true,
      });

      stats = await statisticsModule.calculateDailyStats(date);
      expect(stats.sessionCount).toBe(2);
      expect(stats.totalFocusTime).toBe(2400);
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle a week of varied activity', async () => {
      // Validates: Requirements 4.1, 4.2, 4.3, 4.4
      
      // Create sessions for a full week
      const weekData = [
        { date: '2024-06-10', count: 5, avgDuration: 1500 }, // Monday - productive
        { date: '2024-06-11', count: 3, avgDuration: 900 },  // Tuesday - light
        { date: '2024-06-12', count: 0, avgDuration: 0 },    // Wednesday - no work
        { date: '2024-06-13', count: 8, avgDuration: 1500 }, // Thursday - very productive
        { date: '2024-06-14', count: 4, avgDuration: 1200 }, // Friday - moderate
        { date: '2024-06-15', count: 0, avgDuration: 0 },    // Saturday - no work
        { date: '2024-06-16', count: 0, avgDuration: 0 },    // Sunday - no work
      ];

      // Create and save sessions
      for (const day of weekData) {
        for (let i = 0; i < day.count; i++) {
          const startTime = new Date(`${day.date}T${String(9 + i).padStart(2, '0')}:00:00Z`);
          const endTime = new Date(startTime.getTime() + day.avgDuration * 1000);
          
          await dataService.saveFocusSession({
            id: generateId(),
            taskName: `${day.date} Task ${i + 1}`,
            duration: day.avgDuration,
            startTime: startTime,
            endTime: endTime,
            completed: true,
          });
        }
      }

      // Verify each day's statistics
      for (const day of weekData) {
        const stats = await statisticsModule.calculateDailyStats(new Date(day.date));
        
        expect(stats.sessionCount).toBe(day.count);
        expect(stats.totalFocusTime).toBe(day.count * day.avgDuration);
        
        if (day.count > 0) {
          expect(stats.completionRate).toBe(1); // All completed
          // Verify chronological order
          for (let i = 1; i < stats.sessions.length; i++) {
            expect(stats.sessions[i].startTime.getTime())
              .toBeGreaterThan(stats.sessions[i - 1].startTime.getTime());
          }
        } else {
          expect(stats.sessions).toEqual([]);
          expect(stats.completionRate).toBe(0);
        }
      }
    });

    it('should handle large number of sessions in a day', async () => {
      // Validates: Requirements 4.1, 4.2, 4.3
      
      const date = new Date('2024-07-01');
      const sessionCount = 50; // Large number of sessions

      // Create many sessions
      for (let i = 0; i < sessionCount; i++) {
        const hour = 6 + Math.floor(i / 4); // Spread across 12+ hours
        const minute = (i % 4) * 15; // 0, 15, 30, 45 minutes
        
        const startTime = new Date(`2024-07-01T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
        const endTime = new Date(startTime.getTime() + 600 * 1000); // 10 minutes each
        
        await dataService.saveFocusSession({
          id: generateId(),
          taskName: `Task ${i + 1}`,
          duration: 600,
          startTime: startTime,
          endTime: endTime,
          completed: i % 3 !== 0, // Some incomplete
        });
      }

      // Calculate statistics
      const stats = await statisticsModule.calculateDailyStats(date);

      // Verify aggregation
      expect(stats.sessionCount).toBe(sessionCount);
      expect(stats.totalFocusTime).toBe(sessionCount * 600);

      // Verify sorting
      for (let i = 1; i < stats.sessions.length; i++) {
        expect(stats.sessions[i].startTime.getTime())
          .toBeGreaterThanOrEqual(stats.sessions[i - 1].startTime.getTime());
      }

      // Verify completion rate
      // i % 3 !== 0 means: i=0 (false), i=1 (true), i=2 (true), i=3 (false), etc.
      // So for 50 sessions: 0,3,6,9,12,15,18,21,24,27,30,33,36,39,42,45,48 are incomplete (17 sessions)
      // Completed: 50 - 17 = 33 sessions
      const incompleteCount = Math.ceil(sessionCount / 3);
      const completedCount = sessionCount - incompleteCount;
      expect(stats.completionRate).toBeCloseTo(completedCount / sessionCount, 2);
    });

    it('should handle sessions with extreme durations', async () => {
      // Validates: Requirements 4.1, 4.2
      
      const date = new Date('2024-08-01');
      const sessions: FocusSession[] = [
        {
          id: generateId(),
          taskName: 'Minimum Duration',
          duration: 60, // 1 minute (minimum)
          startTime: new Date('2024-08-01T09:00:00Z'),
          endTime: new Date('2024-08-01T09:01:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Maximum Duration',
          duration: 7200, // 2 hours (maximum)
          startTime: new Date('2024-08-01T10:00:00Z'),
          endTime: new Date('2024-08-01T12:00:00Z'),
          completed: true,
        },
        {
          id: generateId(),
          taskName: 'Standard Duration',
          duration: 1500, // 25 minutes (standard)
          startTime: new Date('2024-08-01T13:00:00Z'),
          endTime: new Date('2024-08-01T13:25:00Z'),
          completed: true,
        },
      ];

      // Save all sessions
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      // Calculate statistics
      const stats = await statisticsModule.calculateDailyStats(date);

      // Verify aggregation handles extreme values
      expect(stats.totalFocusTime).toBe(60 + 7200 + 1500);
      expect(stats.sessionCount).toBe(3);
      expect(stats.completionRate).toBe(1);
    });

    it('should maintain consistency across multiple date queries', async () => {
      // Validates: Requirements 4.1, 4.2, 4.3, 4.4
      
      // Create sessions across multiple dates
      const dates = ['2024-09-01', '2024-09-02', '2024-09-03'];
      const sessionsPerDate = 3;

      for (const dateStr of dates) {
        for (let i = 0; i < sessionsPerDate; i++) {
          const startTime = new Date(`${dateStr}T${String(9 + i * 2).padStart(2, '0')}:00:00Z`);
          const endTime = new Date(startTime.getTime() + 1500 * 1000);
          
          await dataService.saveFocusSession({
            id: generateId(),
            taskName: `${dateStr} Task ${i + 1}`,
            duration: 1500,
            startTime: startTime,
            endTime: endTime,
            completed: true,
          });
        }
      }

      // Query each date multiple times
      for (const dateStr of dates) {
        const date = new Date(dateStr);
        
        // Query 3 times
        const stats1 = await statisticsModule.calculateDailyStats(date);
        const stats2 = await statisticsModule.calculateDailyStats(date);
        const stats3 = await statisticsModule.calculateDailyStats(date);

        // All queries should return identical results
        expect(stats1.sessionCount).toBe(sessionsPerDate);
        expect(stats2.sessionCount).toBe(sessionsPerDate);
        expect(stats3.sessionCount).toBe(sessionsPerDate);

        expect(stats1.totalFocusTime).toBe(stats2.totalFocusTime);
        expect(stats2.totalFocusTime).toBe(stats3.totalFocusTime);

        expect(stats1.completionRate).toBe(stats2.completionRate);
        expect(stats2.completionRate).toBe(stats3.completionRate);

        // Session order should be consistent
        for (let i = 0; i < sessionsPerDate; i++) {
          expect(stats1.sessions[i].id).toBe(stats2.sessions[i].id);
          expect(stats2.sessions[i].id).toBe(stats3.sessions[i].id);
        }
      }
    });

    it('should handle real-world usage pattern', async () => {
      // Validates: Requirements 4.1, 4.2, 4.3, 4.4
      
      // Simulate a typical work day
      const date = new Date('2024-10-15');
      
      const workSessions = [
        // Morning block
        { time: '09:00', duration: 1500, task: 'Email review', completed: true },
        { time: '09:30', duration: 1500, task: 'Code review', completed: true },
        { time: '10:00', duration: 1500, task: 'Feature development', completed: true },
        
        // Late morning
        { time: '11:00', duration: 1500, task: 'Bug fixing', completed: false }, // Interrupted
        { time: '11:15', duration: 900, task: 'Quick fix', completed: true },
        
        // Afternoon block
        { time: '14:00', duration: 1500, task: 'Documentation', completed: true },
        { time: '14:30', duration: 1500, task: 'Testing', completed: true },
        { time: '15:00', duration: 1800, task: 'Refactoring', completed: true },
        
        // Late afternoon
        { time: '16:30', duration: 1200, task: 'Code cleanup', completed: true },
        { time: '17:00', duration: 600, task: 'Daily standup prep', completed: true },
      ];

      // Save all sessions
      for (const session of workSessions) {
        const startTime = new Date(`2024-10-15T${session.time}:00Z`);
        const endTime = new Date(startTime.getTime() + session.duration * 1000);
        
        await dataService.saveFocusSession({
          id: generateId(),
          taskName: session.task,
          duration: session.duration,
          startTime: startTime,
          endTime: endTime,
          completed: session.completed,
        });
      }

      // Calculate statistics
      const stats = await statisticsModule.calculateDailyStats(date);

      // Verify realistic aggregation
      expect(stats.sessionCount).toBe(workSessions.length);
      
      const expectedTotal = workSessions.reduce((sum, s) => sum + s.duration, 0);
      expect(stats.totalFocusTime).toBe(expectedTotal);

      const completedCount = workSessions.filter(s => s.completed).length;
      expect(stats.completionRate).toBe(completedCount / workSessions.length);

      // Verify chronological order matches work pattern
      expect(stats.sessions[0].taskName).toBe('Email review');
      expect(stats.sessions[stats.sessions.length - 1].taskName).toBe('Daily standup prep');
      
      // Verify all sessions are in chronological order
      for (let i = 1; i < stats.sessions.length; i++) {
        expect(stats.sessions[i].startTime.getTime())
          .toBeGreaterThanOrEqual(stats.sessions[i - 1].startTime.getTime());
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      // Validates: Requirement 3.4
      
      const date = new Date('2024-11-01');

      // Close database to simulate error
      dataService.close();

      // Should throw error
      await expect(statisticsModule.calculateDailyStats(date)).rejects.toThrow();

      // Re-initialize and verify recovery
      await dataService.initialize();
      const stats = await statisticsModule.calculateDailyStats(date);
      expect(stats.sessionCount).toBe(0);
    });

    it('should handle invalid date objects', async () => {
      // Validates: Requirements 4.1, 4.2
      
      // Create a valid session
      await dataService.saveFocusSession({
        id: generateId(),
        taskName: 'Test Task',
        duration: 1500,
        startTime: new Date('2024-11-15T10:00:00Z'),
        endTime: new Date('2024-11-15T10:25:00Z'),
        completed: true,
      });

      // Query with various date formats
      const dates = [
        new Date('2024-11-15'),
        new Date('2024-11-15T00:00:00Z'),
        new Date('2024-11-15T23:59:59Z'),
      ];

      // All should return the same session
      for (const date of dates) {
        const stats = await statisticsModule.calculateDailyStats(date);
        expect(stats.sessionCount).toBe(1);
        expect(stats.sessions[0].taskName).toBe('Test Task');
      }
    });

    it('should handle concurrent statistics calculations', async () => {
      // Validates: Requirements 4.1, 4.2, 4.3, 4.4
      
      const date = new Date('2024-12-01');
      
      // Create sessions
      for (let i = 0; i < 5; i++) {
        await dataService.saveFocusSession({
          id: generateId(),
          taskName: `Task ${i + 1}`,
          duration: 1500,
          startTime: new Date(`2024-12-01T${String(9 + i).padStart(2, '0')}:00:00Z`),
          endTime: new Date(`2024-12-01T${String(9 + i).padStart(2, '0')}:25:00Z`),
          completed: true,
        });
      }

      // Calculate statistics concurrently
      const promises = [
        statisticsModule.calculateDailyStats(date),
        statisticsModule.calculateDailyStats(date),
        statisticsModule.calculateDailyStats(date),
        statisticsModule.calculateDailyStats(date),
        statisticsModule.calculateDailyStats(date),
      ];

      const results = await Promise.all(promises);

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i].sessionCount).toBe(results[0].sessionCount);
        expect(results[i].totalFocusTime).toBe(results[0].totalFocusTime);
        expect(results[i].completionRate).toBe(results[0].completionRate);
      }
    });

    it('should handle sessions added during statistics calculation', async () => {
      // Validates: Requirements 4.1, 4.2
      
      const date = new Date('2024-12-15');

      // Add initial sessions
      await dataService.saveFocusSession({
        id: generateId(),
        taskName: 'Initial Task',
        duration: 1500,
        startTime: new Date('2024-12-15T09:00:00Z'),
        endTime: new Date('2024-12-15T09:25:00Z'),
        completed: true,
      });

      // Calculate initial stats
      const stats1 = await statisticsModule.calculateDailyStats(date);
      expect(stats1.sessionCount).toBe(1);

      // Add more sessions
      await dataService.saveFocusSession({
        id: generateId(),
        taskName: 'Added Task',
        duration: 900,
        startTime: new Date('2024-12-15T10:00:00Z'),
        endTime: new Date('2024-12-15T10:15:00Z'),
        completed: true,
      });

      // Recalculate stats
      const stats2 = await statisticsModule.calculateDailyStats(date);
      expect(stats2.sessionCount).toBe(2);
      expect(stats2.totalFocusTime).toBe(1500 + 900);
    });
  });

  describe('Performance Considerations', () => {
    it('should calculate statistics efficiently for moderate data', async () => {
      // Validates: Requirements 4.1, 4.2, 4.3
      
      const date = new Date('2024-12-20');
      const sessionCount = 20;

      // Create sessions (spread across valid hours)
      for (let i = 0; i < sessionCount; i++) {
        const hour = 6 + Math.floor(i / 2); // 2 sessions per hour, starting at 6am
        const minute = (i % 2) * 30; // 0 or 30 minutes
        const sessionStartTime = new Date(`2024-12-20T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`);
        const sessionEndTime = new Date(sessionStartTime.getTime() + 1500 * 1000);
        
        await dataService.saveFocusSession({
          id: generateId(),
          taskName: `Task ${i + 1}`,
          duration: 1500,
          startTime: sessionStartTime,
          endTime: sessionEndTime,
          completed: true,
        });
      }

      // Measure calculation time
      const measureStartTime = Date.now();
      const stats = await statisticsModule.calculateDailyStats(date);
      const measureEndTime = Date.now();

      // Should complete quickly (under 500ms as per design doc)
      const duration = measureEndTime - measureStartTime;
      expect(duration).toBeLessThan(500);

      // Verify correctness
      expect(stats.sessionCount).toBe(sessionCount);
      expect(stats.totalFocusTime).toBe(sessionCount * 1500);
    });

    it('should handle repeated queries efficiently', async () => {
      // Validates: Requirements 4.1, 4.2, 4.3, 4.4
      
      const date = new Date('2024-12-25');

      // Create sessions
      for (let i = 0; i < 10; i++) {
        await dataService.saveFocusSession({
          id: generateId(),
          taskName: `Task ${i + 1}`,
          duration: 1500,
          startTime: new Date(`2024-12-25T${String(9 + i).padStart(2, '0')}:00:00Z`),
          endTime: new Date(`2024-12-25T${String(9 + i).padStart(2, '0')}:25:00Z`),
          completed: true,
        });
      }

      // Perform multiple queries
      const iterations = 10;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await statisticsModule.calculateDailyStats(date);
      }
      
      const endTime = Date.now();
      const avgDuration = (endTime - startTime) / iterations;

      // Average query should be fast
      expect(avgDuration).toBeLessThan(100);
    });
  });
});
