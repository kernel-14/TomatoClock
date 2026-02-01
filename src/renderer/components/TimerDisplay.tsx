/**
 * TimerDisplay Component
 * Displays the remaining time in MM:SS format with dynamic styling
 */

import React from 'react';

interface TimerDisplayProps {
  remainingSeconds: number;
  status: 'idle' | 'running' | 'paused';
}

/**
 * Formats seconds into MM:SS format
 */
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({ remainingSeconds, status }) => {
  const timeString = formatTime(remainingSeconds);
  
  // Dynamic styling based on status
  const statusColors = {
    idle: 'text-gray-600',
    running: 'text-blue-600',
    paused: 'text-yellow-600',
  };
  
  const statusColor = statusColors[status] || statusColors.idle;
  
  return (
    <div className="timer-display flex flex-col items-center justify-center py-6">
      <div className={`text-6xl font-bold font-mono ${statusColor} transition-colors duration-300`}>
        {timeString}
      </div>
      <div className="text-sm text-gray-500 mt-2 capitalize">
        {status === 'idle' ? 'Ready' : status}
      </div>
    </div>
  );
};

export { formatTime };
