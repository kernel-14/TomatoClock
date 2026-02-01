/**
 * StatsHeader Component
 * Displays statistics summary and date picker
 */

import React from 'react';

interface StatsHeaderProps {
  totalFocusTime: number; // seconds
  sessionCount: number;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

/**
 * Formats total focus time to human-readable format
 */
function formatTotalTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Formats date to YYYY-MM-DD for input
 */
function formatDateForInput(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats date for display
 */
function formatDateForDisplay(date: Date): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (d.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  
  return d.toLocaleDateString('zh-CN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

export const StatsHeader: React.FC<StatsHeaderProps> = ({
  totalFocusTime,
  sessionCount,
  selectedDate,
  onDateChange,
}) => {
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    onDateChange(newDate);
  };

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const isToday = new Date().toDateString() === selectedDate.toDateString();

  return (
    <div className="stats-header space-y-4">
      {/* Date Picker */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={goToPreviousDay}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          aria-label="Previous day"
        >
          ←
        </button>
        
        <div className="flex-1 flex items-center justify-center gap-2">
          <input
            type="date"
            value={formatDateForInput(selectedDate)}
            onChange={handleDateChange}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Select date"
          />
          {!isToday && (
            <button
              onClick={goToToday}
              className="px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Today
            </button>
          )}
        </div>
        
        <button
          onClick={goToNextDay}
          className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          aria-label="Next day"
        >
          →
        </button>
      </div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Total Focus Time</div>
          <div className="text-2xl font-bold text-blue-600">
            {formatTotalTime(totalFocusTime)}
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-1">Sessions Completed</div>
          <div className="text-2xl font-bold text-green-600">
            {sessionCount}
          </div>
        </div>
      </div>

      {/* Date Display */}
      <div className="text-center text-gray-600">
        {formatDateForDisplay(selectedDate)}
      </div>
    </div>
  );
};

export { formatTotalTime, formatDateForInput, formatDateForDisplay };
