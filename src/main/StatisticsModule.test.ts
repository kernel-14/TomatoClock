/**
 * Unit tests for StatisticsModule
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StatisticsModule } from './StatisticsModule';
import { DataService } from './DataService';
import { FocusSession } from '../shared/types';
import fs from 'fs';
import path from 'path';

describe('StatisticsModule', () => {
  let dataService: DataService;
  let statisticsModule: StatisticsModule;
  let testDbPath: string;

  beforeEach(async () => {
    // Create a temporary database for testing
    testDbPath = path.join(__dirname, `test-stats-${Date.now()}.db`);
    dataService = new DataService(testDbPath);
    await dataService.initialize();
    statisticsModule = new StatisticsModule(dataService);
  });

  afterEach(() => {
    // Clean up
    dataService.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('calculateDailyStats', () => {
    it('should return empty stats when no sessions exist', async () => {
      const date = new Date('2024-01-15');
      const stats = await statisticsModule.calculateDailyStats(date);

      expect(stats.date).toEqual(new Date('2024-01-15T00:00:00.000Z'));
      expect(stats.totalFocusTime).toBe(0);
      expect(stats.sessionCount).toBe(0);
      expect(stats.sessions).toEqual([]);
      expect(stats.completionRate).toBe(0);
    });

    it('should calculate stats for a single session', async () => {
      const date = new Date('2024-01-15');
      const session: FocusSession = {
        id: 'test-1',
        taskName: 'Test Task',
        duration: 1500,
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T10:25:00Z'),
        completed: true,
      };

      await dataService.saveFocusSession(session);
      const stats = await statisticsModule.calculateDailyStats(date);

      expect(stats.totalFocusTime).toBe(1500);
      expect(stats.sessionCount).toBe(1);
      expect(stats.sessions).toHaveLength(1);
      expect(stats.sessions[0].taskName).toBe('Test Task');
      expect(stats.completionRate).toBe(1);
    });

    it('should calculate stats for multiple sessions', async () => {
      const date = new Date('2024-01-15');
      const sessions: FocusSession[] = [
        {
          id: 'test-1',
          taskName: 'Task 1',
          duration: 1500,
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T10:25:00Z'),
          completed: true,
        },
        {
          id: 'test-2',
          taskName: 'Task 2',
          duration: 900,
          startTime: new Date('2024-01-15T11:00:00Z'),
          endTime: new Date('2024-01-15T11:15:00Z'),
          completed: true,
        },
        {
          id: 'test-3',
          taskName: 'Task 3',
          duration: 600,
          startTime: new Date('2024-01-15T14:00:00Z'),
          endTime: new Date('2024-01-15T14:10:00Z'),
          completed: false,
        },
      ];

      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      const stats = await statisticsModule.calculateDailyStats(date);

      expect(stats.totalFocusTime).toBe(3000); // 1500 + 900 + 600
      expect(stats.sessionCount).toBe(3);
      expect(stats.sessions).toHaveLength(3);
      expect(stats.completionRate).toBeCloseTo(2 / 3, 5); // 2 completed out of 3
    });

    it('should sort sessions by start time', async () => {
      const date = new Date('2024-01-15');
      const sessions: FocusSession[] = [
        {
          id: 'test-3',
          taskName: 'Task 3',
          duration: 600,
          startTime: new Date('2024-01-15T14:00:00Z'),
          endTime: new Date('2024-01-15T14:10:00Z'),
          completed: true,
        },
        {
          id: 'test-1',
          taskName: 'Task 1',
          duration: 1500,
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T10:25:00Z'),
          completed: true,
        },
        {
          id: 'test-2',
          taskName: 'Task 2',
          duration: 900,
          startTime: new Date('2024-01-15T11:00:00Z'),
          endTime: new Date('2024-01-15T11:15:00Z'),
          completed: true,
        },
      ];

      // Save in random order
      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      const stats = await statisticsModule.calculateDailyStats(date);

      // Verify sessions are sorted by start time
      expect(stats.sessions[0].taskName).toBe('Task 1');
      expect(stats.sessions[1].taskName).toBe('Task 2');
      expect(stats.sessions[2].taskName).toBe('Task 3');
    });

    it('should filter sessions by date correctly', async () => {
      const targetDate = new Date('2024-01-15');
      const sessions: FocusSession[] = [
        {
          id: 'test-1',
          taskName: 'Task on 15th',
          duration: 1500,
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T10:25:00Z'),
          completed: true,
        },
        {
          id: 'test-2',
          taskName: 'Task on 14th',
          duration: 900,
          startTime: new Date('2024-01-14T11:00:00Z'),
          endTime: new Date('2024-01-14T11:15:00Z'),
          completed: true,
        },
        {
          id: 'test-3',
          taskName: 'Task on 16th',
          duration: 600,
          startTime: new Date('2024-01-16T14:00:00Z'),
          endTime: new Date('2024-01-16T14:10:00Z'),
          completed: true,
        },
      ];

      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      const stats = await statisticsModule.calculateDailyStats(targetDate);

      // Should only include the session from 15th
      expect(stats.sessionCount).toBe(1);
      expect(stats.sessions[0].taskName).toBe('Task on 15th');
    });

    it('should handle completion rate with all completed sessions', async () => {
      const date = new Date('2024-01-15');
      const sessions: FocusSession[] = [
        {
          id: 'test-1',
          taskName: 'Task 1',
          duration: 1500,
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T10:25:00Z'),
          completed: true,
        },
        {
          id: 'test-2',
          taskName: 'Task 2',
          duration: 900,
          startTime: new Date('2024-01-15T11:00:00Z'),
          endTime: new Date('2024-01-15T11:15:00Z'),
          completed: true,
        },
      ];

      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      const stats = await statisticsModule.calculateDailyStats(date);

      expect(stats.completionRate).toBe(1);
    });

    it('should handle completion rate with no completed sessions', async () => {
      const date = new Date('2024-01-15');
      const sessions: FocusSession[] = [
        {
          id: 'test-1',
          taskName: 'Task 1',
          duration: 1500,
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T10:25:00Z'),
          completed: false,
        },
        {
          id: 'test-2',
          taskName: 'Task 2',
          duration: 900,
          startTime: new Date('2024-01-15T11:00:00Z'),
          endTime: new Date('2024-01-15T11:15:00Z'),
          completed: false,
        },
      ];

      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      const stats = await statisticsModule.calculateDailyStats(date);

      expect(stats.completionRate).toBe(0);
    });
  });

  describe('calculateTodayStats', () => {
    it('should calculate stats for today', async () => {
      const today = new Date();
      // Create a session for today
      const todayStart = new Date();
      todayStart.setHours(10, 0, 0, 0);
      const todayEnd = new Date(todayStart.getTime() + 25 * 60 * 1000);
      
      const session: FocusSession = {
        id: 'test-today',
        taskName: 'Today Task',
        duration: 1500,
        startTime: todayStart,
        endTime: todayEnd,
        completed: true,
      };

      await dataService.saveFocusSession(session);
      const stats = await statisticsModule.calculateTodayStats();

      // Verify the date is today (normalized to midnight UTC)
      const expectedDate = new Date(Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        0, 0, 0, 0
      ));
      expect(stats.date.getTime()).toBe(expectedDate.getTime());

      expect(stats.sessionCount).toBe(1);
      expect(stats.totalFocusTime).toBe(1500);
    });
  });

  describe('edge cases', () => {
    it('should handle sessions at midnight boundary', async () => {
      const date = new Date('2024-01-15');
      const sessions: FocusSession[] = [
        {
          id: 'test-1',
          taskName: 'Late night',
          duration: 1500,
          startTime: new Date('2024-01-14T23:59:00Z'),
          endTime: new Date('2024-01-15T00:24:00Z'),
          completed: true,
        },
        {
          id: 'test-2',
          taskName: 'Early morning',
          duration: 900,
          startTime: new Date('2024-01-15T00:01:00Z'),
          endTime: new Date('2024-01-15T00:16:00Z'),
          completed: true,
        },
      ];

      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      const stats = await statisticsModule.calculateDailyStats(date);

      // Should only include the session that started on 15th
      expect(stats.sessionCount).toBe(1);
      expect(stats.sessions[0].taskName).toBe('Early morning');
    });

    it('should handle sessions with same start time', async () => {
      const date = new Date('2024-01-15');
      const sameTime = new Date('2024-01-15T10:00:00Z');
      const sessions: FocusSession[] = [
        {
          id: 'test-1',
          taskName: 'Task 1',
          duration: 1500,
          startTime: sameTime,
          endTime: new Date('2024-01-15T10:25:00Z'),
          completed: true,
        },
        {
          id: 'test-2',
          taskName: 'Task 2',
          duration: 900,
          startTime: sameTime,
          endTime: new Date('2024-01-15T10:15:00Z'),
          completed: true,
        },
      ];

      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      const stats = await statisticsModule.calculateDailyStats(date);

      expect(stats.sessionCount).toBe(2);
      expect(stats.totalFocusTime).toBe(2400);
    });
  });
});
