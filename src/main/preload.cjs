/**
 * Preload script for secure IPC communication (CommonJS version)
 */

const { contextBridge, ipcRenderer } = require('electron');

// IPC channel names
const TIMER_START = 'timer:start';
const TIMER_PAUSE = 'timer:pause';
const TIMER_RESUME = 'timer:resume';
const TIMER_RESET = 'timer:reset';
const TIMER_GET_STATE = 'timer:get-state';
const TIMER_TICK = 'timer:tick';
const TIMER_COMPLETE = 'timer:complete';
const DATA_SAVE_SESSION = 'data:save-session';
const DATA_GET_SESSIONS = 'data:get-sessions';
const DATA_GET_STATISTICS = 'data:get-statistics';
const SETTINGS_SAVE = 'settings:save';
const SETTINGS_LOAD = 'settings:load';
const WINDOW_SET_ALWAYS_ON_TOP = 'window:set-always-on-top';
const WINDOW_SET_OPACITY = 'window:set-opacity';
const WINDOW_SAVE_POSITION = 'window:save-position';
const WINDOW_GET_POSITION = 'window:get-position';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Timer API
  timer: {
    start: (duration, taskName) =>
      ipcRenderer.invoke(TIMER_START, duration, taskName),
    pause: () => ipcRenderer.invoke(TIMER_PAUSE),
    resume: () => ipcRenderer.invoke(TIMER_RESUME),
    reset: () => ipcRenderer.invoke(TIMER_RESET),
    getState: () => ipcRenderer.invoke(TIMER_GET_STATE),
    onTick: (callback) => {
      ipcRenderer.on(TIMER_TICK, (_event, remainingSeconds) =>
        callback(remainingSeconds)
      );
    },
    onComplete: (callback) => {
      ipcRenderer.on(TIMER_COMPLETE, () => callback());
    },
  },

  // Data API
  data: {
    saveSession: (session) =>
      ipcRenderer.invoke(DATA_SAVE_SESSION, session),
    getSessions: (date) =>
      ipcRenderer.invoke(DATA_GET_SESSIONS, date),
    getStatistics: (startDate, endDate) =>
      ipcRenderer.invoke(DATA_GET_STATISTICS, startDate, endDate),
  },

  // Settings API
  settings: {
    save: (settings) => ipcRenderer.invoke(SETTINGS_SAVE, settings),
    load: () => ipcRenderer.invoke(SETTINGS_LOAD),
  },

  // Window API
  window: {
    setAlwaysOnTop: (enabled) =>
      ipcRenderer.invoke(WINDOW_SET_ALWAYS_ON_TOP, enabled),
    setOpacity: (opacity) => ipcRenderer.invoke(WINDOW_SET_OPACITY, opacity),
    savePosition: (x, y) =>
      ipcRenderer.invoke(WINDOW_SAVE_POSITION, x, y),
    getPosition: () =>
      ipcRenderer.invoke(WINDOW_GET_POSITION),
  },
});
