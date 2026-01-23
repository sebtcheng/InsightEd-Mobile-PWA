import React, { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { FiChevronLeft, FiChevronRight, FiCalendar } from "react-icons/fi";

const CalendarWidget = ({ projects = [] }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  // --- Calendar Generation ---
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // --- Helpers ---
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const onDateClick = (day) => setSelectedDate(day);

  // Filter projects that have a targetCompletionDate
  const getProjectsForDay = (day) => {
    return projects.filter((p) => {
      if (!p.targetCompletionDate) return false;
      // p.targetCompletionDate is expected to be YYYY-MM-DD or ISO string
      // We parse it safely
      const target = new Date(p.targetCompletionDate);
      return isSameDay(day, target);
    });
  };

  const selectedProjects = selectedDate ? getProjectsForDay(selectedDate) : [];

  // Helper to determine project color status
  const getProjectStatusColor = (p) => {
    // 1. Completed
    if (p.accomplishmentPercentage === 100) return "bg-emerald-500";

    // 2. Delayed (Target Date Passed & Not Completed)
    if (p.targetCompletionDate) {
      const target = new Date(p.targetCompletionDate);
      const now = new Date();
      // Reset hours to compare dates only roughly (optional, but good for visual clarity)
      if (now > target) return "bg-red-500";
    }

    // 3. Ongoing/Default
    return "bg-blue-500";
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <FiCalendar className="text-[#004A99] dark:text-blue-400" />
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500">
            <FiChevronLeft />
          </button>
          <button onClick={nextMonth} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500">
            <FiChevronRight />
          </button>
        </div>
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700 text-center bg-slate-50 dark:bg-slate-900">
        {weekDays.map((day) => (
          <div key={day} className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-900 gap-[1px] border-b border-slate-100 dark:border-slate-700">
        {calendarDays.map((day, idx) => {
          const dayProjects = getProjectsForDay(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const hasEvents = dayProjects.length > 0;

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDateClick(day)}
              className={`
                    relative min-h-[60px] p-1 flex flex-col items-center justify-start cursor-pointer transition-colors
                    ${isCurrentMonth ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600"}
                    ${isSelected ? "bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-[#004A99] dark:ring-blue-400" : "hover:bg-slate-50 dark:hover:bg-slate-700"}
                `}
            >
              <span className={`
                    text-[10px] w-5 h-5 flex items-center justify-center rounded-full mb-1
                    ${isToday ? "bg-[#004A99] text-white font-bold" : "text-slate-600 dark:text-slate-400"}
                 `}>
                {format(day, "d")}
              </span>

              {/* Event Indicators */}
              <div className="flex flex-wrap gap-0.5 justify-center w-full px-0.5">
                {dayProjects.map((p, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${getProjectStatusColor(p)}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-4 pt-2 pb-0 flex items-center justify-end gap-3 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
          <span className="text-[9px] text-slate-400 font-medium">Ongoing</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
          <span className="text-[9px] text-slate-400 font-medium">Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
          <span className="text-[9px] text-slate-400 font-medium">Delayed</span>
        </div>
      </div>

      {/* Selected Date Details */}
      <div className="p-4 min-h-[100px] bg-white dark:bg-slate-800">
        {selectedDate ? (
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Deadlines for {format(selectedDate, "MMM d, yyyy")}
            </h4>
            {selectedProjects.length > 0 ? (
              <div className="space-y-2">
                {selectedProjects.map((p) => (
                  <div key={p.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700">
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${getProjectStatusColor(p)}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{p.schoolName}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{p.projectName}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No project deadlines on this date.</p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs italic">
            Select a date to view project deadlines.
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarWidget;
