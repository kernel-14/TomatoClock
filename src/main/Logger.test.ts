/**
 * Unit tests for Logger service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, LogEntry, LogLevel } from './Logger';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/appdata'),
  },
}));

describe('Logger', () => {
  let testLogsDir: string;
  let logger: Logger;

  beforeEach(() => {
    // Create a temporary test directory
    testLogsDir = path.join(__dirname, '../../test-logs-' + Date.now());
    logger = new Logger(testLogsDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testLogsDir)) {
      const files = fs.readdirSync(testLogsDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testLogsDir, file));
      }
      fs.rmdirSync(testLogsDir);
    }
  });

  describe('initialization', () => {
    it('should create logs directory if it does not exist', () => {
      expect(fs.existsSync(testLogsDir)).toBe(true);
    });

    it('should use default logs directory when not specified', () => {
      const defaultLogger = new Logger();
      expect(defaultLogger.getLogsDir()).toContain('logs');
    });

    it('should handle errors when creating logs directory gracefully', () => {
      // Create a logger with an invalid path that will fail
      // The logger should handle the error gracefully and not throw
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Try to create logger with a path that will fail (e.g., a file instead of directory)
      const invalidPath = path.join(testLogsDir, 'file.txt');
      fs.writeFileSync(invalidPath, 'test', 'utf8');
      
      // Should not throw, just log to console
      expect(() => new Logger(invalidPath)).not.toThrow();
      
      consoleErrorSpy.mockRestore();
      fs.unlinkSync(invalidPath);
    });
  });

  describe('logging methods', () => {
    it('should log info messages', () => {
      logger.info('Test info message');

      const today = new Date();
      const logs = logger.readLogs(today);

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('Test info message');
      expect(logs[0].timestamp).toBeDefined();
      expect(logs[0].error).toBeUndefined();
    });

    it('should log warning messages', () => {
      logger.warn('Test warning message');

      const today = new Date();
      const logs = logger.readLogs(today);

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
      expect(logs[0].message).toBe('Test warning message');
    });

    it('should log error messages', () => {
      logger.error('Test error message');

      const today = new Date();
      const logs = logger.readLogs(today);

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toBe('Test error message');
    });

    it('should include error details when provided', () => {
      const testError = new Error('Test error');
      logger.error('Error occurred', testError);

      const today = new Date();
      const logs = logger.readLogs(today);

      expect(logs).toHaveLength(1);
      expect(logs[0].error).toBeDefined();
      expect(logs[0].error?.message).toBe('Test error');
      expect(logs[0].error?.stack).toBeDefined();
    });

    it('should log multiple messages to the same file', () => {
      logger.info('Message 1');
      logger.warn('Message 2');
      logger.error('Message 3');

      const today = new Date();
      const logs = logger.readLogs(today);

      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('Message 1');
      expect(logs[1].message).toBe('Message 2');
      expect(logs[2].message).toBe('Message 3');
    });
  });

  describe('JSON Lines format', () => {
    it('should write logs in JSON Lines format (one JSON object per line)', () => {
      logger.info('Line 1');
      logger.info('Line 2');
      logger.info('Line 3');

      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      const logFilePath = path.join(testLogsDir, `${dateString}.log`);

      const content = fs.readFileSync(logFilePath, 'utf8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(3);
      
      // Each line should be valid JSON
      lines.forEach((line, index) => {
        expect(() => JSON.parse(line)).not.toThrow();
        const entry = JSON.parse(line);
        expect(entry.message).toBe(`Line ${index + 1}`);
      });
    });
  });

  describe('daily log rotation', () => {
    it('should create a new log file for each day', () => {
      // Log today
      logger.info('Today message');

      // Manually create a log entry for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const year = yesterday.getFullYear();
      const month = String(yesterday.getMonth() + 1).padStart(2, '0');
      const day = String(yesterday.getDate()).padStart(2, '0');
      const yesterdayString = `${year}-${month}-${day}`;
      const yesterdayLogPath = path.join(testLogsDir, `${yesterdayString}.log`);
      
      const yesterdayEntry: LogEntry = {
        timestamp: yesterday.toISOString(),
        level: 'info',
        message: 'Yesterday message',
      };
      fs.writeFileSync(yesterdayLogPath, JSON.stringify(yesterdayEntry) + '\n', 'utf8');

      // Verify both files exist
      const files = fs.readdirSync(testLogsDir);
      expect(files).toHaveLength(2);
      expect(files.some(f => f.startsWith(yesterdayString))).toBe(true);
    });

    it('should use the correct filename format (YYYY-MM-DD.log)', () => {
      logger.info('Test message');

      const files = fs.readdirSync(testLogsDir);
      expect(files).toHaveLength(1);
      
      const filename = files[0];
      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}\.log$/);
    });
  });

  describe('log cleanup', () => {
    it('should delete log files older than 30 days', () => {
      // Create log files for different dates
      const today = new Date();
      const dates = [
        new Date(today.getTime() - 35 * 24 * 60 * 60 * 1000), // 35 days ago (should be deleted)
        new Date(today.getTime() - 31 * 24 * 60 * 60 * 1000), // 31 days ago (should be deleted)
        new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000), // 29 days ago (should be kept)
        new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000), // 15 days ago (should be kept)
        today, // today (should be kept)
      ];

      // Create log files
      for (const date of dates) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        const logPath = path.join(testLogsDir, `${dateString}.log`);
        const entry: LogEntry = {
          timestamp: date.toISOString(),
          level: 'info',
          message: 'Test message',
        };
        fs.writeFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');
      }

      // Create a new logger instance to trigger cleanup
      new Logger(testLogsDir);

      // Check remaining files
      const files = fs.readdirSync(testLogsDir);
      expect(files.length).toBeLessThanOrEqual(3); // Should keep only the last 3 files (29 days, 15 days, today)
    });

    it('should not delete non-log files', () => {
      // Create a non-log file
      const nonLogFile = path.join(testLogsDir, 'readme.txt');
      fs.writeFileSync(nonLogFile, 'This is not a log file', 'utf8');

      // Create an old log file
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);
      const year = oldDate.getFullYear();
      const month = String(oldDate.getMonth() + 1).padStart(2, '0');
      const day = String(oldDate.getDate()).padStart(2, '0');
      const oldDateString = `${year}-${month}-${day}`;
      const oldLogPath = path.join(testLogsDir, `${oldDateString}.log`);
      fs.writeFileSync(oldLogPath, '{"message":"old"}', 'utf8');

      // Create a new logger to trigger cleanup
      new Logger(testLogsDir);

      // Non-log file should still exist
      expect(fs.existsSync(nonLogFile)).toBe(true);
    });

    it('should handle cleanup errors gracefully', () => {
      // Create a log file
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);
      const year = oldDate.getFullYear();
      const month = String(oldDate.getMonth() + 1).padStart(2, '0');
      const day = String(oldDate.getDate()).padStart(2, '0');
      const oldDateString = `${year}-${month}-${day}`;
      const oldLogPath = path.join(testLogsDir, `${oldDateString}.log`);
      fs.writeFileSync(oldLogPath, '{"message":"old"}', 'utf8');

      // Mock console.error to suppress error output
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Make the file read-only to cause deletion to fail on some systems
      // Note: This might not work on all systems, but the logger should handle it gracefully
      try {
        fs.chmodSync(testLogsDir, 0o444);
      } catch (e) {
        // If chmod fails, skip this test
        consoleErrorSpy.mockRestore();
        return;
      }

      // Should not throw, just log to console
      expect(() => new Logger(testLogsDir)).not.toThrow();

      // Restore permissions
      fs.chmodSync(testLogsDir, 0o755);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle write errors gracefully', () => {
      // Create a read-only directory to cause write to fail
      const readOnlyDir = path.join(__dirname, '../../test-logs-readonly-' + Date.now());
      fs.mkdirSync(readOnlyDir, { recursive: true });
      
      const readOnlyLogger = new Logger(readOnlyDir);
      
      // Make directory read-only
      try {
        fs.chmodSync(readOnlyDir, 0o444);
      } catch (e) {
        // If chmod fails, skip this test
        fs.rmdirSync(readOnlyDir);
        return;
      }

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw, just log to console
      expect(() => readOnlyLogger.info('Test message')).not.toThrow();

      consoleErrorSpy.mockRestore();
      
      // Restore permissions and cleanup
      fs.chmodSync(readOnlyDir, 0o755);
      
      // Remove any files that were created
      try {
        const files = fs.readdirSync(readOnlyDir);
        for (const file of files) {
          fs.unlinkSync(path.join(readOnlyDir, file));
        }
      } catch (e) {
        // Ignore errors
      }
      
      fs.rmdirSync(readOnlyDir);
    });

    it('should handle read errors gracefully', () => {
      const today = new Date();
      
      // Try to read from a non-existent file
      const logs = logger.readLogs(today);
      
      // Should return empty array instead of throwing
      expect(logs).toEqual([]);
    });

    it('should skip malformed log lines when reading', () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      const logFilePath = path.join(testLogsDir, `${dateString}.log`);

      // Mock console.error to suppress error output
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Write valid and invalid log lines
      const content = 
        '{"timestamp":"2024-01-01T00:00:00.000Z","level":"info","message":"Valid 1"}\n' +
        'This is not valid JSON\n' +
        '{"timestamp":"2024-01-01T00:00:01.000Z","level":"info","message":"Valid 2"}\n';
      
      fs.writeFileSync(logFilePath, content, 'utf8');

      const logs = logger.readLogs(today);
      
      // Should only return valid entries
      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe('Valid 1');
      expect(logs[1].message).toBe('Valid 2');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('readLogs', () => {
    it('should return empty array for non-existent log file', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const logs = logger.readLogs(futureDate);
      expect(logs).toEqual([]);
    });

    it('should return all log entries for a specific date', () => {
      logger.info('Message 1');
      logger.warn('Message 2');
      logger.error('Message 3');

      const today = new Date();
      const logs = logger.readLogs(today);

      expect(logs).toHaveLength(3);
      expect(logs[0].level).toBe('info');
      expect(logs[1].level).toBe('warn');
      expect(logs[2].level).toBe('error');
    });

    it('should handle empty log files', () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      const logFilePath = path.join(testLogsDir, `${dateString}.log`);

      // Create empty file
      fs.writeFileSync(logFilePath, '', 'utf8');

      const logs = logger.readLogs(today);
      expect(logs).toEqual([]);
    });
  });

  describe('timestamp format', () => {
    it('should use ISO 8601 format for timestamps', () => {
      logger.info('Test message');

      const today = new Date();
      const logs = logger.readLogs(today);

      expect(logs).toHaveLength(1);
      
      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(logs[0].timestamp).toMatch(isoRegex);
    });
  });

  describe('log levels', () => {
    it('should support all three log levels', () => {
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      const today = new Date();
      const logs = logger.readLogs(today);

      const levels = logs.map(log => log.level);
      expect(levels).toContain('info');
      expect(levels).toContain('warn');
      expect(levels).toContain('error');
    });
  });
});
