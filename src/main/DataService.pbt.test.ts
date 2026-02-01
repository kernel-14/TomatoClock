/**
 * Property-Based Tests for DataService
 * 
 * These tests verify universal properties that should hold across all inputs
 * using the fast-check library for property-based testing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { DataService } from './DataService';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('DataService - Property-Based Tests', () => {
  let testDbPath: string;
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pomodoro-pbt-'));
    testDbPath = path.join(tempDir, 'test.db');
  });

  afterEach(() => {
    // Clean up all files in temp directory
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (e) {
            // Ignore errors on cleanup
          }
        });
        fs.rmdirSync(tempDir);
      }
    } catch (e) {
      // Ignore cleanup errors in tests
    }
  });

  /**
   * Property 8: 损坏数据恢复能力 (Corrupted Data Recovery Capability)
   * Feature: pomodoro-timer, Property 8: 对于任何损坏的数据库文件，应用初始化时应该能够检测到错误并创建新的数据库，而不是崩溃
   * 
   * **Validates: Requirements 3.3**
   * 
   * This property verifies that for ANY corrupted database file content,
   * the DataService can:
   * 1. Detect the corruption during initialization
   * 2. Create a backup of the corrupted file (if corruption is detected)
   * 3. Create a new, working database
   * 4. Complete initialization without crashing
   * 5. Be usable after recovery (can perform basic operations)
   */
  it('Property 8: should recover from any corrupted database file', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various types of corrupted database content
        fc.oneof(
          // Random binary data
          fc.uint8Array({ minLength: 10, maxLength: 1000 }),
          // Random text data (non-empty)
          fc.string({ minLength: 10, maxLength: 1000 }),
          // Partial SQLite header (corrupted)
          fc.constantFrom(
            'SQLite format 3', // Valid header but incomplete
            'SQLite format X', // Invalid header
            'CORRUPTED',
            '\x00\x00\x00\x00',
            'Not a database file',
            '{"json": "data"}', // JSON instead of SQLite
            '<xml>data</xml>', // XML instead of SQLite
            Buffer.from([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65]).toString(), // Partial SQLite magic
          ),
          // Files with null bytes
          fc.string({ minLength: 1 }).map(s => s + '\x00'.repeat(100)),
        ),
        async (corruptedContent) => {
          // Create a corrupted database file
          if (typeof corruptedContent === 'string') {
            fs.writeFileSync(testDbPath, corruptedContent, 'utf-8');
          } else {
            fs.writeFileSync(testDbPath, Buffer.from(corruptedContent));
          }

          // Verify the file exists and is corrupted
          expect(fs.existsSync(testDbPath)).toBe(true);

          // Create a new DataService instance
          const dataService = new DataService(testDbPath);

          try {
            // Initialize should NOT throw - it should handle corruption gracefully
            await dataService.initialize();

            // After initialization, the database should be functional
            // Test 1: Should be able to load settings (basic operation)
            const settings = await dataService.loadSettings();
            expect(settings).toBeDefined();
            expect(settings.defaultDuration).toBe(1500); // Default value

            // Test 2: Should be able to save and retrieve data
            const testSession = {
              id: 'recovery-test',
              taskName: 'Test Task',
              duration: 1500,
              startTime: new Date('2024-01-01T10:00:00Z'),
              endTime: new Date('2024-01-01T10:25:00Z'),
              completed: true,
            };

            await dataService.saveFocusSession(testSession);
            const sessions = await dataService.getFocusSessions(new Date('2024-01-01'));
            expect(sessions).toHaveLength(1);
            expect(sessions[0].id).toBe('recovery-test');

            // Test 3: Verify new database is valid SQLite
            const db = dataService.getDatabase();
            expect(db).not.toBeNull();

            // Clean up
            dataService.close();

            // Property holds: Recovery was successful
            return true;
          } catch (error) {
            // If any error occurs, the property is violated
            dataService.close();
            throw new Error(
              `Failed to recover from corrupted database. Error: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      ),
      {
        numRuns: 20, // Run 20 iterations with different corrupted content
        verbose: true,
      }
    );
  });

  /**
   * Property 8 (Edge Case): Empty database file should be recoverable
   * Feature: pomodoro-timer, Property 8: 对于任何损坏的数据库文件，应用初始化时应该能够检测到错误并创建新的数据库，而不是崩溃
   * 
   * **Validates: Requirements 3.3**
   */
  it('Property 8 (Edge Case): should recover from empty database file', async () => {
    // Create an empty file
    fs.writeFileSync(testDbPath, '');

    const dataService = new DataService(testDbPath);
    await dataService.initialize();

    // Should be functional
    const settings = await dataService.loadSettings();
    expect(settings).toBeDefined();

    // Empty file might not trigger corruption detection, so backup may not exist
    // The important thing is that the database is now functional
    const db = dataService.getDatabase();
    expect(db).not.toBeNull();

    dataService.close();
  });

  /**
   * Property 8 (Edge Case): Database with invalid SQLite magic number
   * Feature: pomodoro-timer, Property 8: 对于任何损坏的数据库文件，应用初始化时应该能够检测到错误并创建新的数据库，而不是崩溃
   * 
   * **Validates: Requirements 3.3**
   */
  it('Property 8 (Edge Case): should recover from file with invalid SQLite magic number', async () => {
    // SQLite files start with "SQLite format 3\x00" (16 bytes)
    // Create a file with wrong magic number
    const invalidMagic = Buffer.from('INVALID format 3\x00');
    fs.writeFileSync(testDbPath, invalidMagic);

    const dataService = new DataService(testDbPath);
    await dataService.initialize();

    // Should be functional
    const settings = await dataService.loadSettings();
    expect(settings).toBeDefined();

    dataService.close();
  });

  /**
   * Property 8 (Edge Case): Database with truncated content
   * Feature: pomodoro-timer, Property 8: 对于任何损坏的数据库文件，应用初始化时应该能够检测到错误并创建新的数据库，而不是崩溃
   * 
   * **Validates: Requirements 3.3**
   */
  it('Property 8 (Edge Case): should recover from truncated database file', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random file sizes from 1 to 500 bytes
        fc.integer({ min: 1, max: 500 }),
        async (fileSize) => {
          // Create a file with random bytes
          const randomData = Buffer.alloc(fileSize);
          for (let i = 0; i < fileSize; i++) {
            randomData[i] = Math.floor(Math.random() * 256);
          }
          fs.writeFileSync(testDbPath, randomData);

          const dataService = new DataService(testDbPath);
          await dataService.initialize();

          // Should be functional
          const settings = await dataService.loadSettings();
          expect(settings).toBeDefined();

          dataService.close();
          return true;
        }
      ),
      {
        numRuns: 10,
      }
    );
  });

  /**
   * Property 8 (Stress Test): Multiple corruption recovery attempts
   * Feature: pomodoro-timer, Property 8: 对于任何损坏的数据库文件，应用初始化时应该能够检测到错误并创建新的数据库，而不是崩溃
   * 
   * **Validates: Requirements 3.3**
   * 
   * This test verifies that the recovery mechanism works consistently
   * across multiple corruption scenarios in sequence.
   */
  it('Property 8 (Stress Test): should handle multiple corruption recovery attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate an array of different corrupted contents
        fc.array(
          fc.oneof(
            fc.string({ minLength: 10, maxLength: 100 }),
            fc.uint8Array({ minLength: 10, maxLength: 100 })
          ),
          { minLength: 3, maxLength: 10 }
        ),
        async (corruptedContents) => {
          for (const content of corruptedContents) {
            // Write corrupted content
            if (typeof content === 'string') {
              fs.writeFileSync(testDbPath, content, 'utf-8');
            } else {
              fs.writeFileSync(testDbPath, Buffer.from(content));
            }

            // Try to recover
            const dataService = new DataService(testDbPath);
            await dataService.initialize();

            // Verify it's functional
            const settings = await dataService.loadSettings();
            expect(settings).toBeDefined();

            dataService.close();

            // Clean up for next iteration
            if (fs.existsSync(testDbPath)) {
              fs.unlinkSync(testDbPath);
            }
          }

          return true;
        }
      ),
      {
        numRuns: 5,
      }
    );
  });

  /**
   * Property 8 (Invariant): Recovery should always create a valid database
   * Feature: pomodoro-timer, Property 8: 对于任何损坏的数据库文件，应用初始化时应该能够检测到错误并创建新的数据库，而不是崩溃
   * 
   * **Validates: Requirements 3.3**
   * 
   * This test verifies the invariant that after recovery, the database
   * should have all required tables and be fully functional.
   */
  it('Property 8 (Invariant): recovered database should have all required tables', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 1000 }),
        async (corruptedContent) => {
          // Create corrupted database
          fs.writeFileSync(testDbPath, corruptedContent, 'utf-8');

          const dataService = new DataService(testDbPath);
          await dataService.initialize();

          // Verify all required tables exist
          const db = dataService.getDatabase();
          expect(db).not.toBeNull();

          const tables = db!
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .all() as Array<{ name: string }>;

          const tableNames = tables.map(t => t.name);

          // Check for required tables
          expect(tableNames).toContain('focus_sessions');
          expect(tableNames).toContain('app_settings');
          expect(tableNames).toContain('database_info');

          // Verify indexes exist
          const indexes = db!
            .prepare("SELECT name FROM sqlite_master WHERE type='index'")
            .all() as Array<{ name: string }>;

          expect(indexes.length).toBeGreaterThan(0);

          dataService.close();
          return true;
        }
      ),
      {
        numRuns: 10,
      }
    );
  });

  /**
   * Property 7: 专注时段数据往返一致性 (Focus Session Data Round-Trip Consistency)
   * Feature: pomodoro-timer, Property 7: 对于任何有效的专注时段数据，保存到本地存储后再加载，应该得到等价的数据对象（任务名称、时长、时间戳都相同）
   * 
   * **Validates: Requirements 2.2, 2.4, 3.1, 3.2**
   * 
   * This property verifies that for ANY valid FocusSession data:
   * 1. When saved to the database
   * 2. And then loaded back from the database
   * 3. The loaded data should be equivalent to the original data
   * 4. All fields (id, taskName, duration, startTime, endTime, completed) should match
   */
  it('Property 7: should maintain data consistency for focus session round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid FocusSession data
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          taskName: fc.string({ minLength: 0, maxLength: 100 }),
          duration: fc.integer({ min: 60, max: 7200 }),
          // Generate valid date pairs where endTime > startTime
          startTime: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          // Generate duration offset in milliseconds (1 second to 2 hours)
          durationOffset: fc.integer({ min: 1000, max: 7200000 }),
          completed: fc.boolean(),
        }),
        async ({ id, taskName, duration, startTime, durationOffset, completed }) => {
          // Calculate endTime to ensure it's after startTime
          const endTime = new Date(startTime.getTime() + durationOffset);

          // Create the focus session
          const originalSession = {
            id,
            taskName,
            duration,
            startTime,
            endTime,
            completed,
          };

          // Clean up any existing database file before this iteration
          if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
          }

          // Initialize a fresh database for this test
          const dataService = new DataService(testDbPath);
          await dataService.initialize();

          try {
            // Save the session
            await dataService.saveFocusSession(originalSession);

            // Load sessions for the same date
            const loadedSessions = await dataService.getFocusSessions(startTime);

            // Should have exactly one session
            expect(loadedSessions).toHaveLength(1);

            const loadedSession = loadedSessions[0];

            // Verify all fields match
            expect(loadedSession.id).toBe(originalSession.id);
            expect(loadedSession.taskName).toBe(originalSession.taskName);
            expect(loadedSession.duration).toBe(originalSession.duration);
            expect(loadedSession.completed).toBe(originalSession.completed);

            // Verify timestamps match (compare ISO strings to avoid millisecond precision issues)
            expect(loadedSession.startTime.toISOString()).toBe(originalSession.startTime.toISOString());
            expect(loadedSession.endTime.toISOString()).toBe(originalSession.endTime.toISOString());

            // Clean up
            dataService.close();

            // Property holds: Round-trip was successful
            return true;
          } catch (error) {
            dataService.close();
            throw new Error(
              `Round-trip consistency failed. Error: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      ),
      {
        numRuns: 100, // Run 100 iterations to test various data combinations
        verbose: true,
      }
    );
  });

  /**
   * Property 7 (Edge Case): Empty task name should round-trip correctly
   * Feature: pomodoro-timer, Property 7: 对于任何有效的专注时段数据，保存到本地存储后再加载，应该得到等价的数据对象（任务名称、时长、时间戳都相同）
   * 
   * **Validates: Requirements 2.2, 2.4, 3.1, 3.2**
   */
  it('Property 7 (Edge Case): should handle empty task name in round-trip', async () => {
    const dataService = new DataService(testDbPath);
    await dataService.initialize();

    const session = {
      id: 'empty-task-test',
      taskName: '', // Empty task name
      duration: 1500,
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:25:00Z'),
      completed: true,
    };

    await dataService.saveFocusSession(session);
    const loaded = await dataService.getFocusSessions(session.startTime);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].taskName).toBe(''); // Empty string should be preserved

    dataService.close();
  });

  /**
   * Property 7 (Edge Case): Maximum length task name should round-trip correctly
   * Feature: pomodoro-timer, Property 7: 对于任何有效的专注时段数据，保存到本地存储后再加载，应该得到等价的数据对象（任务名称、时长、时间戳都相同）
   * 
   * **Validates: Requirements 2.2, 2.4, 3.1, 3.2**
   */
  it('Property 7 (Edge Case): should handle maximum length task name in round-trip', async () => {
    const dataService = new DataService(testDbPath);
    await dataService.initialize();

    const maxLengthTaskName = 'A'.repeat(100); // Maximum allowed length

    const session = {
      id: 'max-length-test',
      taskName: maxLengthTaskName,
      duration: 1500,
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:25:00Z'),
      completed: true,
    };

    await dataService.saveFocusSession(session);
    const loaded = await dataService.getFocusSessions(session.startTime);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].taskName).toBe(maxLengthTaskName);
    expect(loaded[0].taskName.length).toBe(100);

    dataService.close();
  });

  /**
   * Property 7 (Edge Case): Special characters in task name should round-trip correctly
   * Feature: pomodoro-timer, Property 7: 对于任何有效的专注时段数据，保存到本地存储后再加载，应该得到等价的数据对象（任务名称、时长、时间戳都相同）
   * 
   * **Validates: Requirements 2.2, 2.4, 3.1, 3.2**
   */
  it('Property 7 (Edge Case): should handle special characters in task name', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate task names with various special characters
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.length <= 100),
        async (taskName) => {
          const dataService = new DataService(testDbPath);
          await dataService.initialize();

          const session = {
            id: `special-char-${Date.now()}-${Math.random()}`,
            taskName,
            duration: 1500,
            startTime: new Date('2024-01-01T10:00:00Z'),
            endTime: new Date('2024-01-01T10:25:00Z'),
            completed: true,
          };

          await dataService.saveFocusSession(session);
          const loaded = await dataService.getFocusSessions(session.startTime);

          // Find the session we just saved (there might be others from previous iterations)
          const loadedSession = loaded.find(s => s.id === session.id);
          expect(loadedSession).toBeDefined();
          expect(loadedSession!.taskName).toBe(taskName);

          dataService.close();
          return true;
        }
      ),
      {
        numRuns: 50,
      }
    );
  });

  /**
   * Property 7 (Edge Case): Boundary duration values should round-trip correctly
   * Feature: pomodoro-timer, Property 7: 对于任何有效的专注时段数据，保存到本地存储后再加载，应该得到等价的数据对象（任务名称、时长、时间戳都相同）
   * 
   * **Validates: Requirements 2.2, 2.4, 3.1, 3.2**
   */
  it('Property 7 (Edge Case): should handle boundary duration values', async () => {
    const dataService = new DataService(testDbPath);
    await dataService.initialize();

    // Test minimum duration (60 seconds)
    const minSession = {
      id: 'min-duration-test',
      taskName: 'Minimum Duration',
      duration: 60,
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:01:00Z'),
      completed: true,
    };

    await dataService.saveFocusSession(minSession);
    let loaded = await dataService.getFocusSessions(minSession.startTime);
    expect(loaded.find(s => s.id === 'min-duration-test')?.duration).toBe(60);

    // Test maximum duration (7200 seconds = 2 hours)
    const maxSession = {
      id: 'max-duration-test',
      taskName: 'Maximum Duration',
      duration: 7200,
      startTime: new Date('2024-01-02T10:00:00Z'),
      endTime: new Date('2024-01-02T12:00:00Z'),
      completed: true,
    };

    await dataService.saveFocusSession(maxSession);
    loaded = await dataService.getFocusSessions(maxSession.startTime);
    expect(loaded.find(s => s.id === 'max-duration-test')?.duration).toBe(7200);

    dataService.close();
  });

  /**
   * Property 7 (Multiple Sessions): Multiple sessions should all round-trip correctly
   * Feature: pomodoro-timer, Property 7: 对于任何有效的专注时段数据，保存到本地存储后再加载，应该得到等价的数据对象（任务名称、时长、时间戳都相同）
   * 
   * **Validates: Requirements 2.2, 2.4, 3.1, 3.2**
   * 
   * This test verifies that when multiple sessions are saved, they all
   * maintain data consistency independently.
   */
  it('Property 7 (Multiple Sessions): should maintain consistency for multiple sessions', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate an array of valid focus sessions
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            taskName: fc.string({ minLength: 0, maxLength: 100 }),
            duration: fc.integer({ min: 60, max: 7200 }),
            startTime: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-01-01T23:59:59') }),
            durationOffset: fc.integer({ min: 1000, max: 7200000 }),
            completed: fc.boolean(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (sessionConfigs) => {
          const dataService = new DataService(testDbPath);
          await dataService.initialize();

          // Create sessions with unique IDs
          const originalSessions = sessionConfigs.map((config, index) => ({
            id: `${config.id}-${index}`, // Ensure unique IDs
            taskName: config.taskName,
            duration: config.duration,
            startTime: config.startTime,
            endTime: new Date(config.startTime.getTime() + config.durationOffset),
            completed: config.completed,
          }));

          try {
            // Save all sessions
            for (const session of originalSessions) {
              await dataService.saveFocusSession(session);
            }

            // Load all sessions for the date
            const loadedSessions = await dataService.getFocusSessions(new Date('2024-01-01'));

            // Should have at least as many sessions as we saved
            expect(loadedSessions.length).toBeGreaterThanOrEqual(originalSessions.length);

            // Verify each original session can be found and matches
            for (const original of originalSessions) {
              const loaded = loadedSessions.find(s => s.id === original.id);
              expect(loaded).toBeDefined();
              expect(loaded!.taskName).toBe(original.taskName);
              expect(loaded!.duration).toBe(original.duration);
              expect(loaded!.completed).toBe(original.completed);
              expect(loaded!.startTime.toISOString()).toBe(original.startTime.toISOString());
              expect(loaded!.endTime.toISOString()).toBe(original.endTime.toISOString());
            }

            dataService.close();
            return true;
          } catch (error) {
            dataService.close();
            throw new Error(
              `Multiple sessions round-trip failed. Error: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      ),
      {
        numRuns: 20,
      }
    );
  });

  /**
   * Property 7 (Update): Updating a session should maintain round-trip consistency
   * Feature: pomodoro-timer, Property 7: 对于任何有效的专注时段数据，保存到本地存储后再加载，应该得到等价的数据对象（任务名称、时长、时间戳都相同）
   * 
   * **Validates: Requirements 2.2, 2.4, 3.1, 3.2**
   * 
   * This test verifies that when a session is updated (saved with the same ID),
   * the updated data maintains consistency.
   */
  it('Property 7 (Update): should maintain consistency when updating sessions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          taskName1: fc.string({ minLength: 0, maxLength: 100 }),
          taskName2: fc.string({ minLength: 0, maxLength: 100 }),
          duration1: fc.integer({ min: 60, max: 7200 }),
          duration2: fc.integer({ min: 60, max: 7200 }),
          startTime: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-01-01T23:59:59') }),
          durationOffset1: fc.integer({ min: 1000, max: 7200000 }),
          durationOffset2: fc.integer({ min: 1000, max: 7200000 }),
          completed1: fc.boolean(),
          completed2: fc.boolean(),
        }),
        async (config) => {
          const dataService = new DataService(testDbPath);
          await dataService.initialize();

          // Create first version of session
          const session1 = {
            id: config.id,
            taskName: config.taskName1,
            duration: config.duration1,
            startTime: config.startTime,
            endTime: new Date(config.startTime.getTime() + config.durationOffset1),
            completed: config.completed1,
          };

          // Save first version
          await dataService.saveFocusSession(session1);

          // Create updated version with same ID
          const session2 = {
            id: config.id, // Same ID
            taskName: config.taskName2,
            duration: config.duration2,
            startTime: config.startTime,
            endTime: new Date(config.startTime.getTime() + config.durationOffset2),
            completed: config.completed2,
          };

          // Save updated version (should replace)
          await dataService.saveFocusSession(session2);

          // Load sessions
          const loaded = await dataService.getFocusSessions(config.startTime);

          // Should have exactly one session with this ID
          const matchingSessions = loaded.filter(s => s.id === config.id);
          expect(matchingSessions).toHaveLength(1);

          // Should match the updated version, not the original
          const loadedSession = matchingSessions[0];
          expect(loadedSession.taskName).toBe(session2.taskName);
          expect(loadedSession.duration).toBe(session2.duration);
          expect(loadedSession.completed).toBe(session2.completed);
          expect(loadedSession.startTime.toISOString()).toBe(session2.startTime.toISOString());
          expect(loadedSession.endTime.toISOString()).toBe(session2.endTime.toISOString());

          dataService.close();
          return true;
        }
      ),
      {
        numRuns: 30,
      }
    );
  });

  /**
   * Property 14: 应用设置往返一致性 (Application Settings Round-Trip Consistency)
   * Feature: pomodoro-timer, Property 14: 对于任何有效的应用设置对象（包括置顶状态、透明度等），保存到本地存储后再加载，应该得到等价的设置对象
   * 
   * **Validates: Requirements 6.3, 6.4**
   * 
   * This property verifies that for ANY valid AppSettings data:
   * 1. When saved to the database
   * 2. And then loaded back from the database
   * 3. The loaded settings should be equivalent to the original settings
   * 4. All fields (alwaysOnTop, windowPosition, defaultDuration, soundEnabled, opacity) should match
   */
  it('Property 14: should maintain data consistency for app settings round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid AppSettings data
        fc.record({
          alwaysOnTop: fc.boolean(),
          windowPosition: fc.record({
            x: fc.integer({ min: -10000, max: 10000 }),
            y: fc.integer({ min: -10000, max: 10000 }),
          }),
          defaultDuration: fc.integer({ min: 60, max: 7200 }),
          soundEnabled: fc.boolean(),
          opacity: fc.float({ min: Math.fround(0.3), max: Math.fround(1.0), noNaN: true }),
        }),
        async (originalSettings) => {
          // Clean up any existing database file before this iteration
          if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
          }

          // Initialize a fresh database for this test
          const dataService = new DataService(testDbPath);
          await dataService.initialize();

          try {
            // Save the settings
            await dataService.saveSettings(originalSettings);

            // Load the settings back
            const loadedSettings = await dataService.loadSettings();

            // Verify all fields match
            expect(loadedSettings.alwaysOnTop).toBe(originalSettings.alwaysOnTop);
            expect(loadedSettings.windowPosition.x).toBe(originalSettings.windowPosition.x);
            expect(loadedSettings.windowPosition.y).toBe(originalSettings.windowPosition.y);
            expect(loadedSettings.defaultDuration).toBe(originalSettings.defaultDuration);
            expect(loadedSettings.soundEnabled).toBe(originalSettings.soundEnabled);
            
            // For floating point comparison, use closeTo to handle precision issues
            expect(loadedSettings.opacity).toBeCloseTo(originalSettings.opacity, 10);

            // Clean up
            dataService.close();

            // Property holds: Round-trip was successful
            return true;
          } catch (error) {
            dataService.close();
            throw new Error(
              `Settings round-trip consistency failed. Error: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      ),
      {
        numRuns: 100, // Run 100 iterations to test various settings combinations
        verbose: true,
      }
    );
  });

  /**
   * Property 14 (Edge Case): Boundary opacity values should round-trip correctly
   * Feature: pomodoro-timer, Property 14: 对于任何有效的应用设置对象（包括置顶状态、透明度等），保存到本地存储后再加载，应该得到等价的设置对象
   * 
   * **Validates: Requirements 6.3, 6.4**
   */
  it('Property 14 (Edge Case): should handle boundary opacity values', async () => {
    const dataService = new DataService(testDbPath);
    await dataService.initialize();

    // Test minimum opacity (0.3)
    const minOpacitySettings = {
      alwaysOnTop: true,
      windowPosition: { x: 100, y: 100 },
      defaultDuration: 1500,
      soundEnabled: true,
      opacity: 0.3,
    };

    await dataService.saveSettings(minOpacitySettings);
    let loaded = await dataService.loadSettings();
    expect(loaded.opacity).toBeCloseTo(0.3, 10);

    // Test maximum opacity (1.0)
    const maxOpacitySettings = {
      alwaysOnTop: false,
      windowPosition: { x: 200, y: 200 },
      defaultDuration: 3600,
      soundEnabled: false,
      opacity: 1.0,
    };

    await dataService.saveSettings(maxOpacitySettings);
    loaded = await dataService.loadSettings();
    expect(loaded.opacity).toBeCloseTo(1.0, 10);

    dataService.close();
  });

  /**
   * Property 14 (Edge Case): Boundary duration values should round-trip correctly
   * Feature: pomodoro-timer, Property 14: 对于任何有效的应用设置对象（包括置顶状态、透明度等），保存到本地存储后再加载，应该得到等价的设置对象
   * 
   * **Validates: Requirements 6.3, 6.4**
   */
  it('Property 14 (Edge Case): should handle boundary duration values', async () => {
    const dataService = new DataService(testDbPath);
    await dataService.initialize();

    // Test minimum duration (60 seconds)
    const minDurationSettings = {
      alwaysOnTop: true,
      windowPosition: { x: 100, y: 100 },
      defaultDuration: 60,
      soundEnabled: true,
      opacity: 0.8,
    };

    await dataService.saveSettings(minDurationSettings);
    let loaded = await dataService.loadSettings();
    expect(loaded.defaultDuration).toBe(60);

    // Test maximum duration (7200 seconds = 2 hours)
    const maxDurationSettings = {
      alwaysOnTop: false,
      windowPosition: { x: 200, y: 200 },
      defaultDuration: 7200,
      soundEnabled: false,
      opacity: 0.5,
    };

    await dataService.saveSettings(maxDurationSettings);
    loaded = await dataService.loadSettings();
    expect(loaded.defaultDuration).toBe(7200);

    dataService.close();
  });

  /**
   * Property 14 (Edge Case): Extreme window positions should round-trip correctly
   * Feature: pomodoro-timer, Property 14: 对于任何有效的应用设置对象（包括置顶状态、透明度等），保存到本地存储后再加载，应该得到等价的设置对象
   * 
   * **Validates: Requirements 6.3, 6.4**
   */
  it('Property 14 (Edge Case): should handle extreme window positions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          x: fc.integer({ min: -10000, max: 10000 }),
          y: fc.integer({ min: -10000, max: 10000 }),
        }),
        async (windowPosition) => {
          const dataService = new DataService(testDbPath);
          await dataService.initialize();

          const settings = {
            alwaysOnTop: true,
            windowPosition,
            defaultDuration: 1500,
            soundEnabled: true,
            opacity: 0.8,
          };

          await dataService.saveSettings(settings);
          const loaded = await dataService.loadSettings();

          expect(loaded.windowPosition.x).toBe(windowPosition.x);
          expect(loaded.windowPosition.y).toBe(windowPosition.y);

          dataService.close();
          return true;
        }
      ),
      {
        numRuns: 50,
      }
    );
  });

  /**
   * Property 14 (Multiple Updates): Multiple settings updates should maintain consistency
   * Feature: pomodoro-timer, Property 14: 对于任何有效的应用设置对象（包括置顶状态、透明度等），保存到本地存储后再加载，应该得到等价的设置对象
   * 
   * **Validates: Requirements 6.3, 6.4**
   * 
   * This test verifies that when settings are updated multiple times,
   * each update maintains round-trip consistency and the latest values are preserved.
   */
  it('Property 14 (Multiple Updates): should maintain consistency across multiple updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate an array of different settings configurations
        fc.array(
          fc.record({
            alwaysOnTop: fc.boolean(),
            windowPosition: fc.record({
              x: fc.integer({ min: -1000, max: 5000 }),
              y: fc.integer({ min: -1000, max: 5000 }),
            }),
            defaultDuration: fc.integer({ min: 60, max: 7200 }),
            soundEnabled: fc.boolean(),
            opacity: fc.float({ min: Math.fround(0.3), max: Math.fround(1.0), noNaN: true }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (settingsArray) => {
          const dataService = new DataService(testDbPath);
          await dataService.initialize();

          try {
            // Save each settings configuration in sequence
            for (const settings of settingsArray) {
              await dataService.saveSettings(settings);

              // Verify it was saved correctly
              const loaded = await dataService.loadSettings();
              expect(loaded.alwaysOnTop).toBe(settings.alwaysOnTop);
              expect(loaded.windowPosition.x).toBe(settings.windowPosition.x);
              expect(loaded.windowPosition.y).toBe(settings.windowPosition.y);
              expect(loaded.defaultDuration).toBe(settings.defaultDuration);
              expect(loaded.soundEnabled).toBe(settings.soundEnabled);
              expect(loaded.opacity).toBeCloseTo(settings.opacity, 10);
            }

            // Final verification: loaded settings should match the last saved settings
            const finalLoaded = await dataService.loadSettings();
            const lastSettings = settingsArray[settingsArray.length - 1];

            expect(finalLoaded.alwaysOnTop).toBe(lastSettings.alwaysOnTop);
            expect(finalLoaded.windowPosition.x).toBe(lastSettings.windowPosition.x);
            expect(finalLoaded.windowPosition.y).toBe(lastSettings.windowPosition.y);
            expect(finalLoaded.defaultDuration).toBe(lastSettings.defaultDuration);
            expect(finalLoaded.soundEnabled).toBe(lastSettings.soundEnabled);
            expect(finalLoaded.opacity).toBeCloseTo(lastSettings.opacity, 10);

            dataService.close();
            return true;
          } catch (error) {
            dataService.close();
            throw new Error(
              `Multiple settings updates failed. Error: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      ),
      {
        numRuns: 20,
      }
    );
  });

  /**
   * Property 14 (Default Settings): Loading settings before any save should return defaults
   * Feature: pomodoro-timer, Property 14: 对于任何有效的应用设置对象（包括置顶状态、透明度等），保存到本地存储后再加载，应该得到等价的设置对象
   * 
   * **Validates: Requirements 6.3, 6.4**
   * 
   * This test verifies that when no settings have been saved yet,
   * loading settings returns the default values.
   */
  it('Property 14 (Default Settings): should return default settings when none exist', async () => {
    const dataService = new DataService(testDbPath);
    await dataService.initialize();

    // Load settings without saving any first
    const loaded = await dataService.loadSettings();

    // Verify default values
    expect(loaded.alwaysOnTop).toBe(true);
    expect(loaded.windowPosition.x).toBe(100);
    expect(loaded.windowPosition.y).toBe(100);
    expect(loaded.defaultDuration).toBe(1500);
    expect(loaded.soundEnabled).toBe(true);
    expect(loaded.opacity).toBe(0.8);

    dataService.close();
  });

  /**
   * Property 14 (Partial Settings): All fields should be preserved independently
   * Feature: pomodoro-timer, Property 14: 对于任何有效的应用设置对象（包括置顶状态、透明度等），保存到本地存储后再加载，应该得到等价的设置对象
   * 
   * **Validates: Requirements 6.3, 6.4**
   * 
   * This test verifies that all fields in the settings object are preserved
   * independently and correctly during round-trip.
   */
  it('Property 14 (Partial Settings): should preserve all fields independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate settings where each field varies independently
        fc.boolean(),
        fc.integer({ min: -1000, max: 5000 }),
        fc.integer({ min: -1000, max: 5000 }),
        fc.integer({ min: 60, max: 7200 }),
        fc.boolean(),
        fc.float({ min: Math.fround(0.3), max: Math.fround(1.0), noNaN: true }),
        async (alwaysOnTop, x, y, defaultDuration, soundEnabled, opacity) => {
          const dataService = new DataService(testDbPath);
          await dataService.initialize();

          const settings = {
            alwaysOnTop,
            windowPosition: { x, y },
            defaultDuration,
            soundEnabled,
            opacity,
          };

          await dataService.saveSettings(settings);
          const loaded = await dataService.loadSettings();

          // Each field should be preserved independently
          expect(loaded.alwaysOnTop).toBe(alwaysOnTop);
          expect(loaded.windowPosition.x).toBe(x);
          expect(loaded.windowPosition.y).toBe(y);
          expect(loaded.defaultDuration).toBe(defaultDuration);
          expect(loaded.soundEnabled).toBe(soundEnabled);
          expect(loaded.opacity).toBeCloseTo(opacity, 10);

          dataService.close();
          return true;
        }
      ),
      {
        numRuns: 50,
      }
    );
  });
});
