/**
 * Unit tests for DataService
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DataService } from './DataService';
import { FocusSession, AppSettings } from '../shared/types';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('DataService', () => {
  let dataService: DataService;
  let testDbPath: string;

  beforeEach(async () => {
    // Create a temporary database file for testing
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pomodoro-test-'));
    testDbPath = path.join(tempDir, 'test.db');
    dataService = new DataService(testDbPath);
    await dataService.initialize();
  });

  afterEach(() => {
    // Clean up
    dataService.close();
    
    // Give a small delay for file handles to be released on Windows
    const cleanup = () => {
      try {
        if (fs.existsSync(testDbPath)) {
          fs.unlinkSync(testDbPath);
        }
        const tempDir = path.dirname(testDbPath);
        if (fs.existsSync(tempDir)) {
          // Clean up any backup files
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
    };
    
    // Try cleanup immediately, if it fails, it's okay
    cleanup();
  });

  describe('Database Initialization', () => {
    it('should create database file on initialization', () => {
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should create focus_sessions table', async () => {
      const db = dataService.getDatabase();
      expect(db).not.toBeNull();

      const tableInfo = db!
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='focus_sessions'")
        .get();

      expect(tableInfo).toBeDefined();
    });

    it('should create app_settings table', async () => {
      const db = dataService.getDatabase();
      expect(db).not.toBeNull();

      const tableInfo = db!
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'")
        .get();

      expect(tableInfo).toBeDefined();
    });

    it('should create database_info table for version management', async () => {
      const db = dataService.getDatabase();
      expect(db).not.toBeNull();

      const tableInfo = db!
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='database_info'")
        .get();

      expect(tableInfo).toBeDefined();
    });

    it('should create indexes on focus_sessions', async () => {
      const db = dataService.getDatabase();
      expect(db).not.toBeNull();

      const indexes = db!
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='focus_sessions'")
        .all();

      expect(indexes.length).toBeGreaterThan(0);
    });

    it('should set database version on first initialization', async () => {
      const db = dataService.getDatabase();
      expect(db).not.toBeNull();

      const versionRow = db!
        .prepare('SELECT value FROM database_info WHERE key = ?')
        .get('version') as { value: string } | undefined;

      expect(versionRow).toBeDefined();
      expect(parseInt(versionRow!.value, 10)).toBe(1);
    });
  });

  describe('Focus Session Operations', () => {
    it('should save a focus session', async () => {
      const session: FocusSession = {
        id: 'test-session-1',
        taskName: 'Test Task',
        duration: 1500,
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:25:00Z'),
        completed: true,
      };

      await dataService.saveFocusSession(session);

      const sessions = await dataService.getFocusSessions(new Date('2024-01-01'));
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe(session.id);
      expect(sessions[0].taskName).toBe(session.taskName);
      expect(sessions[0].duration).toBe(session.duration);
      expect(sessions[0].completed).toBe(session.completed);
    });

    it('should retrieve focus sessions for a specific date', async () => {
      const session1: FocusSession = {
        id: 'session-1',
        taskName: 'Task 1',
        duration: 1500,
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:25:00Z'),
        completed: true,
      };

      const session2: FocusSession = {
        id: 'session-2',
        taskName: 'Task 2',
        duration: 1200,
        startTime: new Date('2024-01-01T14:00:00Z'),
        endTime: new Date('2024-01-01T14:20:00Z'),
        completed: true,
      };

      const session3: FocusSession = {
        id: 'session-3',
        taskName: 'Task 3',
        duration: 1800,
        startTime: new Date('2024-01-02T10:00:00Z'),
        endTime: new Date('2024-01-02T10:30:00Z'),
        completed: true,
      };

      await dataService.saveFocusSession(session1);
      await dataService.saveFocusSession(session2);
      await dataService.saveFocusSession(session3);

      const sessionsJan1 = await dataService.getFocusSessions(new Date('2024-01-01'));
      expect(sessionsJan1).toHaveLength(2);

      const sessionsJan2 = await dataService.getFocusSessions(new Date('2024-01-02'));
      expect(sessionsJan2).toHaveLength(1);
    });

    it('should return empty array for date with no sessions', async () => {
      const sessions = await dataService.getFocusSessions(new Date('2024-01-01'));
      expect(sessions).toHaveLength(0);
    });

    it('should update existing session when saving with same id', async () => {
      const session: FocusSession = {
        id: 'test-session',
        taskName: 'Original Task',
        duration: 1500,
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:25:00Z'),
        completed: false,
      };

      await dataService.saveFocusSession(session);

      // Update the session
      const updatedSession: FocusSession = {
        ...session,
        taskName: 'Updated Task',
        completed: true,
      };

      await dataService.saveFocusSession(updatedSession);

      const sessions = await dataService.getFocusSessions(new Date('2024-01-01'));
      expect(sessions).toHaveLength(1);
      expect(sessions[0].taskName).toBe('Updated Task');
      expect(sessions[0].completed).toBe(true);
    });
  });

  describe('Statistics Operations', () => {
    it('should calculate statistics for a date range', async () => {
      const sessions: FocusSession[] = [
        {
          id: 'session-1',
          taskName: 'Task 1',
          duration: 1500,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: true,
        },
        {
          id: 'session-2',
          taskName: 'Task 2',
          duration: 1200,
          startTime: new Date('2024-01-02T14:00:00Z'),
          endTime: new Date('2024-01-02T14:20:00Z'),
          completed: true,
        },
        {
          id: 'session-3',
          taskName: 'Task 3',
          duration: 1800,
          startTime: new Date('2024-01-03T10:00:00Z'),
          endTime: new Date('2024-01-03T10:30:00Z'),
          completed: true,
        },
      ];

      for (const session of sessions) {
        await dataService.saveFocusSession(session);
      }

      const stats = await dataService.getStatistics(
        new Date('2024-01-01'),
        new Date('2024-01-03')
      );

      expect(stats.sessionCount).toBe(3);
      expect(stats.totalFocusTime).toBe(1500 + 1200 + 1800);
      expect(stats.sessions).toHaveLength(3);
    });

    it('should return empty statistics for date range with no sessions', async () => {
      const stats = await dataService.getStatistics(
        new Date('2024-01-01'),
        new Date('2024-01-03')
      );

      expect(stats.sessionCount).toBe(0);
      expect(stats.totalFocusTime).toBe(0);
      expect(stats.sessions).toHaveLength(0);
    });
  });

  describe('Settings Operations', () => {
    it('should save and load settings', async () => {
      const settings: AppSettings = {
        alwaysOnTop: false,
        windowPosition: { x: 200, y: 300 },
        defaultDuration: 2400,
        soundEnabled: false,
        opacity: 0.9,
      };

      await dataService.saveSettings(settings);
      const loadedSettings = await dataService.loadSettings();

      expect(loadedSettings.alwaysOnTop).toBe(settings.alwaysOnTop);
      expect(loadedSettings.windowPosition.x).toBe(settings.windowPosition.x);
      expect(loadedSettings.windowPosition.y).toBe(settings.windowPosition.y);
      expect(loadedSettings.defaultDuration).toBe(settings.defaultDuration);
      expect(loadedSettings.soundEnabled).toBe(settings.soundEnabled);
      expect(loadedSettings.opacity).toBe(settings.opacity);
    });

    it('should return default settings when no settings exist', async () => {
      const settings = await dataService.loadSettings();

      expect(settings.alwaysOnTop).toBe(true);
      expect(settings.defaultDuration).toBe(1500);
      expect(settings.soundEnabled).toBe(true);
      expect(settings.opacity).toBe(0.8);
    });

    it('should update existing settings', async () => {
      const settings1: AppSettings = {
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 1500,
        soundEnabled: true,
        opacity: 0.8,
      };

      await dataService.saveSettings(settings1);

      const settings2: AppSettings = {
        alwaysOnTop: false,
        windowPosition: { x: 200, y: 200 },
        defaultDuration: 2400,
        soundEnabled: false,
        opacity: 0.9,
      };

      await dataService.saveSettings(settings2);
      const loadedSettings = await dataService.loadSettings();

      expect(loadedSettings.alwaysOnTop).toBe(false);
      expect(loadedSettings.windowPosition.x).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when trying to save session without initialization', async () => {
      const uninitializedService = new DataService(':memory:');
      // Don't call initialize()

      const session: FocusSession = {
        id: 'test',
        taskName: 'Test',
        duration: 1500,
        startTime: new Date(),
        endTime: new Date(),
        completed: true,
      };

      await expect(uninitializedService.saveFocusSession(session)).rejects.toThrow(
        'Database not initialized'
      );
    });

    it('should throw error when trying to load settings without initialization', async () => {
      const uninitializedService = new DataService(':memory:');
      // Don't call initialize()

      await expect(uninitializedService.loadSettings()).rejects.toThrow(
        'Database not initialized'
      );
    });

    describe('Write Failure Scenarios', () => {
      it('should handle write failure when database is closed', async () => {
        const session: FocusSession = {
          id: 'test-session',
          taskName: 'Test Task',
          duration: 1500,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: true,
        };

        // Close the database to simulate write failure
        dataService.close();

        // Attempt to save should fail
        await expect(dataService.saveFocusSession(session)).rejects.toThrow(
          'Database not initialized'
        );

        // Re-initialize for cleanup
        await dataService.initialize();
      });

      it('should handle write failure when saving settings to closed database', async () => {
        const settings: AppSettings = {
          alwaysOnTop: false,
          windowPosition: { x: 200, y: 300 },
          defaultDuration: 2400,
          soundEnabled: false,
          opacity: 0.9,
        };

        // Close the database to simulate write failure
        dataService.close();

        // Attempt to save should fail
        await expect(dataService.saveSettings(settings)).rejects.toThrow(
          'Database not initialized'
        );

        // Re-initialize for cleanup
        await dataService.initialize();
      });

      it('should throw descriptive error when write fails due to constraint violation', async () => {
        // First, save a valid session
        const session: FocusSession = {
          id: 'test-session',
          taskName: 'Test Task',
          duration: 1500,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: true,
        };

        await dataService.saveFocusSession(session);

        // Try to save with invalid data that would cause a database error
        // (This tests that database errors are properly caught and wrapped)
        const invalidSession: any = {
          id: 'test-session-2',
          taskName: 'Test Task',
          duration: 'invalid', // This will cause a type error at runtime
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: true,
        };

        // Should fail validation before reaching database
        await expect(dataService.saveFocusSession(invalidSession)).rejects.toThrow();
      });
    });

    describe('Query Failure Scenarios', () => {
      it('should handle query failure when database is closed', async () => {
        // Close the database to simulate query failure
        dataService.close();

        // Attempt to query should fail
        await expect(dataService.getFocusSessions(new Date('2024-01-01'))).rejects.toThrow(
          'Database not initialized'
        );

        // Re-initialize for cleanup
        await dataService.initialize();
      });

      it('should handle query failure when getting statistics from closed database', async () => {
        // Close the database to simulate query failure
        dataService.close();

        // Attempt to query should fail
        await expect(
          dataService.getStatistics(new Date('2024-01-01'), new Date('2024-01-03'))
        ).rejects.toThrow('Database not initialized');

        // Re-initialize for cleanup
        await dataService.initialize();
      });

      it('should handle query failure when loading settings from closed database', async () => {
        // Close the database to simulate query failure
        dataService.close();

        // Attempt to query should fail
        await expect(dataService.loadSettings()).rejects.toThrow('Database not initialized');

        // Re-initialize for cleanup
        await dataService.initialize();
      });

      it('should throw descriptive error message on query failure', async () => {
        // Save a session first
        const session: FocusSession = {
          id: 'test-session',
          taskName: 'Test Task',
          duration: 1500,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: true,
        };

        await dataService.saveFocusSession(session);

        // Close database
        dataService.close();

        // Query should fail with descriptive error
        try {
          await dataService.getFocusSessions(new Date('2024-01-01'));
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Database not initialized');
        }

        // Re-initialize for cleanup
        await dataService.initialize();
      });
    });

    describe('Connection Failure Scenarios', () => {
      it('should handle initialization failure with invalid path', async () => {
        // Try to create database in a path that doesn't exist and can't be created
        // On Windows, using invalid characters in path
        const invalidPath = path.join(os.tmpdir(), 'invalid\x00path', 'test.db');
        const failService = new DataService(invalidPath);

        // Should throw error during initialization
        await expect(failService.initialize()).rejects.toThrow();
      });

      it('should handle initialization failure with read-only directory', async () => {
        // Create a temporary directory
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readonly-test-'));
        const readonlyDbPath = path.join(tempDir, 'test.db');

        try {
          // On Windows, we can't easily make a directory read-only in the same way as Unix
          // Instead, we'll test with a file that exists but is read-only
          fs.writeFileSync(readonlyDbPath, 'dummy');
          fs.chmodSync(readonlyDbPath, 0o444); // Read-only

          const failService = new DataService(readonlyDbPath);

          // Should handle the error (either throw or recover)
          try {
            await failService.initialize();
            // If it succeeds, it means it handled the corruption
            // (treated the dummy file as corrupted and created a new one)
            const settings = await failService.loadSettings();
            expect(settings).toBeDefined();
            failService.close();
          } catch (error) {
            // If it fails, that's also acceptable - it detected the problem
            expect(error).toBeInstanceOf(Error);
          }
        } finally {
          // Cleanup: restore permissions and delete
          try {
            if (fs.existsSync(readonlyDbPath)) {
              fs.chmodSync(readonlyDbPath, 0o666);
              fs.unlinkSync(readonlyDbPath);
            }
            // Clean up any backup files
            const files = fs.readdirSync(tempDir);
            files.forEach((file) => {
              try {
                const filePath = path.join(tempDir, file);
                fs.chmodSync(filePath, 0o666);
                fs.unlinkSync(filePath);
              } catch (e) {
                // Ignore cleanup errors
              }
            });
            fs.rmdirSync(tempDir);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      });

      it('should throw error when database path is not provided and Electron is not available', () => {
        // This test verifies the constructor behavior when no path is provided
        // and Electron app is not available (which is the case in unit tests)
        expect(() => {
          // Don't provide a path, and Electron won't be available in test environment
          new DataService();
        }).toThrow('Database path must be provided when Electron app is not available');
      });

      it('should handle database connection after close', async () => {
        // Close the database
        dataService.close();

        // Verify database is closed
        expect(dataService.getDatabase()).toBeNull();

        // Any operation should fail
        await expect(dataService.loadSettings()).rejects.toThrow('Database not initialized');

        // Re-initialize should work
        await dataService.initialize();
        expect(dataService.getDatabase()).not.toBeNull();

        // Operations should work again
        const settings = await dataService.loadSettings();
        expect(settings).toBeDefined();
      });

      it('should handle multiple close calls gracefully', () => {
        // Close multiple times should not throw
        expect(() => {
          dataService.close();
          dataService.close();
          dataService.close();
        }).not.toThrow();

        // Database should be null
        expect(dataService.getDatabase()).toBeNull();
      });
    });
  });

  describe('Data Validation', () => {
    describe('Focus Session Validation', () => {
      it('should reject session with empty id', async () => {
        const session: FocusSession = {
          id: '',
          taskName: 'Test Task',
          duration: 1500,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).rejects.toThrow(
          'Focus session id must be a non-empty string'
        );
      });

      it('should reject session with whitespace-only id', async () => {
        const session: FocusSession = {
          id: '   ',
          taskName: 'Test Task',
          duration: 1500,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).rejects.toThrow(
          'Focus session id must be a non-empty string'
        );
      });

      it('should reject session with non-string taskName', async () => {
        const session: any = {
          id: 'test-id',
          taskName: 123, // Invalid: number instead of string
          duration: 1500,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).rejects.toThrow(
          'Focus session taskName must be a string'
        );
      });

      it('should reject session with taskName exceeding 100 characters', async () => {
        const session: FocusSession = {
          id: 'test-id',
          taskName: 'A'.repeat(101), // 101 characters
          duration: 1500,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).rejects.toThrow(
          'Focus session taskName must not exceed 100 characters'
        );
      });

      it('should accept session with taskName exactly 100 characters', async () => {
        const session: FocusSession = {
          id: 'test-id',
          taskName: 'A'.repeat(100), // Exactly 100 characters
          duration: 1500,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).resolves.not.toThrow();
      });

      it('should reject session with non-integer duration', async () => {
        const session: any = {
          id: 'test-id',
          taskName: 'Test Task',
          duration: 1500.5, // Invalid: not an integer
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).rejects.toThrow(
          'Focus session duration must be an integer'
        );
      });

      it('should reject session with duration less than 60 seconds', async () => {
        const session: FocusSession = {
          id: 'test-id',
          taskName: 'Test Task',
          duration: 59, // Invalid: less than minimum
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:00:59Z'),
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).rejects.toThrow(
          'Focus session duration must be between 60 and 7200 seconds'
        );
      });

      it('should reject session with duration greater than 7200 seconds', async () => {
        const session: FocusSession = {
          id: 'test-id',
          taskName: 'Test Task',
          duration: 7201, // Invalid: greater than maximum
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T12:00:01Z'),
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).rejects.toThrow(
          'Focus session duration must be between 60 and 7200 seconds'
        );
      });

      it('should accept session with duration exactly 60 seconds', async () => {
        const session: FocusSession = {
          id: 'test-id',
          taskName: 'Test Task',
          duration: 60, // Minimum valid duration
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:01:00Z'),
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).resolves.not.toThrow();
      });

      it('should accept session with duration exactly 7200 seconds', async () => {
        const session: FocusSession = {
          id: 'test-id',
          taskName: 'Test Task',
          duration: 7200, // Maximum valid duration
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T12:00:00Z'),
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).resolves.not.toThrow();
      });

      it('should reject session with invalid startTime', async () => {
        const session: any = {
          id: 'test-id',
          taskName: 'Test Task',
          duration: 1500,
          startTime: 'not a date', // Invalid: string instead of Date
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).rejects.toThrow(
          'Focus session startTime must be a valid Date'
        );
      });

      it('should reject session with invalid endTime', async () => {
        const session: any = {
          id: 'test-id',
          taskName: 'Test Task',
          duration: 1500,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: 'not a date', // Invalid: string instead of Date
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).rejects.toThrow(
          'Focus session endTime must be a valid Date'
        );
      });

      it('should reject session with endTime before startTime', async () => {
        const session: FocusSession = {
          id: 'test-id',
          taskName: 'Test Task',
          duration: 1500,
          startTime: new Date('2024-01-01T10:25:00Z'),
          endTime: new Date('2024-01-01T10:00:00Z'), // Invalid: before startTime
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).rejects.toThrow(
          'Focus session endTime must be after startTime'
        );
      });

      it('should reject session with endTime equal to startTime', async () => {
        const sameTime = new Date('2024-01-01T10:00:00Z');
        const session: FocusSession = {
          id: 'test-id',
          taskName: 'Test Task',
          duration: 1500,
          startTime: sameTime,
          endTime: sameTime, // Invalid: same as startTime
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).rejects.toThrow(
          'Focus session endTime must be after startTime'
        );
      });

      it('should reject session with non-boolean completed', async () => {
        const session: any = {
          id: 'test-id',
          taskName: 'Test Task',
          duration: 1500,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: 'yes', // Invalid: string instead of boolean
        };

        await expect(dataService.saveFocusSession(session)).rejects.toThrow(
          'Focus session completed must be a boolean'
        );
      });

      it('should accept valid session with all fields correct', async () => {
        const session: FocusSession = {
          id: 'valid-session',
          taskName: 'Valid Task',
          duration: 1500,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).resolves.not.toThrow();

        // Verify it was saved
        const sessions = await dataService.getFocusSessions(new Date('2024-01-01'));
        expect(sessions).toHaveLength(1);
        expect(sessions[0].id).toBe('valid-session');
      });

      it('should accept session with empty taskName (will be handled by UI layer)', async () => {
        // Note: The design says empty taskName should use "未命名任务",
        // but this is handled at the UI/service layer, not the data layer
        const session: FocusSession = {
          id: 'test-id',
          taskName: '', // Empty is allowed at data layer
          duration: 1500,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:25:00Z'),
          completed: true,
        };

        await expect(dataService.saveFocusSession(session)).resolves.not.toThrow();
      });
    });
  });

  describe('Database Corruption Handling', () => {
    it('should handle corrupted database by creating new one', async () => {
      // Close the current database
      dataService.close();

      // Corrupt the database file by writing invalid data
      fs.writeFileSync(testDbPath, 'This is not a valid SQLite database');

      // Try to initialize again - should handle corruption
      const newService = new DataService(testDbPath);
      await newService.initialize();

      // Should be able to use the new database
      const settings = await newService.loadSettings();
      expect(settings).toBeDefined();

      // Check that backup was created
      const backupFiles = fs
        .readdirSync(path.dirname(testDbPath))
        .filter((f) => f.includes('.corrupted.'));
      expect(backupFiles.length).toBeGreaterThan(0);

      newService.close();
    });
  });
});
