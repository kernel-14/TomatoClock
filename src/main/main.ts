/**
 * Main process entry point for the Pomodoro Timer application
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { DataService } from './DataService';
import { TimerService } from './TimerService';
import { WindowManager } from './WindowManager';
import { StatisticsModule } from './StatisticsModule';
import { NotificationService } from './NotificationService';
import { TrayManager } from './TrayManager';
import { getLogger } from './Logger';
import * as channels from '../shared/ipc-channels';
import type { FocusSession, AppSettings } from '../shared/types';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Note: electron-squirrel-startup is a CommonJS module, skip for now
// if (require('electron-squirrel-startup')) {
//   app.quit();
// }

// Startup timestamp for performance tracking
const startupTime = Date.now();

// Service instances
let dataService: DataService;
let timerService: TimerService;
let windowManager: WindowManager;
let statisticsModule: StatisticsModule;
let notificationService: NotificationService;
let trayManager: TrayManager;
let logger: ReturnType<typeof getLogger>;

// Initialization state
let isInitialized = false;

/**
 * Log a message with timestamp
 */
function log(level: 'info' | 'error' | 'warn', message: string, error?: Error): void {
  if (!logger) {
    // Fallback to console if logger not initialized yet
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (level === 'error') {
      console.error(logMessage, error || '');
    } else if (level === 'warn') {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }
    return;
  }
  
  if (level === 'error') {
    logger.error(message, error);
  } else if (level === 'warn') {
    logger.warn(message, error);
  } else {
    logger.info(message);
  }
}

/**
 * Show error dialog to user
 */
function showErrorDialog(title: string, message: string): void {
  dialog.showErrorBox(title, message);
}

/**
 * Initialize all services with proper error handling
 */
async function initializeServices(): Promise<void> {
  log('info', 'Starting service initialization...');
  
  try {
    // Step 0: Initialize logger first
    log('info', 'Initializing logger...');
    logger = getLogger();
    log('info', 'Logger initialized successfully');
    
    // Step 1: Initialize data service (most critical)
    log('info', 'Initializing data service...');
    dataService = new DataService();
    await dataService.initialize();
    log('info', 'Data service initialized successfully');

    // Step 2: Initialize timer service
    log('info', 'Initializing timer service...');
    timerService = new TimerService();
    log('info', 'Timer service initialized successfully');

    // Step 3: Initialize window manager
    log('info', 'Initializing window manager...');
    windowManager = new WindowManager(dataService);
    log('info', 'Window manager initialized successfully');

    // Step 4: Initialize statistics module
    log('info', 'Initializing statistics module...');
    statisticsModule = new StatisticsModule(dataService);
    log('info', 'Statistics module initialized successfully');

    // Step 5: Initialize notification service
    log('info', 'Initializing notification service...');
    notificationService = new NotificationService();
    log('info', 'Notification service initialized successfully');

    // Step 6: Initialize tray manager
    log('info', 'Initializing tray manager...');
    trayManager = new TrayManager();
    log('info', 'Tray manager initialized successfully');

    // Set up timer event forwarding to renderer
    setupTimerEvents();
    
    log('info', 'All services initialized successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', `Failed to initialize services: ${errorMessage}`, error as Error);
    throw new Error(`Service initialization failed: ${errorMessage}`);
  }
}

/**
 * Set up timer event handlers
 */
function setupTimerEvents(): void {
  log('info', 'Setting up timer event handlers...');
  
  timerService.onTick((remainingSeconds) => {
    const window = windowManager.getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(channels.TIMER_TICK, remainingSeconds);
    }
  });

  timerService.onComplete(() => {
    const window = windowManager.getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(channels.TIMER_COMPLETE);
    }
    
    // Show notification when timer completes
    try {
      notificationService.showNotification(
        '番茄钟完成',
        '专注时段已完成！休息一下吧。'
      );
      notificationService.playSound('complete');
      log('info', 'Timer completed, notification sent');
    } catch (error) {
      log('error', 'Failed to show completion notification', error as Error);
    }
  });
  
  log('info', 'Timer event handlers set up successfully');
}

/**
 * Set up IPC handlers for communication with renderer process
 */
function setupIpcHandlers(): void {
  log('info', 'Setting up IPC handlers...');
  
  // Timer IPC handlers
  ipcMain.handle(channels.TIMER_START, async (_event, duration: number, taskName: string) => {
    try {
      log('info', `Starting timer: ${duration}s, task: ${taskName}`);
      timerService.start(duration, taskName);
    } catch (error) {
      log('error', 'Failed to start timer', error as Error);
      throw error;
    }
  });

  ipcMain.handle(channels.TIMER_PAUSE, async () => {
    try {
      log('info', 'Pausing timer');
      timerService.pause();
    } catch (error) {
      log('error', 'Failed to pause timer', error as Error);
      throw error;
    }
  });

  ipcMain.handle(channels.TIMER_RESUME, async () => {
    try {
      log('info', 'Resuming timer');
      timerService.resume();
    } catch (error) {
      log('error', 'Failed to resume timer', error as Error);
      throw error;
    }
  });

  ipcMain.handle(channels.TIMER_RESET, async () => {
    try {
      log('info', 'Resetting timer');
      timerService.reset();
    } catch (error) {
      log('error', 'Failed to reset timer', error as Error);
      throw error;
    }
  });

  ipcMain.handle(channels.TIMER_GET_STATE, async () => {
    try {
      return timerService.getState();
    } catch (error) {
      log('error', 'Failed to get timer state', error as Error);
      throw error;
    }
  });

  // Data IPC handlers
  ipcMain.handle(channels.DATA_SAVE_SESSION, async (_event, session: FocusSession) => {
    try {
      log('info', `Saving focus session: ${session.taskName}`);
      await dataService.saveFocusSession(session);
    } catch (error) {
      log('error', 'Failed to save focus session', error as Error);
      throw error;
    }
  });

  ipcMain.handle(channels.DATA_GET_SESSIONS, async (_event, date: Date) => {
    try {
      // Convert date string to Date object if needed
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      log('info', `Getting focus sessions for date: ${dateObj.toISOString()}`);
      return await dataService.getFocusSessions(dateObj);
    } catch (error) {
      log('error', 'Failed to get focus sessions', error as Error);
      throw error;
    }
  });

  ipcMain.handle(
    channels.DATA_GET_STATISTICS,
    async (_event, startDate: Date, endDate: Date) => {
      try {
        // Convert date strings to Date objects if needed
        const startDateObj = typeof startDate === 'string' ? new Date(startDate) : startDate;
        const endDateObj = typeof endDate === 'string' ? new Date(endDate) : endDate;
        log('info', `Getting statistics from ${startDateObj.toISOString()} to ${endDateObj.toISOString()}`);
        return await dataService.getStatistics(startDateObj, endDateObj);
      } catch (error) {
        log('error', 'Failed to get statistics', error as Error);
        throw error;
      }
    }
  );

  // Settings IPC handlers
  ipcMain.handle(channels.SETTINGS_SAVE, async (_event, settings: AppSettings) => {
    try {
      log('info', 'Saving settings');
      await dataService.saveSettings(settings);
    } catch (error) {
      log('error', 'Failed to save settings', error as Error);
      throw error;
    }
  });

  ipcMain.handle(channels.SETTINGS_LOAD, async () => {
    try {
      log('info', 'Loading settings');
      return await dataService.loadSettings();
    } catch (error) {
      log('error', 'Failed to load settings', error as Error);
      throw error;
    }
  });

  // Window IPC handlers
  ipcMain.handle(channels.WINDOW_SET_ALWAYS_ON_TOP, async (_event, enabled: boolean) => {
    try {
      log('info', `Setting always on top: ${enabled}`);
      await windowManager.setAlwaysOnTop(enabled);
    } catch (error) {
      log('error', 'Failed to set always on top', error as Error);
      throw error;
    }
  });

  ipcMain.handle(channels.WINDOW_SET_OPACITY, async (_event, opacity: number) => {
    try {
      log('info', `Setting opacity: ${opacity}`);
      await windowManager.setOpacity(opacity);
    } catch (error) {
      log('error', 'Failed to set opacity', error as Error);
      throw error;
    }
  });

  ipcMain.handle(channels.WINDOW_SAVE_POSITION, async (_event, x: number, y: number) => {
    try {
      log('info', `Saving window position: (${x}, ${y})`);
      await windowManager.saveWindowPosition(x, y);
    } catch (error) {
      log('error', 'Failed to save window position', error as Error);
      throw error;
    }
  });

  ipcMain.handle(channels.WINDOW_GET_POSITION, async () => {
    try {
      return await windowManager.restoreWindowPosition();
    } catch (error) {
      log('error', 'Failed to get window position', error as Error);
      throw error;
    }
  });
  
  log('info', 'IPC handlers set up successfully');
}

/**
 * Create the main window and apply settings
 */
async function createWindow(): Promise<void> {
  log('info', 'Creating main window...');
  
  try {
    // Load settings first
    let settings: AppSettings;
    try {
      settings = await dataService.loadSettings();
      log('info', 'Settings loaded successfully');
    } catch (error) {
      log('warn', 'Failed to load settings, using defaults', error as Error);
      // Use default settings if loading fails
      settings = {
        alwaysOnTop: false,
        windowPosition: { x: -1, y: -1 },
        defaultDuration: 1500,
        soundEnabled: true,
        opacity: 0.8,
      };
    }

    // Create the window
    await windowManager.createMainWindow();
    log('info', 'Main window created');
    
    // Apply settings to window
    try {
      await windowManager.setAlwaysOnTop(settings.alwaysOnTop);
      await windowManager.setOpacity(settings.opacity);
      log('info', 'Window settings applied');
    } catch (error) {
      log('warn', 'Failed to apply some window settings', error as Error);
    }
    
    // Initialize tray
    const window = windowManager.getWindow();
    if (window) {
      try {
        trayManager.createTray(window);
        log('info', 'System tray initialized');
      } catch (error) {
        log('warn', 'Failed to create system tray', error as Error);
      }
    }
    
    log('info', 'Window creation completed');
  } catch (error) {
    log('error', 'Failed to create window', error as Error);
    throw error;
  }
}

/**
 * Main application initialization
 */
async function initializeApp(): Promise<void> {
  const initStartTime = Date.now();
  log('info', '=== Starting Pomodoro Timer Application ===');
  
  try {
    // Step 1: Initialize services
    await initializeServices();
    
    // Step 2: Set up IPC handlers
    setupIpcHandlers();
    
    // Step 3: Create window
    await createWindow();
    
    // Mark as initialized
    isInitialized = true;
    
    // Calculate and log startup time
    const startupDuration = Date.now() - startupTime;
    log('info', `=== Application started successfully in ${startupDuration}ms ===`);
    
    // Check if startup time meets requirement (< 3 seconds)
    if (startupDuration > 3000) {
      log('warn', `Startup time (${startupDuration}ms) exceeds 3 second requirement`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log('error', `Application initialization failed: ${errorMessage}`, error as Error);
    
    // Show error dialog to user
    showErrorDialog(
      '应用启动失败',
      `番茄钟应用无法启动。\n\n错误信息：${errorMessage}\n\n请尝试重新启动应用。如果问题持续存在，请联系技术支持。`
    );
    
    // Clean up and quit
    await cleanupAndQuit();
  }
}

/**
 * Clean up resources and quit application
 */
async function cleanupAndQuit(): Promise<void> {
  log('info', 'Cleaning up resources...');
  
  try {
    if (dataService) {
      dataService.close();
      log('info', 'Data service closed');
    }
  } catch (error) {
    log('error', 'Error during cleanup', error as Error);
  }
  
  log('info', 'Quitting application');
  app.quit();
}

/**
 * Perform shutdown cleanup of all resources
 * This is called during the before-quit event to ensure proper cleanup
 */
async function performShutdownCleanup(): Promise<void> {
  log('info', 'Performing shutdown cleanup...');
  
  const cleanupErrors: Error[] = [];
  
  // Clean up timer service
  if (timerService) {
    try {
      // Stop any running timers
      timerService.reset();
      // Remove all event listeners
      timerService.removeAllListeners();
      log('info', 'Timer service cleaned up');
    } catch (error) {
      log('error', 'Error cleaning up timer service', error as Error);
      cleanupErrors.push(error as Error);
    }
  }
  
  // Clean up tray
  if (trayManager) {
    try {
      trayManager.destroy();
      log('info', 'Tray manager cleaned up');
    } catch (error) {
      log('error', 'Error cleaning up tray manager', error as Error);
      cleanupErrors.push(error as Error);
    }
  }
  
  // Clean up data service (most important - do this last)
  if (dataService) {
    try {
      dataService.close();
      log('info', 'Data service closed');
    } catch (error) {
      log('error', 'Error closing data service', error as Error);
      cleanupErrors.push(error as Error);
    }
  }
  
  // Log summary of cleanup
  if (cleanupErrors.length > 0) {
    log('warn', `Shutdown cleanup completed with ${cleanupErrors.length} error(s)`);
  } else {
    log('info', 'Shutdown cleanup completed successfully');
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  await initializeApp();

  app.on('activate', async () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      if (isInitialized) {
        try {
          await createWindow();
        } catch (error) {
          log('error', 'Failed to recreate window on activate', error as Error);
        }
      }
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanupAndQuit();
  }
});

// Track if we're in the process of quitting
let isQuitting = false;

// Handle app quit - save any pending data
app.on('before-quit', async (event) => {
  log('info', 'Application is quitting...');
  
  // If already quitting, don't prevent default
  if (isQuitting) {
    return;
  }
  
  // Prevent default quit to handle async operations
  event.preventDefault();
  
  try {
    // Step 1: Check if timer is running and show confirmation dialog
    if (timerService && timerService.getState().status === 'running') {
      log('info', 'Timer is running during quit, showing confirmation dialog');
      
      const timerState = timerService.getState();
      const window = windowManager?.getWindow();
      
      if (window && !window.isDestroyed()) {
        const response = await dialog.showMessageBox(window, {
          type: 'warning',
          buttons: ['取消', '放弃并退出'],
          defaultId: 0,
          cancelId: 0,
          title: '确认退出',
          message: '计时器正在运行',
          detail: `当前任务"${timerState.taskName}"还有 ${Math.ceil(timerState.remainingSeconds / 60)} 分钟未完成。\n\n退出将放弃当前专注时段，是否继续？`,
        });
        
        // If user cancels, don't quit
        if (response.response === 0) {
          log('info', 'User cancelled quit operation');
          return;
        }
        
        log('info', 'User confirmed quit, abandoning running timer');
      }
    }
    
    // Step 2: Save window position before closing
    if (windowManager) {
      try {
        const window = windowManager.getWindow();
        if (window && !window.isDestroyed()) {
          const [x, y] = window.getPosition();
          await windowManager.saveWindowPosition(x, y);
          log('info', `Window position saved: (${x}, ${y})`);
        }
      } catch (error) {
        log('error', 'Failed to save window position during shutdown', error as Error);
        // Continue with shutdown even if position save fails
      }
    }
    
    // Step 3: Save any pending timer data (if timer was paused)
    if (timerService) {
      try {
        const timerState = timerService.getState();
        if (timerState.status === 'paused' && timerState.startTime) {
          const elapsedSeconds = timerState.totalSeconds - timerState.remainingSeconds;
          
          // Only save if we have at least 60 seconds (minimum meaningful duration)
          if (elapsedSeconds >= 60) {
            const session: FocusSession = {
              id: `session-${Date.now()}`,
              taskName: timerState.taskName,
              duration: elapsedSeconds,
              startTime: timerState.startTime,
              endTime: new Date(),
              completed: false,
            };
            
            await dataService.saveFocusSession(session);
            log('info', 'Saved incomplete paused session');
          } else {
            log('info', 'Paused session too short to save (< 60 seconds)');
          }
        }
      } catch (error) {
        log('error', 'Failed to save paused session during shutdown', error as Error);
        // Continue with shutdown even if session save fails
      }
    }
    
    // Step 4: Clean up resources
    await performShutdownCleanup();
    
    // Step 5: Mark as quitting and quit for real
    isQuitting = true;
    log('info', 'Shutdown complete, quitting application');
    app.quit();
  } catch (error) {
    log('error', 'Error during shutdown process', error as Error);
    
    // Even if there's an error, try to quit gracefully
    isQuitting = true;
    app.quit();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception', error);
  showErrorDialog(
    '应用错误',
    `应用遇到未处理的错误：\n\n${error.message}\n\n应用将尝试继续运行，但可能不稳定。建议重启应用。`
  );
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  log('error', 'Unhandled promise rejection', error);
});
