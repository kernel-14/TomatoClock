/**
 * StatisticsModule - Calculates and provides focus statistics
 * 
 * This module handles:
 * - Daily statistics calculation
 * - Today's statistics
 * - Date filtering logic
 * - Time-based sorting
 * 
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */

import { DataService } from './DataService';
import { DailyStats, FocusSession } from '../shared/types';

export class StatisticsModule {
  constructor(private dataService: DataService) {}

  /**
   * Calculate statistics for today
   * Validates: Requirements 4.1, 4.2, 4.3
   */
  async calculateTodayStats(): Promise<DailyStats> {
    const today = new Date();
    return this.calculateDailyStats(today);
  }

  /**
   * Calculate statistics for a specific date
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4
   */
  async calculateDailyStats(date: Date): Promise<DailyStats> {
    // Normalize the date to start of day (midnight) in UTC
    const normalizedDate = this.normalizeDate(date);
    
    // Get all sessions for the specified date
    const sessions = await this.dataService.getFocusSessions(normalizedDate);
    
    // Filter sessions to ensure they match the date (date filtering logic)
    const filteredSessions = this.filterSessionsByDate(sessions, normalizedDate);
    
    // Sort sessions by time (time sorting logic)
    const sortedSessions = this.sortSessionsByTime(filteredSessions);
    
    // Calculate total focus time
    const totalFocusTime = this.calculateTotalFocusTime(sortedSessions);
    
    // Calculate session count
    const sessionCount = sortedSessions.length;
    
    // Calculate completion rate
    const completionRate = this.calculateCompletionRate(sortedSessions);
    
    return {
      date: normalizedDate,
      totalFocusTime,
      sessionCount,
      sessions: sortedSessions,
      completionRate,
    };
  }

  /**
   * Normalize a date to the start of the day (midnight) in UTC
   * This ensures consistent date comparisons across timezones
   */
  private normalizeDate(date: Date): Date {
    // Create a new date in UTC at midnight
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }

  /**
   * Filter sessions by date
   * Only includes sessions where the start time falls on the specified date
   * Validates: Requirements 4.4
   */
  private filterSessionsByDate(sessions: FocusSession[], date: Date): FocusSession[] {
    const targetDateStr = this.getDateString(date);
    
    return sessions.filter((session) => {
      const sessionDateStr = this.getDateString(session.startTime);
      return sessionDateStr === targetDateStr;
    });
  }

  /**
   * Get date string in YYYY-MM-DD format for comparison (UTC)
   */
  private getDateString(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Sort sessions by start time in ascending order
   * Validates: Requirements 4.3
   */
  private sortSessionsByTime(sessions: FocusSession[]): FocusSession[] {
    // Create a copy to avoid mutating the original array
    const sorted = [...sessions];
    
    sorted.sort((a, b) => {
      return a.startTime.getTime() - b.startTime.getTime();
    });
    
    return sorted;
  }

  /**
   * Calculate total focus time from sessions
   * Validates: Requirements 4.1
   */
  private calculateTotalFocusTime(sessions: FocusSession[]): number {
    return sessions.reduce((total, session) => total + session.duration, 0);
  }

  /**
   * Calculate completion rate (ratio of completed sessions to total sessions)
   * Validates: Requirements 4.2
   */
  private calculateCompletionRate(sessions: FocusSession[]): number {
    if (sessions.length === 0) {
      return 0;
    }
    
    const completedCount = sessions.filter((session) => session.completed).length;
    return completedCount / sessions.length;
  }
}
