/**
 * IPC channel names for communication between main and renderer processes
 */

// Timer channels
export const TIMER_START = 'timer:start';
export const TIMER_PAUSE = 'timer:pause';
export const TIMER_RESUME = 'timer:resume';
export const TIMER_RESET = 'timer:reset';
export const TIMER_GET_STATE = 'timer:get-state';
export const TIMER_TICK = 'timer:tick';
export const TIMER_COMPLETE = 'timer:complete';

// Data channels
export const DATA_SAVE_SESSION = 'data:save-session';
export const DATA_GET_SESSIONS = 'data:get-sessions';
export const DATA_GET_STATISTICS = 'data:get-statistics';

// Settings channels
export const SETTINGS_SAVE = 'settings:save';
export const SETTINGS_LOAD = 'settings:load';

// Window channels
export const WINDOW_SET_ALWAYS_ON_TOP = 'window:set-always-on-top';
export const WINDOW_SET_OPACITY = 'window:set-opacity';
export const WINDOW_SAVE_POSITION = 'window:save-position';
export const WINDOW_GET_POSITION = 'window:get-position';
