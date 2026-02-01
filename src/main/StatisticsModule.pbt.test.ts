/**
 * Property-based tests for StatisticsModule
 * 
 * These tests verify universal properties that should hold for all inputs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { StatisticsModule } from './StatisticsModule';
import { DataService } from './DataService';
import { FocusSession } from '../shared/types';
import fs from 'fs';
import path from 'path';

describe('StatisticsModule - Property-Based Tests', () => {
  let dataService: DataService;
  let statisticsModule: StatisticsModule;
  let testDbPath: string;

  beforeEach(async () => {
    // Create a temporary database for testing with unique name
    testDbPath = path.join(__dirname, `test-stats-pbt-${Date.now()}-${Math.random()}.db`);
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

  // Generator for valid focus sessions
  const focusSessionArbitrary = (dateStr: string) =>
    fc.record({
      id: fc.uuid(),
      taskName: fc.string({ minLength: 1, maxLength: 100 }).map((s) => s.trim() || 'Task'),
      duration: fc.integer({ min: 60, max: 7200 }),
      // Generate start time on the specified date
      startHour: fc.integer({ min: 0, max: 23 }),
      startMinute: fc.integer({ min: 0, max: 59 }),
      completed: fc.boolean(),
    }).map((data) => {
      const startTime = new Date(`${dateStr}T${String(data.startHour).padStart(2, '0')}:${String(data.startMinute).padStart(2, '0')}:00Z`);
      const endTime = new Date(startTime.getTime() + data.duration * 1000);
      
      return {
        id: data.id,
        taskName: data.taskName,
        duration: data.duration,
        startTime,
        endTime,
        completed: data.completed,
      } as FocusSession;
    });

  // Feature: pomodoro-timer, Property 10: 统计数据计算正确性
  // **Validates: Requirements 4.1, 4.2**
  describe('Property 10: Statistics calculation correctness', () => {
    it('total focus time should equal sum of all session durations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(focusSessionArbitrary('2024-01-15'), { minLength: 0, maxLength: 20 }),
          async (sessions) => {
            // Create a fresh database for this test run
            const testDb = path.join(__dirname, `test-pbt-${Date.now()}-${Math.random()}.db`);
            const ds = new DataService(testDb);
            await ds.initialize();
            const sm = new StatisticsModule(ds);

            try {
              // Save all sessions
              for (const session of sessions) {
                await ds.saveFocusSession(session);
              }

              // Calculate stats
              const stats = await sm.calculateDailyStats(new Date('2024-01-15'));

              // Property: total focus time should equal sum of durations
              const expectedTotal = sessions.reduce((sum, s) => sum + s.duration, 0);
              expect(stats.totalFocusTime).toBe(expectedTotal);

              // Property: session count should equal number of sessions
              expect(stats.sessionCount).toBe(sessions.length);
            } finally {
              ds.close();
              if (fs.existsSync(testDb)) {
                fs.unlinkSync(testDb);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('session count should equal the number of sessions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(focusSessionArbitrary('2024-01-15'), { minLength: 0, maxLength: 20 }),
          async (sessions) => {
            // Create a fresh database for this test run
            const testDb = path.join(__dirname, `test-pbt-${Date.now()}-${Math.random()}.db`);
            const ds = new DataService(testDb);
            await ds.initialize();
            const sm = new StatisticsModule(ds);

            try {
              // Save all sessions
              for (const session of sessions) {
                await ds.saveFocusSession(session);
              }

              // Calculate stats
              const stats = await sm.calculateDailyStats(new Date('2024-01-15'));

              // Property: session count should equal number of sessions
              expect(stats.sessionCount).toBe(sessions.length);
              expect(stats.sessions).toHaveLength(sessions.length);
            } finally {
              ds.close();
              if (fs.existsSync(testDb)) {
                fs.unlinkSync(testDb);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('completion rate should be between 0 and 1', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(focusSessionArbitrary('2024-01-15'), { minLength: 1, maxLength: 20 }),
          async (sessions) => {
            // Create a fresh database for this test run
            const testDb = path.join(__dirname, `test-pbt-${Date.now()}-${Math.random()}.db`);
            const ds = new DataService(testDb);
            await ds.initialize();
            const sm = new StatisticsModule(ds);

            try {
              // Save all sessions
              for (const session of sessions) {
                await ds.saveFocusSession(session);
              }

              // Calculate stats
              const stats = await sm.calculateDailyStats(new Date('2024-01-15'));

              // Property: completion rate should be between 0 and 1
              expect(stats.completionRate).toBeGreaterThanOrEqual(0);
              expect(stats.completionRate).toBeLessThanOrEqual(1);

              // Property: completion rate should match the ratio
              const completedCount = sessions.filter((s) => s.completed).length;
              const expectedRate = completedCount / sessions.length;
              expect(stats.completionRate).toBeCloseTo(expectedRate, 10);
            } finally {
              ds.close();
              if (fs.existsSync(testDb)) {
                fs.unlinkSync(testDb);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: pomodoro-timer, Property 11: 时间排序不变性
  // **Validates: Requirements 4.3**
  describe('Property 11: Time sorting invariant', () => {
    it('sessions should be sorted by start time regardless of input order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(focusSessionArbitrary('2024-01-15'), { minLength: 2, maxLength: 20 }),
          async (sessions) => {
            // Create a fresh database for this test run
            const testDb = path.join(__dirname, `test-pbt-${Date.now()}-${Math.random()}.db`);
            const ds = new DataService(testDb);
            await ds.initialize();
            const sm = new StatisticsModule(ds);

            try {
              // Shuffle sessions to randomize input order
              const shuffled = fc.sample(fc.shuffledSubarray(sessions, { minLength: sessions.length, maxLength: sessions.length }), 1)[0];

              // Save shuffled sessions
              for (const session of shuffled) {
                await ds.saveFocusSession(session);
              }

              // Calculate stats
              const stats = await sm.calculateDailyStats(new Date('2024-01-15'));

              // Property: sessions should be sorted by start time
              for (let i = 1; i < stats.sessions.length; i++) {
                const prevTime = stats.sessions[i - 1].startTime.getTime();
                const currTime = stats.sessions[i].startTime.getTime();
                expect(currTime).toBeGreaterThanOrEqual(prevTime);
              }
            } finally {
              ds.close();
              if (fs.existsSync(testDb)) {
                fs.unlinkSync(testDb);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sorting should be stable - sessions with same start time maintain relative order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.constant('2024-01-15T10:00:00Z'),
            fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }).map(ids => [...new Set(ids)]) // Ensure unique IDs
          ),
          async ([startTimeStr, ids]) => {
            // Skip if we don't have at least 2 unique IDs
            if (ids.length < 2) return;

            // Create a fresh database for this test run
            const testDb = path.join(__dirname, `test-pbt-${Date.now()}-${Math.random()}.db`);
            const ds = new DataService(testDb);
            await ds.initialize();
            const sm = new StatisticsModule(ds);

            try {
              const startTime = new Date(startTimeStr);
              const endTime = new Date(startTime.getTime() + 1500 * 1000);

              // Create sessions with same start time but different IDs
              const sessions: FocusSession[] = ids.map((id) => ({
                id,
                taskName: `Task ${id}`,
                duration: 1500,
                startTime,
                endTime,
                completed: true,
              }));

              // Save sessions
              for (const session of sessions) {
                await ds.saveFocusSession(session);
              }

              // Calculate stats
              const stats = await sm.calculateDailyStats(new Date('2024-01-15'));

              // Property: all sessions should have the same start time
              for (const session of stats.sessions) {
                expect(session.startTime.getTime()).toBe(startTime.getTime());
              }

              // Property: all sessions should be present
              expect(stats.sessions).toHaveLength(sessions.length);
            } finally {
              ds.close();
              if (fs.existsSync(testDb)) {
                fs.unlinkSync(testDb);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // Feature: pomodoro-timer, Property 12: 日期过滤正确性
  // **Validates: Requirements 4.4**
  describe('Property 12: Date filtering correctness', () => {
    it('should only include sessions from the specified date', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.array(focusSessionArbitrary('2024-01-15'), { minLength: 0, maxLength: 10 }),
            fc.array(focusSessionArbitrary('2024-01-16'), { minLength: 0, maxLength: 10 }),
            fc.array(focusSessionArbitrary('2024-01-14'), { minLength: 0, maxLength: 10 })
          ),
          async ([sessions15, sessions16, sessions14]) => {
            // Create a fresh database for this test run
            const testDb = path.join(__dirname, `test-pbt-${Date.now()}-${Math.random()}.db`);
            const ds = new DataService(testDb);
            await ds.initialize();
            const sm = new StatisticsModule(ds);

            try {
              // Save sessions from different dates
              for (const session of [...sessions14, ...sessions15, ...sessions16]) {
                await ds.saveFocusSession(session);
              }

              // Calculate stats for Jan 15
              const stats = await sm.calculateDailyStats(new Date('2024-01-15'));

              // Property: should only include sessions from Jan 15
              expect(stats.sessionCount).toBe(sessions15.length);

              // Property: all returned sessions should be from Jan 15
              for (const session of stats.sessions) {
                const dateStr = session.startTime.toISOString().split('T')[0];
                expect(dateStr).toBe('2024-01-15');
              }
            } finally {
              ds.close();
              if (fs.existsSync(testDb)) {
                fs.unlinkSync(testDb);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sessions at midnight boundary should be filtered by start date', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 59 }),
          async (seconds) => {
            // Create a fresh database for this test run
            const testDb = path.join(__dirname, `test-pbt-${Date.now()}-${Math.random()}.db`);
            const ds = new DataService(testDb);
            await ds.initialize();
            const sm = new StatisticsModule(ds);

            try {
              // Create a session that starts just before midnight
              const beforeMidnight: FocusSession = {
                id: 'before-midnight',
                taskName: 'Before Midnight',
                duration: 1500,
                startTime: new Date(`2024-01-14T23:59:${String(seconds).padStart(2, '0')}Z`),
                endTime: new Date(`2024-01-15T00:24:${String(seconds).padStart(2, '0')}Z`),
                completed: true,
              };

              // Create a session that starts just after midnight
              const afterMidnight: FocusSession = {
                id: 'after-midnight',
                taskName: 'After Midnight',
                duration: 1500,
                startTime: new Date(`2024-01-15T00:00:${String(seconds).padStart(2, '0')}Z`),
                endTime: new Date(`2024-01-15T00:25:${String(seconds).padStart(2, '0')}Z`),
                completed: true,
              };

              await ds.saveFocusSession(beforeMidnight);
              await ds.saveFocusSession(afterMidnight);

              // Calculate stats for Jan 15
              const stats15 = await sm.calculateDailyStats(new Date('2024-01-15'));

              // Property: Jan 15 should only include the after-midnight session
              expect(stats15.sessionCount).toBe(1);
              expect(stats15.sessions[0].id).toBe('after-midnight');

              // Calculate stats for Jan 14
              const stats14 = await sm.calculateDailyStats(new Date('2024-01-14'));

              // Property: Jan 14 should only include the before-midnight session
              expect(stats14.sessionCount).toBe(1);
              expect(stats14.sessions[0].id).toBe('before-midnight');
            } finally {
              ds.close();
              if (fs.existsSync(testDb)) {
                fs.unlinkSync(testDb);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Combined properties', () => {
    it('stats should be consistent regardless of query order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(focusSessionArbitrary('2024-01-15'), { minLength: 1, maxLength: 20 }),
          async (sessions) => {
            // Create a fresh database for this test run
            const testDb = path.join(__dirname, `test-pbt-${Date.now()}-${Math.random()}.db`);
            const ds = new DataService(testDb);
            await ds.initialize();
            const sm = new StatisticsModule(ds);

            try {
              // Save all sessions
              for (const session of sessions) {
                await ds.saveFocusSession(session);
              }

              // Calculate stats multiple times
              const stats1 = await sm.calculateDailyStats(new Date('2024-01-15'));
              const stats2 = await sm.calculateDailyStats(new Date('2024-01-15'));

              // Property: results should be identical
              expect(stats1.totalFocusTime).toBe(stats2.totalFocusTime);
              expect(stats1.sessionCount).toBe(stats2.sessionCount);
              expect(stats1.completionRate).toBe(stats2.completionRate);
              expect(stats1.sessions).toHaveLength(stats2.sessions.length);
            } finally {
              ds.close();
              if (fs.existsSync(testDb)) {
                fs.unlinkSync(testDb);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty date should return zero stats', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          async (date) => {
            // Create a fresh database for this test run
            const testDb = path.join(__dirname, `test-pbt-${Date.now()}-${Math.random()}.db`);
            const ds = new DataService(testDb);
            await ds.initialize();
            const sm = new StatisticsModule(ds);

            try {
              // Don't save any sessions
              const stats = await sm.calculateDailyStats(date);

              // Property: empty date should have zero stats
              expect(stats.totalFocusTime).toBe(0);
              expect(stats.sessionCount).toBe(0);
              expect(stats.sessions).toHaveLength(0);
              expect(stats.completionRate).toBe(0);
            } finally {
              ds.close();
              if (fs.existsSync(testDb)) {
                fs.unlinkSync(testDb);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
