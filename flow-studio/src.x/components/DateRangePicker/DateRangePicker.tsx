import React, { useState } from 'react';
import { DateRange } from 'react-date-range';
import { useAppStore } from '../../store/appStore';
import 'react-date-range/dist/styles.css'; // main css file
import 'react-date-range/dist/theme/default.css'; // theme css file
import './DateRangePicker.css'; // custom dark theme

export const DateRangePicker: React.FC = () => {
  const { timeline, setTimelineRange } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);

  // Calculate current end time based on start time and duration
  const getCurrentEndTime = (): Date => {
    const startDate = new Date(timeline.startTime);
    return new Date(startDate.getTime() + timeline.duration * 1000);
  };

  // Initialize date range state
  const [dateRange, setDateRange] = useState([
    {
      startDate: new Date(timeline.startTime),
      endDate: getCurrentEndTime(),
      key: 'selection'
    }
  ]);

  // Format date range for display when collapsed
  const formatDisplayRange = (): string => {
    const start = new Date(timeline.startTime);
    const end = getCurrentEndTime();

    const formatDateTime = (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toISOString().split('T')[1].split('.')[0].substring(0, 5);
      return `${dateStr} ${timeStr}`;
    };

    return `${formatDateTime(start)} — ${formatDateTime(end)}`;
  };

  const handleOpen = () => {
    // Reset date range to current timeline values when opening
    setDateRange([
      {
        startDate: new Date(timeline.startTime),
        endDate: getCurrentEndTime(),
        key: 'selection'
      }
    ]);
    setIsOpen(true);
  };

  const handleSelect = (ranges: any) => {
    setDateRange([ranges.selection]);
  };

  const handleApply = () => {
    const { startDate, endDate } = dateRange[0];

    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    // Set time to start of day (00:00:00) for startDate
    const startDateNormalized = new Date(startDate);
    startDateNormalized.setHours(0, 0, 0, 0);

    // Set time to end of day (23:59:59) for endDate to include the whole day
    const endDateNormalized = new Date(endDate);
    endDateNormalized.setHours(23, 59, 59, 999);

    if (endDateNormalized <= startDateNormalized) {
      alert('End date must be after start date');
      return;
    }

    // Calculate duration in seconds
    const durationSeconds = Math.floor((endDateNormalized.getTime() - startDateNormalized.getTime()) / 1000);

    if (durationSeconds <= 0) {
      alert('Invalid date range. Please select a valid range.');
      return;
    }

    console.log('Applying date range:', {
      start: startDateNormalized.toISOString(),
      end: endDateNormalized.toISOString(),
      durationSeconds
    });

    try {
      // Update timeline range
      setTimelineRange(startDateNormalized.toISOString(), durationSeconds);
      setIsOpen(false);
    } catch (error) {
      console.error('Error setting timeline range:', error);
      alert('Failed to update timeline range. Please try again.');
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Collapsed view - show current range */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 border border-blue-500 rounded transition-colors"
          title="Change time range"
        >
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs text-white font-mono">{formatDisplayRange()}</span>
        </button>
      )}

      {/* Expanded view - date range calendar */}
      {isOpen && (
        <div className="date-range-picker-container absolute right-0 top-0 z-50 rounded shadow-2xl">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">Select Date Range</h3>

            <DateRange
              ranges={dateRange}
              onChange={handleSelect}
              moveRangeOnFirstSelection={false}
              months={2}
              direction="horizontal"
              showDateDisplay={false}
            />

            {/* Action buttons */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-700">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
