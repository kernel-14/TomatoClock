/**
 * Statistics Container Component
 * Integrates statistics UI with data loading and IPC communication
 */

import React, { useState, useEffect } from 'react';
import { StatsHeader } from './StatsHeader';
import { StatsList } from './StatsList';
import type { Statistics as StatisticsData } from '../../shared/types';

export const Statistics: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [statistics, setStatistics] = useState<StatisticsData>({
    totalFocusTime: 0,
    sessionCount: 0,
    sessions: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load statistics when date changes
  useEffect(() => {
    const loadStatistics = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Get start and end of the selected date
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);
        
        const stats = await window.electronAPI.data.getStatistics(startDate, endDate);
        setStatistics(stats);
      } catch (err) {
        console.error('Failed to load statistics:', err);
        setError('Failed to load statistics. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadStatistics();
  }, [selectedDate]);

  const handleDateChange = (newDate: Date) => {
    setSelectedDate(newDate);
  };

  return (
    <div className="statistics-container p-6 space-y-6">
      <div className="text-2xl font-bold text-gray-800 text-center">
        📊 Focus Statistics
      </div>

      <StatsHeader
        totalFocusTime={statistics.totalFocusTime}
        sessionCount={statistics.sessionCount}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
      />

      {loading && (
        <div className="text-center text-gray-500 py-8">
          Loading statistics...
        </div>
      )}

      {error && (
        <div className="text-center text-red-500 py-4 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      {!loading && !error && (
        <StatsList sessions={statistics.sessions} />
      )}
    </div>
  );
};
