/**
 * TimerControls Component
 * Provides start/pause/resume/reset buttons with state-based enable/disable
 */

import React from 'react';

interface TimerControlsProps {
  status: 'idle' | 'running' | 'paused';
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

export const TimerControls: React.FC<TimerControlsProps> = ({
  status,
  onStart,
  onPause,
  onResume,
  onReset,
}) => {
  const buttonBaseClass =
    'px-6 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  const primaryButtonClass = `${buttonBaseClass} bg-blue-500 hover:bg-blue-600 text-white`;
  const secondaryButtonClass = `${buttonBaseClass} bg-gray-200 hover:bg-gray-300 text-gray-700`;
  const warningButtonClass = `${buttonBaseClass} bg-yellow-500 hover:bg-yellow-600 text-white`;

  return (
    <div className="timer-controls flex gap-3 justify-center items-center py-4">
      {status === 'idle' && (
        <button
          onClick={onStart}
          className={primaryButtonClass}
          aria-label="Start timer"
        >
          ▶ Start
        </button>
      )}
      
      {status === 'running' && (
        <button
          onClick={onPause}
          className={warningButtonClass}
          aria-label="Pause timer"
        >
          ⏸ Pause
        </button>
      )}
      
      {status === 'paused' && (
        <button
          onClick={onResume}
          className={primaryButtonClass}
          aria-label="Resume timer"
        >
          ▶ Resume
        </button>
      )}
      
      {status !== 'idle' && (
        <button
          onClick={onReset}
          className={secondaryButtonClass}
          aria-label="Reset timer"
        >
          ⟲ Reset
        </button>
      )}
    </div>
  );
};
