/**
 * Integration Tests for Error Handling
 * 
 * These tests verify that errors are properly handled across all modules:
 * - DataService (database errors, validation errors)
 * - TimerService (invalid operations)
 * - WindowManager (window operation errors)
 * - Logger (error logging)
 * 
 * Validates: Requirements 3.3, 3.4, 8.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataService } from './DataService';
import { TimerService } from './TimerService';
import { WindowManager } from './WindowManager';
import { Logger } from './Logger';
import { FocusSession, AppSettings } from '../shared/types';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock Electron's BrowserWindow
const mockBrowserWindow = {
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  on: vi.fn(),
  setAlwaysOnTop: vi.fn(),
  isAlwaysOnTop: vi.fn(),
  setOpacity: vi.fn(),
  getOpacity: vi.fn(),
  getPosition: vi.fn(),
  setPosition: vi.fn(),
};

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => mockBrowserWindow),
}));

describe('Error Handling Integration Tests', () => {
  let testDbPath: string;
  let testLogsDir: string;
  let tempDir: string;
  let dataService: DataService;
  let timerService: TimerService;
  let windowManager: WindowManager;
  let logger: Logger;

  beforeEach(async () => {
    // Create temporary directories for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pomodoro-error-test-'));
    testDbPath = path.join(tempDir, 'test.db');
    testLogsDir = path.join(tempDir, 'logs');

    // Initialize services
    dataService = new DataService(testDbPath);
    await dataService.initialize();
    
    timerService = new TimerService();
    windowManager = new WindowManager(dataService);
    logger = new Logger(testLogsDir);

    // Reset mocks
    vi.clearAllMocks();
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
            const filePath = path.join(tempDir, file);
            if (fs.statSync(filePath).isDirectory()) {
              const subFiles = fs.readdirSync(filePath);
              subFiles.forEach(subFile => {
                fs.unlinkSync(path.join(filePath, subFile));
              });
              fs.rmdirSync(filePath);
            } else {
              fs.unlinkSync(filePath);
            }
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

  describe('DataService Error Handling and Logging', () => {
    it('should log errors when database operations fail', async () => {
      // Close database to cause errors
      dataService.close();

      const session: FocusSession = {
        id: 'test-session',
        taskName: 'Test Task',
        duration: 1500,
        startTime: new Date(),
        endTime: new Date(Date.now() + 1500000),
        completed: true,
      };

      // Attempt to save should fail and log error
      await expect(dataService.saveFocusSession(session)).rejects.toThrow('Database not initialized');

      // Check that error was logged
      const logs = logger.readLogs(new Date());
      const errorLogs = logs.filter(log => log.level === 'error');
      expect(errorLogs.length).toBeGreaterThan(0);
    });

    it('should handle validation errors and log them', async () => {
      const invalidSession: any = {
        id: '', // Invalid: empty id
        taskName: 'Test Task',
        duration: 1500,
        startTime: new Date(),
        endTime: new Date(Date.now() + 1500000),
        completed: true,
      };

      await expect(dataService.saveFocusSession(invalidSession)).rejects.toThrow(
        'Focus session id must be a non-empty string'
      );

      // Check that validation error was logged
      const logs = logger.readLogs(new Date());
      const errorLogs = logs.filter(log => log.level === 'error');
      expect(errorLogs.some(log => log.message.includes('validation failed'))).toBe(true);
    });

    it('should recover from corrupted database', async () => {
      // Close the database
      dataService.close();

      // Corrupt the database file
      fs.writeFileSync(testDbPath, 'This is not a valid SQLite database');

      // Create new service and initialize - should handle corruption
      const newService = new DataService(testDbPath);
      await newService.initialize();

      // Should be able to use the new database
      const settings = await newService.loadSettings();
      expect(settings).toBeDefined();

      // Check that error was logged
      const logs = logger.readLogs(new Date());
      const errorLogs = logs.filter(log => log.level === 'error' || log.level === 'warn');
      expect(errorLogs.some(log => 
        log.message.includes('corruption') || log.message.includes('corrupted')
      )).toBe(true);

      newService.close();
    });
  });

  describe('TimerService Error Handling and Logging', () => {
    it('should log errors when starting timer with invalid duration', () => {
      expect(() => timerService.start(0, 'Test Task')).toThrow('Duration must be positive');

      // Check that error was logged
      const logs = logger.readLogs(new Date());
      const errorLogs = logs.filter(log => log.level === 'error');
      expect(errorLogs.some(log => log.message.includes('Failed to start timer'))).toBe(true);
    });

    it('should continue operation after tick error', () => {
      timerService.start(10, 'Test Task');

      // Mock emit to throw error on tick
      const originalEmit = timerService.emit.bind(timerService);
      let tickCount = 0;
      vi.spyOn(timerService, 'emit').mockImplementation((event: string, ...args: any[]) => {
        if (event === 'tick' && tickCount === 0) {
          tickCount++;
          throw new Error('Tick error');
        }
        return originalEmit(event, ...args);
      });

      // Should not crash
      expect(() => {
        vi.advanceTimersByTime(2000);
      }).not.toThrow();

      // Timer should still be running
      expect(timerService.getState().status).toBe('running');
    });

    it('should log warnings for invalid operations', () => {
      // Try to pause when not running
      timerService.pause();

      // Check that warning was logged
      const logs = logger.readLogs(new Date());
      const warnLogs = logs.filter(log => log.level === 'warn');
      expect(warnLogs.some(log => log.message.includes('not running'))).toBe(true);
    });
  });

  describe('WindowManager Error Handling and Logging', () => {
    it('should log errors when window operations fail', async () => {
      // Try to set always-on-top without creating window
      await expect(windowManager.setAlwaysOnTop(true)).rejects.toThrow('Window not created');

      // Check that error was logged
      const logs = logger.readLogs(new Date());
      const errorLogs = logs.filter(log => log.level === 'error');
      expect(errorLogs.some(log => log.message.includes('window not created'))).toBe(true);
    });

    it('should log errors when opacity validation fails', async () => {
      await windowManager.createMainWindow();

      await expect(windowManager.setOpacity(0.2)).rejects.toThrow('Opacity must be between 0.3 and 1.0');

      // Check that error was logged
      const logs = logger.readLogs(new Date());
      const errorLogs = logs.filter(log => log.level === 'error');
      expect(errorLogs.some(log => log.message.includes('Invalid opacity'))).toBe(true);
    });

    it('should handle database errors during window creation', async () => {
      // Close database to cause error
      dataService.close();

      await expect(windowManager.createMainWindow()).rejects.toThrow('Database not initialized');

      // Check that error was logged
      const logs = logger.readLogs(new Date());
      const errorLogs = logs.filter(log => log.level === 'error');
      expect(errorLogs.length).toBeGreaterThan(0);

      // Re-initialize for cleanup
      await dataService.initialize();
    });
  });

  describe('Cross-Module Error Propagation', () => {
    it('should handle errors when saving timer session to database', async () => {
      // Start a timer
      timerService.start(1500, 'Test Task');

      // Close database to cause save to fail
      dataService.close();

      // Try to save session
      const session: FocusSession = {
        id: 'test-session',
        taskName: 'Test Task',
        duration: 1500,
        startTime: new Date(),
        endTime: new Date(Date.now() + 1500000),
        completed: true,
      };

      await expect(dataService.saveFocusSession(session)).rejects.toThrow('Database not initialized');

      // Errors should be logged
      const logs = logger.readLogs(new Date());
      const errorLogs = logs.filter(log => log.level === 'error');
      expect(errorLogs.length).toBeGreaterThan(0);

      // Re-initialize for cleanup
      await dataService.initialize();
    });

    it('should handle errors when loading settings for window', async () => {
      // Close database
      dataService.close();

      // Try to create window - should fail when loading settings
      await expect(windowManager.createMainWindow()).rejects.toThrow('Database not initialized');

      // Re-initialize for cleanup
      await dataService.initialize();
    });

    it('should handle errors when saving window position', async () => {
      await windowManager.createMainWindow();

      // Close database
      dataService.close();

      // Try to save position - should fail
      await expect(windowManager.saveWindowPosition(100, 200)).rejects.toThrow('Database not initialized');

      // Re-initialize for cleanup
      await dataService.initialize();
    });
  });

  describe('Error Recovery Mechanisms', () => {
    it('should allow retry after database error', async () => {
      const session: FocusSession = {
        id: 'test-session',
        taskName: 'Test Task',
        duration: 1500,
        startTime: new Date(),
        endTime: new Date(Date.now() + 1500000),
        completed: true,
      };

      // Close database to cause error
      dataService.close();

      // First attempt should fail
      await expect(dataService.saveFocusSession(session)).rejects.toThrow('Database not initialized');

      // Re-initialize database
      await dataService.initialize();

      // Second attempt should succeed
      await expect(dataService.saveFocusSession(session)).resolves.not.toThrow();

      // Verify session was saved
      const sessions = await dataService.getFocusSessions(new Date());
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('test-session');
    });

    it('should allow window recreation after error', async () => {
      // Mock BrowserWindow to fail first time
      const { BrowserWindow } = await import('electron');
      let callCount = 0;
      vi.mocked(BrowserWindow).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Window creation failed');
        }
        return mockBrowserWindow as any;
      });

      // First attempt should fail
      await expect(windowManager.createMainWindow()).rejects.toThrow('Window creation failed');

      // Second attempt should succeed
      await expect(windowManager.createMainWindow()).resolves.not.toThrow();
    });

    it('should allow timer restart after error', () => {
      // Start timer with invalid duration
      expect(() => timerService.start(0, 'Test Task')).toThrow('Duration must be positive');

      // Should be able to start with valid duration
      expect(() => timerService.start(1500, 'Test Task')).not.toThrow();

      const state = timerService.getState();
      expect(state.status).toBe('running');
      expect(state.totalSeconds).toBe(1500);
    });
  });

  describe('Application Stability Under Errors', () => {
    it('should not crash when multiple errors occur', async () => {
      // Cause multiple errors in sequence
      
      // Timer error
      expect(() => timerService.start(-1, 'Test')).toThrow();

      // Window error
      await expect(windowManager.setAlwaysOnTop(true)).rejects.toThrow();

      // Database error
      dataService.close();
      await expect(dataService.loadSettings()).rejects.toThrow();

      // Re-initialize
      await dataService.initialize();

      // All services should still be usable
      expect(() => timerService.start(10, 'Test')).not.toThrow();
      await expect(windowManager.createMainWindow()).resolves.not.toThrow();
      await expect(dataService.loadSettings()).resolves.not.toThrow();
    });

    it('should maintain data integrity after errors', async () => {
      // Save some data
      const session1: FocusSession = {
        id: 'session-1',
        taskName: 'Task 1',
        duration: 1500,
        startTime: new Date(),
        endTime: new Date(Date.now() + 1500000),
        completed: true,
      };

      await dataService.saveFocusSession(session1);

      // Cause an error with invalid data
      const invalidSession: any = {
        id: 'session-2',
        taskName: 'Task 2',
        duration: -1, // Invalid
        startTime: new Date(),
        endTime: new Date(Date.now() + 1500000),
        completed: true,
      };

      await expect(dataService.saveFocusSession(invalidSession)).rejects.toThrow();

      // Original data should still be intact
      const sessions = await dataService.getFocusSessions(new Date());
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('session-1');
    });

    it('should log all errors for debugging', async () => {
      // Cause various errors
      expect(() => timerService.start(0, 'Test')).toThrow();
      
      await expect(windowManager.setOpacity(2.0)).rejects.toThrow();
      
      dataService.close();
      await expect(dataService.loadSettings()).rejects.toThrow();

      // All errors should be logged
      const logs = logger.readLogs(new Date());
      const errorLogs = logs.filter(log => log.level === 'error');
      
      // Should have at least 3 error logs
      expect(errorLogs.length).toBeGreaterThanOrEqual(3);

      // Re-initialize for cleanup
      await dataService.initialize();
    });
  });

  describe('Error Messages and User Feedback', () => {
    it('should provide descriptive error messages', async () => {
      // Test various error scenarios and verify messages are descriptive

      // Timer error
      try {
        timerService.start(-1, 'Test');
      } catch (error) {
        expect((error as Error).message).toContain('Duration must be positive');
      }

      // Window error
      try {
        await windowManager.setOpacity(0.1);
      } catch (error) {
        expect((error as Error).message).toContain('Opacity must be between 0.3 and 1.0');
      }

      // Database error
      dataService.close();
      try {
        await dataService.loadSettings();
      } catch (error) {
        expect((error as Error).message).toContain('Database not initialized');
      }

      // Re-initialize for cleanup
      await dataService.initialize();
    });

    it('should include error context in logs', async () => {
      // Cause an error with context
      const invalidSession: any = {
        id: '',
        taskName: 'Test',
        duration: 1500,
        startTime: new Date(),
        endTime: new Date(Date.now() + 1500000),
        completed: true,
      };

      await expect(dataService.saveFocusSession(invalidSession)).rejects.toThrow();

      // Check that log includes context
      const logs = logger.readLogs(new Date());
      const errorLogs = logs.filter(log => log.level === 'error');
      
      expect(errorLogs.some(log => 
        log.message.includes('validation') || log.message.includes('id')
      )).toBe(true);
    });
  });
});
