/**
 * DataService - Handles all data persistence operations using SQLite
 * 
 * This service manages:
 * - Database initialization and schema creation
 * - Focus session CRUD operations
 * - Application settings storage
 * - Database version management and migrations
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { FocusSession, AppSettings, Statistics } from '../shared/types';
import { getLogger } from './Logger';

// Helper function to get electron app safely
async function getElectronApp() {
  try {
    const { app } = await import('electron');
    return app;
  } catch (e) {
    return null;
  }
}

export class DataService {
  private db: Database.Database | null = null;
  private dbPath: string;
  private readonly DB_VERSION = 1;
  private _logger: ReturnType<typeof getLogger> | null = null;

  constructor(dbPath?: string) {
    // Use provided path or default to app data directory
    if (dbPath) {
      this.dbPath = dbPath;
    } else {
      const app = getElectronApp();
      if (!app) {
        throw new Error('Database path must be provided when Electron app is not available');
      }
      // Note: getElectronApp is now async, but constructor can't be async
      // This will be handled in initialize()
      this.dbPath = ''; // Will be set in initialize
    }
  }

  private get logger() {
    if (!this._logger) {
      this._logger = getLogger();
    }
    return this._logger;
  }

  /**
   * Initialize the database connection and create schema if needed
   * Validates: Requirements 3.1, 3.2
   */
  async initialize(): Promise<void> {
    try {
      // Set dbPath if not already set
      if (!this.dbPath) {
        const app = await getElectronApp();
        if (!app) {
          throw new Error('Database path must be provided when Electron app is not available');
        }
        
        // Store data in E:\PomodoroData instead of AppData
        const customDataPath = 'E:\\PomodoroData';
        this.dbPath = path.join(customDataPath, 'pomodoro.db');
      }

      this.logger.info(`Initializing database at: ${this.dbPath}`);
      
      // Ensure the directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        this.logger.info(`Created database directory: ${dbDir}`);
      }

      // Open database connection
      this.db = new Database(this.dbPath);
      this.logger.info('Database connection established');
      
      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');
      
      // Create schema if it doesn't exist
      await this.createSchema();
      
      // Check and handle database version
      await this.handleDatabaseVersion();
      
      this.logger.info('Database initialized successfully');
    } catch (error) {
      this.logger.error('Database initialization failed', error as Error);
      
      // If database is corrupted, backup and create new one
      if (this.isCorruptionError(error)) {
        this.logger.warn('Database corruption detected, attempting recovery');
        await this.handleCorruptedDatabase();
      } else {
        throw error;
      }
    }
  }

  /**
   * Create database schema (tables and indexes)
   * Validates: Requirements 3.1, 3.2
   */
  private async createSchema(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Create focus_sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS focus_sessions (
        id TEXT PRIMARY KEY,
        task_name TEXT NOT NULL,
        duration INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        completed INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // Create app_settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create database_info table for version management
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS database_info (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Create indexes for better query performance
    this.createIndexes();
  }

  /**
   * Create database indexes
   * Validates: Requirements 3.1, 3.2
   */
  private createIndexes(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Index on start_time for date-based queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_date 
      ON focus_sessions(date(start_time))
    `);

    // Index on created_at for sorting
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_created 
      ON focus_sessions(created_at)
    `);
  }

  /**
   * Handle database version management and migrations
   * Validates: Requirements 3.1, 3.2
   */
  private async handleDatabaseVersion(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Get current database version
    const versionRow = this.db
      .prepare('SELECT value FROM database_info WHERE key = ?')
      .get('version') as { value: string } | undefined;

    const currentVersion = versionRow ? parseInt(versionRow.value, 10) : 0;

    if (currentVersion === 0) {
      // First time initialization - set version
      this.db
        .prepare('INSERT OR REPLACE INTO database_info (key, value) VALUES (?, ?)')
        .run('version', this.DB_VERSION.toString());
    } else if (currentVersion < this.DB_VERSION) {
      // Run migrations
      await this.runMigrations(currentVersion, this.DB_VERSION);
    }
  }

  /**
   * Run database migrations from one version to another
   * Validates: Requirements 3.1, 3.2
   */
  private async runMigrations(fromVersion: number, toVersion: number): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Future migrations will be added here
    // For now, just update the version
    this.db
      .prepare('UPDATE database_info SET value = ? WHERE key = ?')
      .run(toVersion.toString(), 'version');
  }

  /**
   * Check if an error is a database corruption error
   * Validates: Requirements 3.3
   */
  private isCorruptionError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('corrupt') ||
        message.includes('malformed') ||
        message.includes('database disk image is malformed') ||
        message.includes('not a database') ||
        message.includes('file is not a database')
      );
    }
    // Check for SQLite error codes
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as any).code;
      return code === 'SQLITE_NOTADB' || code === 'SQLITE_CORRUPT';
    }
    return false;
  }

  /**
   * Handle corrupted database by backing up and creating new one
   * Validates: Requirements 3.3
   */
  private async handleCorruptedDatabase(): Promise<void> {
    this.logger.error('Handling corrupted database');
    
    // Close existing connection if any
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    // Backup corrupted database
    const backupPath = `${this.dbPath}.corrupted.${Date.now()}`;
    if (fs.existsSync(this.dbPath)) {
      fs.copyFileSync(this.dbPath, backupPath);
      fs.unlinkSync(this.dbPath);
      this.logger.info(`Corrupted database backed up to: ${backupPath}`);
    }

    // Create new database
    this.db = new Database(this.dbPath);
    this.db.pragma('foreign_keys = ON');
    await this.createSchema();
    await this.handleDatabaseVersion();

    this.logger.info('New database created successfully after corruption recovery');
  }

  /**
   * Validate focus session data
   * Validates: Requirements 2.2, 2.3, 2.4
   */
  private validateFocusSession(session: FocusSession): void {
    // Validate id
    if (!session.id || typeof session.id !== 'string' || session.id.trim() === '') {
      throw new Error('Focus session id must be a non-empty string');
    }

    // Validate taskName
    if (typeof session.taskName !== 'string') {
      throw new Error('Focus session taskName must be a string');
    }

    // Check taskName length (max 100 characters)
    if (session.taskName.length > 100) {
      throw new Error('Focus session taskName must not exceed 100 characters');
    }

    // Validate duration
    if (typeof session.duration !== 'number' || !Number.isInteger(session.duration)) {
      throw new Error('Focus session duration must be an integer');
    }

    if (session.duration < 60 || session.duration > 7200) {
      throw new Error('Focus session duration must be between 60 and 7200 seconds');
    }

    // Validate timestamps
    if (!(session.startTime instanceof Date) || isNaN(session.startTime.getTime())) {
      throw new Error('Focus session startTime must be a valid Date');
    }

    if (!(session.endTime instanceof Date) || isNaN(session.endTime.getTime())) {
      throw new Error('Focus session endTime must be a valid Date');
    }

    // Validate that endTime is after startTime
    if (session.endTime <= session.startTime) {
      throw new Error('Focus session endTime must be after startTime');
    }

    // Validate completed
    if (typeof session.completed !== 'boolean') {
      throw new Error('Focus session completed must be a boolean');
    }
  }

  /**
   * Save a focus session to the database
   * Validates: Requirements 2.2, 2.4, 3.1
   */
  async saveFocusSession(session: FocusSession): Promise<void> {
    if (!this.db) {
      const error = new Error('Database not initialized');
      this.logger.error('Failed to save focus session: database not initialized', error);
      throw error;
    }

    // Validate the session data
    try {
      this.validateFocusSession(session);
    } catch (error) {
      this.logger.error(`Focus session validation failed: ${(error as Error).message}`, error as Error);
      throw error;
    }

    try {
      this.logger.info(`Saving focus session: ${session.id} - ${session.taskName}`);
      
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO focus_sessions 
        (id, task_name, duration, start_time, end_time, completed, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        session.id,
        session.taskName,
        session.duration,
        session.startTime.toISOString(),
        session.endTime.toISOString(),
        session.completed ? 1 : 0,
        new Date().toISOString()
      );
      
      this.logger.info(`Focus session saved successfully: ${session.id}`);
    } catch (error) {
      // Validates: Requirements 3.4
      this.logger.error(`Failed to save focus session: ${session.id}`, error as Error);
      throw new Error(`Failed to save focus session: ${error}`);
    }
  }

  /**
   * Get focus sessions for a specific date
   * Validates: Requirements 3.2
   */
  async getFocusSessions(date: Date): Promise<FocusSession[]> {
    if (!this.db) {
      const error = new Error('Database not initialized');
      this.logger.error('Failed to get focus sessions: database not initialized', error);
      throw error;
    }

    try {
      // Get the date string in YYYY-MM-DD format
      const dateStr = date.toISOString().split('T')[0];
      this.logger.info(`Getting focus sessions for date: ${dateStr}`);

      const stmt = this.db.prepare(`
        SELECT * FROM focus_sessions 
        WHERE date(start_time) = ?
        ORDER BY start_time ASC
      `);

      const rows = stmt.all(dateStr) as Array<{
        id: string;
        task_name: string;
        duration: number;
        start_time: string;
        end_time: string;
        completed: number;
      }>;

      const sessions = rows.map((row) => ({
        id: row.id,
        taskName: row.task_name,
        duration: row.duration,
        startTime: new Date(row.start_time),
        endTime: new Date(row.end_time),
        completed: row.completed === 1,
      }));
      
      this.logger.info(`Retrieved ${sessions.length} focus sessions for ${dateStr}`);
      return sessions;
    } catch (error) {
      this.logger.error('Failed to get focus sessions', error as Error);
      throw new Error(`Failed to get focus sessions: ${error}`);
    }
  }

  /**
   * Get statistics for a date range
   * Validates: Requirements 4.1, 4.2
   */
  async getStatistics(startDate: Date, endDate: Date): Promise<Statistics> {
    if (!this.db) {
      const error = new Error('Database not initialized');
      this.logger.error('Failed to get statistics: database not initialized', error);
      throw error;
    }

    try {
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      this.logger.info(`Getting statistics from ${startStr} to ${endStr}`);

      const stmt = this.db.prepare(`
        SELECT * FROM focus_sessions 
        WHERE date(start_time) >= ? AND date(start_time) <= ?
        ORDER BY start_time ASC
      `);

      const rows = stmt.all(startStr, endStr) as Array<{
        id: string;
        task_name: string;
        duration: number;
        start_time: string;
        end_time: string;
        completed: number;
      }>;

      const sessions: FocusSession[] = rows.map((row) => ({
        id: row.id,
        taskName: row.task_name,
        duration: row.duration,
        startTime: new Date(row.start_time),
        endTime: new Date(row.end_time),
        completed: row.completed === 1,
      }));

      const totalFocusTime = sessions.reduce((sum, s) => sum + s.duration, 0);

      this.logger.info(`Retrieved statistics: ${sessions.length} sessions, ${totalFocusTime}s total`);
      
      return {
        totalFocusTime,
        sessionCount: sessions.length,
        sessions,
      };
    } catch (error) {
      this.logger.error('Failed to get statistics', error as Error);
      throw new Error(`Failed to get statistics: ${error}`);
    }
  }

  /**
   * Save application settings
   * Validates: Requirements 6.3, 6.4
   */
  async saveSettings(settings: AppSettings): Promise<void> {
    if (!this.db) {
      const error = new Error('Database not initialized');
      this.logger.error('Failed to save settings: database not initialized', error);
      throw error;
    }

    try {
      this.logger.info('Saving application settings');
      
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO app_settings (key, value, updated_at)
        VALUES (?, ?, ?)
      `);

      const now = new Date().toISOString();
      const settingsJson = JSON.stringify(settings);

      stmt.run('app_settings', settingsJson, now);
      
      this.logger.info('Application settings saved successfully');
    } catch (error) {
      this.logger.error('Failed to save settings', error as Error);
      throw new Error(`Failed to save settings: ${error}`);
    }
  }

  /**
   * Load application settings
   * Validates: Requirements 6.3, 6.4
   */
  async loadSettings(): Promise<AppSettings> {
    if (!this.db) {
      const error = new Error('Database not initialized');
      this.logger.error('Failed to load settings: database not initialized', error);
      throw error;
    }

    try {
      this.logger.info('Loading application settings');
      
      const stmt = this.db.prepare(`
        SELECT value FROM app_settings WHERE key = ?
      `);

      const row = stmt.get('app_settings') as { value: string } | undefined;

      if (row) {
        const settings = JSON.parse(row.value) as AppSettings;
        this.logger.info('Application settings loaded successfully');
        return settings;
      }

      // Return default settings if none exist
      this.logger.info('No saved settings found, using defaults');
      return this.getDefaultSettings();
    } catch (error) {
      // If there's an error, return default settings
      this.logger.warn('Failed to load settings, using defaults', error as Error);
      return this.getDefaultSettings();
    }
  }

  /**
   * Get default application settings
   */
  private getDefaultSettings(): AppSettings {
    return {
      alwaysOnTop: true,
      windowPosition: { x: 100, y: 100 },
      defaultDuration: 1500, // 25 minutes
      soundEnabled: true,
      opacity: 0.8,
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Get the database instance (for testing purposes)
   */
  getDatabase(): Database.Database | null {
    return this.db;
  }
}
