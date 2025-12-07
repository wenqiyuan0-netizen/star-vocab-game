import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { withOpacity } from '../../utils/colorUtils';
import { getLocalDateString } from '../../utils/dateUtils';
import { CrayonCheckmark } from './CrayonCheckmark';

export function CalendarModal({ isOpen, onClose, checkInDates = [], todayCompleted = false }) {
  const theme = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCheckmark, setShowCheckmark] = useState(false);

  // Reset animation when opening
  useEffect(() => {
    if (isOpen && todayCompleted) {
      setShowCheckmark(false);
      setTimeout(() => setShowCheckmark(true), 300);
    }
  }, [isOpen, todayCompleted]);

  if (!isOpen) return null;

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() && 
           currentDate.getMonth() === today.getMonth() && 
           currentDate.getFullYear() === today.getFullYear();
  };

  const isCheckedIn = (day) => {
    // Mock logic: check if this date string exists in checkInDates
    // For now, if it's today and todayCompleted is true, return true
    if (isToday(day) && todayCompleted) return true;
    
    // Real logic would compare with checkInDates array
    const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = getLocalDateString(checkDate);
    return checkInDates.includes(dateStr);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content - Solid Glass Style */}
      <div 
        className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl transform transition-all animate-pop-in"
        style={{
          background: `rgba(255, 255, 255, 0.45)`, // Solid frosted glass
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.6)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.15)'
        }}
      >
        {/* Header */}
        <div className="p-6 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-slate-800">
              {monthNames[currentDate.getMonth()]}
            </span>
            <span className="text-lg font-bold text-slate-800/50">
              {currentDate.getFullYear()}
            </span>
          </div>
          <div className="flex gap-1">
            <button 
              onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
              className="p-2 hover:bg-black/5 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-700" />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
              className="p-2 hover:bg-black/5 rounded-full transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-700" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-full transition-colors ml-2"
            >
              <X className="w-5 h-5 text-slate-700" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-6 pt-2">
          {/* Weekdays */}
          <div className="grid grid-cols-7 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-y-4 gap-x-2">
            {/* Empty slots for start of month */}
            {[...Array(firstDay)].map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Actual Days */}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1;
              const checked = isCheckedIn(day);
              const today = isToday(day);

              return (
                <div key={day} className="relative flex justify-center">
                  <div 
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all
                      ${today ? 'ring-2 ring-offset-2 ring-offset-white/50' : ''}
                      ${checked ? 'bg-white/80 shadow-sm' : 'hover:bg-white/30 text-slate-600'}
                    `}
                    style={today ? { borderColor: theme.accent } : {}}
                  >
                    <span style={{ color: checked ? theme.accent : 'inherit' }}>
                      {day}
                    </span>
                    
                    {/* Checkmark Overlay */}
                    {checked && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        {today && showCheckmark ? (
                           <CrayonCheckmark size={40} animate={true} /> 
                        ) : !today ? (
                           <div className="opacity-50 scale-75">
                             <CrayonCheckmark size={40} animate={false} />
                           </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer / Status */}
        <div className="p-6 pt-0 text-center">
          {todayCompleted ? (
            <div className="animate-bounce-subtle">
              <span className="text-sm font-bold" style={{ color: theme.accent }}>
                Excellent! Daily mission accomplished!
              </span>
            </div>
          ) : (
            <span className="text-xs font-bold text-slate-500">
              Keep up the streak!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
