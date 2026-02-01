/**
 * TimerService - Manages Pomodoro timer logic
 * 
 * Responsibilities:
 * - Start, pause, resume, and reset timer
 * - Emit tick events every second
 * - Emit complete event when countdown finishes
 * - Maintain timer state
 */

import { EventEmitter } from 'events';
import { TimerState, validateTaskName } from '../shared/types';
import { getLogger } from './Logger';

export class TimerService extends EventEmitter {
  private state: TimerState;
  private intervalId: NodeJS.Timeout | null = null;
  private lastTickTime: number | null = null;
  private _logger: ReturnType<typeof getLogger> | null = null;

  constructor() {
    super();
    this.state = {
      status: 'idle',
      remainingSeconds: 0,
      totalSeconds: 0,
      taskName: '',
      startTime: null,
    };
  }

  private get logger() {
    if (!this._logger) {
      this._logger = getLogger();
    }
    return this._logger;
  }

  /**
   * Start the timer with specified duration and task name
   * @param duration - Duration in seconds
   * @param taskName - Name of the task
   */
  start(duration: number, taskName: string): void {
    try {
      // Validate duration
      if (duration <= 0) {
        const error = new Error('Duration must be positive');
        this.logger.error('Failed to start timer: invalid duration', error);
        throw error;
      }

      this.logger.info(`Starting timer: ${duration}s, task: ${taskName}`);

      // Stop any existing timer
      this.stop();

      // Initialize state
      this.state = {
        status: 'running',
        remainingSeconds: duration,
        totalSeconds: duration,
        taskName: validateTaskName(taskName),
        startTime: new Date(),
      };

      // Start the interval
      this.lastTickTime = Date.now();
      this.intervalId = setInterval(() => {
        this.tick();
      }, 1000);

      // Emit initial tick
      this.emit('tick', this.state.remainingSeconds);
      
      this.logger.info('Timer started successfully');
    } catch (error) {
      this.logger.error('Failed to start timer', error as Error);
      throw error;
    }
  }

  /**
   * Pause the timer
   */
  pause(): void {
    try {
      if (this.state.status !== 'running') {
        this.logger.warn('Attempted to pause timer that is not running');
        return;
      }

      this.logger.info('Pausing timer');
      this.state.status = 'paused';
      this.stopInterval();
      this.logger.info('Timer paused successfully');
    } catch (error) {
      this.logger.error('Failed to pause timer', error as Error);
      throw error;
    }
  }

  /**
   * Resume the timer
   */
  resume(): void {
    try {
      if (this.state.status !== 'paused') {
        this.logger.warn('Attempted to resume timer that is not paused');
        return;
      }

      this.logger.info('Resuming timer');
      this.state.status = 'running';
      this.lastTickTime = Date.now();
      this.intervalId = setInterval(() => {
        this.tick();
      }, 1000);
      this.logger.info('Timer resumed successfully');
    } catch (error) {
      this.logger.error('Failed to resume timer', error as Error);
      throw error;
    }
  }

  /**
   * Reset the timer to initial state
   */
  reset(): void {
    try {
      this.logger.info('Resetting timer');
      this.stop();
      this.state = {
        status: 'idle',
        remainingSeconds: 0,
        totalSeconds: 0,
        taskName: '',
        startTime: null,
      };
      this.logger.info('Timer reset successfully');
    } catch (error) {
      this.logger.error('Failed to reset timer', error as Error);
      throw error;
    }
  }

  /**
   * Get current timer state
   */
  getState(): TimerState {
    return { ...this.state };
  }

  /**
   * Internal tick handler
   */
  private tick(): void {
    try {
      if (this.state.status !== 'running') {
        return;
      }

      // Calculate elapsed time since last tick
      const now = Date.now();
      const elapsed = this.lastTickTime ? Math.floor((now - this.lastTickTime) / 1000) : 1;
      this.lastTickTime = now;

      // Decrease remaining time
      this.state.remainingSeconds = Math.max(0, this.state.remainingSeconds - elapsed);

      // Emit tick event
      this.emit('tick', this.state.remainingSeconds);

      // Check if timer completed
      if (this.state.remainingSeconds <= 0) {
        this.complete();
      }
    } catch (error) {
      this.logger.error('Error during timer tick', error as Error);
      // Don't throw - we want the timer to continue even if there's an error
    }
  }

  /**
   * Handle timer completion
   */
  private complete(): void {
    try {
      this.logger.info('Timer completed');
      this.stopInterval();
      this.state.status = 'idle';
      this.emit('complete');
    } catch (error) {
      this.logger.error('Error during timer completion', error as Error);
      throw error;
    }
  }

  /**
   * Stop the interval timer
   */
  private stopInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.lastTickTime = null;
  }

  /**
   * Stop the timer completely (used internally)
   */
  private stop(): void {
    this.stopInterval();
  }

  /**
   * Subscribe to tick events
   * @param callback - Callback function that receives remaining seconds
   */
  onTick(callback: (remainingSeconds: number) => void): void {
    this.on('tick', callback);
  }

  /**
   * Subscribe to complete events
   * @param callback - Callback function called when timer completes
   */
  onComplete(callback: () => void): void {
    this.on('complete', callback);
  }

  /**
   * Unsubscribe from tick events
   * @param callback - Callback function to remove
   */
  offTick(callback: (remainingSeconds: number) => void): void {
    this.off('tick', callback);
  }

  /**
   * Unsubscribe from complete events
   * @param callback - Callback function to remove
   */
  offComplete(callback: () => void): void {
    this.off('complete', callback);
  }
}
