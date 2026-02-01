/**
 * MainTimer Container Component
 * Integrates timer UI with state management and IPC communication
 */

import React, { useState, useEffect } from 'react';
import { TimerDisplay } from './TimerDisplay';
import { TimerControls } from './TimerControls';
import { TaskInput } from './TaskInput';
import { validateTaskName } from '../../shared/types';
import type { TimerState } from '../../shared/types';

const DEFAULT_DURATION = 25 * 60; // 25 minutes in seconds

export const MainTimer: React.FC = () => {
  const [timerState, setTimerState] = useState<TimerState>({
    status: 'idle',
    remainingSeconds: DEFAULT_DURATION,
    totalSeconds: DEFAULT_DURATION,
    taskName: '',
    startTime: null,
  });
  const [taskInput, setTaskInput] = useState('');
  const [defaultDuration, setDefaultDuration] = useState(DEFAULT_DURATION);

  // Load settings to get default duration
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await window.electronAPI.settings.load();
        setDefaultDuration(settings.defaultDuration);
        // Update timer state if idle
        setTimerState((prev) => {
          if (prev.status === 'idle') {
            return {
              ...prev,
              remainingSeconds: settings.defaultDuration,
              totalSeconds: settings.defaultDuration,
            };
          }
          return prev;
        });
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Load initial timer state
  useEffect(() => {
    const loadTimerState = async () => {
      try {
        const state = await window.electronAPI.timer.getState();
        setTimerState(state);
        if (state.taskName) {
          setTaskInput(state.taskName);
        }
      } catch (error) {
        console.error('Failed to load timer state:', error);
      }
    };

    loadTimerState();
  }, []);

  // Subscribe to timer tick events
  useEffect(() => {
    window.electronAPI.timer.onTick((remainingSeconds: number) => {
      setTimerState((prev) => ({
        ...prev,
        remainingSeconds,
      }));
    });

    window.electronAPI.timer.onComplete(() => {
      setTimerState((prev) => {
        // Save the completed session
        if (prev.startTime && prev.taskName) {
          const session = {
            id: `session-${Date.now()}`,
            taskName: prev.taskName,
            duration: prev.totalSeconds,
            startTime: prev.startTime,
            endTime: new Date(),
            completed: true,
          };
          
          window.electronAPI.data.saveSession(session).catch((error) => {
            console.error('Failed to save session:', error);
          });
        }
        
        return {
          ...prev,
          status: 'idle',
          remainingSeconds: prev.totalSeconds,
        };
      });
      // Show notification (handled by main process)
      console.log('Timer completed!');
    });
  }, []);

  const handleStart = async () => {
    try {
      const validatedTaskName = validateTaskName(taskInput);
      await window.electronAPI.timer.start(defaultDuration, validatedTaskName);
      setTimerState((prev) => ({
        ...prev,
        status: 'running',
        taskName: validatedTaskName,
        totalSeconds: defaultDuration,
        remainingSeconds: defaultDuration,
        startTime: new Date(),
      }));
    } catch (error) {
      console.error('Failed to start timer:', error);
    }
  };

  const handlePause = async () => {
    try {
      await window.electronAPI.timer.pause();
      setTimerState((prev) => ({
        ...prev,
        status: 'paused',
      }));
    } catch (error) {
      console.error('Failed to pause timer:', error);
    }
  };

  const handleResume = async () => {
    try {
      await window.electronAPI.timer.resume();
      setTimerState((prev) => ({
        ...prev,
        status: 'running',
      }));
    } catch (error) {
      console.error('Failed to resume timer:', error);
    }
  };

  const handleReset = async () => {
    try {
      await window.electronAPI.timer.reset();
      setTimerState((prev) => ({
        ...prev,
        status: 'idle',
        remainingSeconds: prev.totalSeconds,
        startTime: null,
      }));
    } catch (error) {
      console.error('Failed to reset timer:', error);
    }
  };

  return (
    <div className="main-timer flex flex-col gap-4 p-6">
      <TaskInput
        value={taskInput}
        onChange={setTaskInput}
        disabled={timerState.status !== 'idle'}
      />
      
      <TimerDisplay
        remainingSeconds={timerState.remainingSeconds}
        status={timerState.status}
      />
      
      <TimerControls
        status={timerState.status}
        onStart={handleStart}
        onPause={handlePause}
        onResume={handleResume}
        onReset={handleReset}
      />
      
      {timerState.status !== 'idle' && timerState.taskName && (
        <div className="text-center text-sm text-gray-600 mt-2">
          Working on: <span className="font-medium">{timerState.taskName}</span>
        </div>
      )}
    </div>
  );
};
