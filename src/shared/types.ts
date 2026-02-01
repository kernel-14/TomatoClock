/**
 * Shared type definitions for the Pomodoro Timer application
 */

export interface FocusSession {
  id: string;
  taskName: string;
  duration: number; // seconds
  startTime: Date;
  endTime: Date;
  completed: boolean;
}

export interface Statistics {
  totalFocusTime: number; // seconds
  sessionCount: number;
  sessions: FocusSession[];
}

export interface DailyStats {
  date: Date;
  totalFocusTime: number; // seconds
  sessionCount: number;
  sessions: FocusSession[];
  completionRate: number; // 0-1
}

export interface WeeklyStats {
  weekStart: Date;
  weekEnd: Date;
  dailyStats: DailyStats[];
  totalFocusTime: number;
  averageDailyFocusTime: number;
}

export interface AppSettings {
  alwaysOnTop: boolean;
  windowPosition: { x: number; y: number };
  defaultDuration: number; // seconds
  soundEnabled: boolean;
  opacity: number;
}

export interface TimerState {
  status: 'idle' | 'running' | 'paused';
  remainingSeconds: number;
  totalSeconds: number;
  taskName: string;
  startTime: Date | null;
}

/**
 * Validates and normalizes a task name
 * 
 * Rules:
 * - Empty strings or whitespace-only strings are replaced with "未命名任务"
 * - Task names longer than 100 characters are truncated
 * - Leading and trailing whitespace is trimmed
 * 
 * @param taskName - The task name to validate
 * @returns The validated and normalized task name
 */
export function validateTaskName(taskName: string): string {
  // Trim whitespace
  const trimmed = taskName.trim();
  
  // Check if empty or whitespace-only
  if (trimmed.length === 0) {
    return '未命名任务';
  }
  
  // Enforce maximum length of 100 characters
  if (trimmed.length > 100) {
    return trimmed.substring(0, 100);
  }
  
  return trimmed;
}
