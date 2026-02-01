/**
 * StatsList Component
 * Displays a list of focus session records
 */

import React from 'react';
import type { FocusSession } from '../../shared/types';

interface StatsListProps {
  sessions: FocusSession[];
}

/**
 * Formats duration in seconds to human-readable format
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Formats time from Date object
 */
function formatTime(date: Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export const StatsList: React.FC<StatsListProps> = ({ sessions }) => {
  if (sessions.length === 0) {
    return (
      <div className="stats-list-empty flex flex-col items-center justify-center py-12 text-gray-400">
        <div className="text-4xl mb-2">📊</div>
        <div className="text-lg">暂无数据</div>
        <div className="text-sm mt-1">Start a focus session to see statistics</div>
      </div>
    );
  }

  return (
    <div className="stats-list space-y-2 max-h-96 overflow-y-auto">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="stats-list-item bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-colors"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="font-medium text-gray-800 mb-1">
                {session.taskName}
              </div>
              <div className="text-sm text-gray-500">
                {formatTime(session.startTime)} - {formatTime(session.endTime)}
              </div>
            </div>
            <div className="flex flex-col items-end">
              <div className="text-lg font-semibold text-blue-600">
                {formatDuration(session.duration)}
              </div>
              {session.completed && (
                <div className="text-xs text-green-600 mt-1">✓ Completed</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export { formatDuration, formatTime };
