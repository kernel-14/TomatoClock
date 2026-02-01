/**
 * TaskInput Component
 * Input field for task name with validation and character count
 */

import React from 'react';
import { validateTaskName } from '../../shared/types';

interface TaskInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
}

export const TaskInput: React.FC<TaskInputProps> = ({
  value,
  onChange,
  disabled = false,
  maxLength = 100,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Only enforce max length, validation happens on submit
    if (newValue.length <= maxLength) {
      onChange(newValue);
    }
  };

  const characterCount = value.length;
  const isNearLimit = characterCount > maxLength * 0.8;

  return (
    <div className="task-input w-full">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder="What are you working on?"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
          aria-label="Task name input"
          maxLength={maxLength}
        />
      </div>
      <div className="flex justify-between items-center mt-1 px-1">
        <div className="text-xs text-gray-500">
          {value.trim().length === 0 && (
            <span>Empty task will be named "未命名任务"</span>
          )}
        </div>
        <div
          className={`text-xs ${
            isNearLimit ? 'text-yellow-600 font-medium' : 'text-gray-400'
          }`}
        >
          {characterCount}/{maxLength}
        </div>
      </div>
    </div>
  );
};

export { validateTaskName };
