/**
 * Preload script for secure IPC communication
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, FocusSession, Statistics, TimerState } from '../shared/types';
import * as channels from '../shared/ipc-channels';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Timer API
  timer: {
    start: (duration: number, taskName: string) =>
      ipcRenderer.invoke(channels.TIMER_START, duration, taskName),
    pause: () => ipcRenderer.invoke(channels.TIMER_PAUSE),
    resume: () => ipcRenderer.invoke(channels.TIMER_RESUME),
    reset: () => ipcRenderer.invoke(channels.TIMER_RESET),
    getState: (): Promise<TimerState> => ipcRenderer.invoke(channels.TIMER_GET_STATE),
    onTick: (callback: (remainingSeconds: number) => void) => {
      ipcRenderer.on(channels.TIMER_TICK, (_event, remainingSeconds) =>
        callback(remainingSeconds)
      );
    },
    onComplete: (callback: () => void) => {
      ipcRenderer.on(channels.TIMER_COMPLETE, () => callback());
    },
  },

  // Data API
  data: {
    saveSession: (session: FocusSession) =>
      ipcRenderer.invoke(channels.DATA_SAVE_SESSION, session),
    getSessions: (date: Date): Promise<FocusSession[]> =>
      ipcRenderer.invoke(channels.DATA_GET_SESSIONS, date),
    getStatistics: (startDate: Date, endDate: Date): Promise<Statistics> =>
      ipcRenderer.invoke(channels.DATA_GET_STATISTICS, startDate, endDate),
  },

  // Settings API
  settings: {
    save: (settings: AppSettings) => ipcRenderer.invoke(channels.SETTINGS_SAVE, settings),
    load: (): Promise<AppSettings> => ipcRenderer.invoke(channels.SETTINGS_LOAD),
  },

  // Window API
  window: {
    setAlwaysOnTop: (enabled: boolean) =>
      ipcRenderer.invoke(channels.WINDOW_SET_ALWAYS_ON_TOP, enabled),
    setOpacity: (opacity: number) => ipcRenderer.invoke(channels.WINDOW_SET_OPACITY, opacity),
    savePosition: (x: number, y: number) =>
      ipcRenderer.invoke(channels.WINDOW_SAVE_POSITION, x, y),
    getPosition: (): Promise<{ x: number; y: number }> =>
      ipcRenderer.invoke(channels.WINDOW_GET_POSITION),
  },
});

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: {
      timer: {
        start: (duration: number, taskName: string) => Promise<void>;
        pause: () => Promise<void>;
        resume: () => Promise<void>;
        reset: () => Promise<void>;
        getState: () => Promise<TimerState>;
        onTick: (callback: (remainingSeconds: number) => void) => void;
        onComplete: (callback: () => void) => void;
      };
      data: {
        saveSession: (session: FocusSession) => Promise<void>;
        getSessions: (date: Date) => Promise<FocusSession[]>;
        getStatistics: (startDate: Date, endDate: Date) => Promise<Statistics>;
      };
      settings: {
        save: (settings: AppSettings) => Promise<void>;
        load: () => Promise<AppSettings>;
      };
      window: {
        setAlwaysOnTop: (enabled: boolean) => Promise<void>;
        setOpacity: (opacity: number) => Promise<void>;
        savePosition: (x: number, y: number) => Promise<void>;
        getPosition: () => Promise<{ x: number; y: number }>;
      };
    };
  }
}
