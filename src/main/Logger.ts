/**
 * Logger Service
 * 
 * Provides logging functionality with:
 * - JSON Lines format (one JSON object per line)
 * - Daily log rotation (one file per day)
 * - Log level filtering (info, warn, error)
 * - Automatic cleanup (keeps last 30 days)
 * - Proper error handling for file system operations
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  error?: {
    message: string;
    stack?: string;
  };
}

export class Logger {
  private logsDir: string;
  private currentLogFile: string | null = null;
  private currentDate: string | null = null;

  constructor(logsDir?: string) {
    // Store logs in E:\PomodoroData\logs\
    if (logsDir) {
      this.logsDir = logsDir;
    } else {
      try {
        // Use E:\PomodoroData\logs instead of AppData
        this.logsDir = path.join('E:\\PomodoroData', 'logs');
      } catch (error) {
        // Fallback for test environments where app might not be available
        this.logsDir = path.join(process.cwd(), 'logs');
      }
    }
    this.ensureLogsDirExists();
    this.cleanupOldLogs();
  }

  /**
   * Ensure the logs directory exists
   */
  private ensureLogsDirExists(): void {
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (error) {
      // If we can't create the logs directory, log to console as fallback
      // Don't throw - this allows the app to continue even if logging fails
      console.error('Failed to create logs directory:', error);
    }
  }

  /**
   * Get the log file path for the current date
   */
  private getLogFilePath(): string {
    const today = this.getDateString(new Date());
    
    // Check if we need to rotate to a new file
    if (this.currentDate !== today) {
      this.currentDate = today;
      this.currentLogFile = path.join(this.logsDir, `${today}.log`);
    }
    
    return this.currentLogFile!;
  }

  /**
   * Format a date as YYYY-MM-DD
   */
  private getDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Write a log entry to the current log file
   */
  private writeLogEntry(entry: LogEntry): void {
    try {
      const logFilePath = this.getLogFilePath();
      const logLine = JSON.stringify(entry) + '\n';
      
      // Append to the log file
      fs.appendFileSync(logFilePath, logLine, 'utf8');
    } catch (error) {
      // If we can't write to the log file, log to console as fallback
      console.error('Failed to write log entry:', error);
      console.log('Original log entry:', entry);
    }
  }

  /**
   * Create a log entry
   */
  private createLogEntry(level: LogLevel, message: string, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    const entry = this.createLogEntry('info', message);
    this.writeLogEntry(entry);
  }

  /**
   * Log a warning message
   */
  warn(message: string, error?: Error): void {
    const entry = this.createLogEntry('warn', message, error);
    this.writeLogEntry(entry);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error): void {
    const entry = this.createLogEntry('error', message, error);
    this.writeLogEntry(entry);
  }

  /**
   * Clean up log files older than 30 days
   */
  private cleanupOldLogs(): void {
    try {
      if (!fs.existsSync(this.logsDir)) {
        return;
      }

      const files = fs.readdirSync(this.logsDir);
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      for (const file of files) {
        // Only process .log files
        if (!file.endsWith('.log')) {
          continue;
        }

        // Extract date from filename (YYYY-MM-DD.log)
        const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.log$/);
        if (!dateMatch) {
          continue;
        }

        const fileDate = new Date(dateMatch[1]);
        
        // Delete if older than 30 days
        if (fileDate < thirtyDaysAgo) {
          const filePath = path.join(this.logsDir, file);
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            // Log deletion failure but continue with other files
            console.error(`Failed to delete old log file ${file}:`, error);
          }
        }
      }
    } catch (error) {
      // If cleanup fails, log to console but don't throw
      console.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * Get the logs directory path
   */
  getLogsDir(): string {
    return this.logsDir;
  }

  /**
   * Read log entries from a specific date
   * Returns an array of log entries, or empty array if file doesn't exist or can't be read
   */
  readLogs(date: Date): LogEntry[] {
    try {
      const dateString = this.getDateString(date);
      const logFilePath = path.join(this.logsDir, `${dateString}.log`);

      if (!fs.existsSync(logFilePath)) {
        return [];
      }

      const content = fs.readFileSync(logFilePath, 'utf8');
      const lines = content.trim().split('\n');
      
      const entries: LogEntry[] = [];
      for (const line of lines) {
        if (line.trim()) {
          try {
            entries.push(JSON.parse(line));
          } catch (error) {
            // Skip malformed lines
            console.error('Failed to parse log line:', error);
          }
        }
      }

      return entries;
    } catch (error) {
      console.error('Failed to read logs:', error);
      return [];
    }
  }
}

// Export a singleton instance
let loggerInstance: Logger | null = null;

export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

export function setLogger(logger: Logger): void {
  loggerInstance = logger;
}

export function resetLogger(): void {
  loggerInstance = null;
}
