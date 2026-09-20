'use client';

import { useState } from 'react';
import { useTheme } from '../../components/AppThemeProvider';

export function CalendarView({ 
  calendarEvents = [], 
  onMonthChange 
}: { 
  calendarEvents?: any[];
  onMonthChange?: (month: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const calendarIconButtonClass = isLight
    ? 'p-2 text-slate-700 transition-colors rounded-lg hover:bg-slate-100 hover:text-slate-900'
    : 'p-2 text-slate-400 hover:text-emerald-300 transition-colors rounded-lg hover:bg-slate-800';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [showPdfPopup, setShowPdfPopup] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{ day: number; events: any[] } | null>(null);

  const today = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // Month and year display
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Navigate to previous month
  const goToPreviousMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
    const monthStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    if (onMonthChange) {
      onMonthChange(monthStr);
    }
  };

  // Navigate to next month
  const goToNextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    setCurrentDate(newDate);
    const monthStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    if (onMonthChange) {
      onMonthChange(monthStr);
    }
  };

  // Navigate to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Check if a date is today
  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  // Get events for a specific day
  const getEventsForDay = (day: number) => {
    if (!calendarEvents || calendarEvents.length === 0) return [];
    const dayDate = new Date(year, month, day);
    return calendarEvents.filter((event) => {
      if (!event.scheduled_date) return false;
      const eventDate = new Date(event.scheduled_date);
      return (
        eventDate.getDate() === dayDate.getDate() &&
        eventDate.getMonth() === dayDate.getMonth() &&
        eventDate.getFullYear() === dayDate.getFullYear()
      );
    });
  };

  // Export calendar to PDF
  const exportToPDF = async () => {
    // Dynamic import to avoid SSR issues
    if (typeof window === 'undefined') return;
    
    // Load jsPDF from CDN (works around npm installation issues)
    let jsPDF: any;
    
    // Check if already loaded
    if ((window as any).jspdf?.jsPDF) {
      jsPDF = (window as any).jspdf.jsPDF;
    } else {
      // Load from CDN
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => {
          jsPDF = (window as any).jspdf.jsPDF;
          resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // PDF export is always generated in light mode.
    const colors = {
      background: [255, 255, 255], // white
      title: [15, 23, 42], // slate-950
      dayHeader: [71, 85, 105], // slate-600
      cellBackground: [255, 255, 255], // white
      cellBorder: [226, 232, 240], // slate-200
      dayText: [51, 65, 85], // slate-700
      eventText: [5, 150, 105], // emerald-600
      eventBackground: [16, 185, 129, 0.1], // emerald-500/10
    };

    // Set background
    pdf.setFillColor(...colors.background);
    pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F');

    // Title
    pdf.setTextColor(...colors.title);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    const title = `${monthNames[month]} ${year}`;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const titleWidth = pdf.getTextWidth(title);
    pdf.text(title, (pageWidth - titleWidth) / 2, 20);

    // Calendar grid settings
    const margin = 20;
    const gridWidth = pageWidth - (margin * 2);
    const pageHeight = pdf.internal.pageSize.getHeight();
    const availableHeight = pageHeight - 50; // Leave space for title and margins
    const gridHeight = availableHeight;
    const cellWidth = gridWidth / 7;
    
    // Calculate number of rows needed first
    const numRows = Math.ceil((startingDayOfWeek + daysInMonth) / 7);
    const cellHeight = gridHeight / numRows; // Use actual number of rows
    const startY = 35;

    // Draw day headers
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...colors.dayHeader);
    dayNames.forEach((day, index) => {
      const x = margin + (index * cellWidth) + (cellWidth / 2);
      pdf.text(day, x, startY + 8, { align: 'center' });
    });

    // Draw grid lines and cells
    pdf.setDrawColor(...colors.cellBorder);
    pdf.setLineWidth(0.5);

    // Draw horizontal lines
    for (let row = 0; row <= numRows; row++) {
      const y = startY + 12 + (row * cellHeight);
      pdf.line(margin, y, margin + gridWidth, y);
    }

    // Draw vertical lines
    for (let col = 0; col <= 7; col++) {
      const x = margin + (col * cellWidth);
      pdf.line(x, startY + 12, x, startY + 12 + (numRows * cellHeight));
    }

    // Fill cells and add day numbers with events
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    let dayIndex = 0;
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < 7; col++) {
        const x = margin + (col * cellWidth);
        const y = startY + 12 + (row * cellHeight);

        if (row === 0 && col < startingDayOfWeek) {
          // Empty cell before month starts
          pdf.setFillColor(...colors.cellBackground);
          pdf.rect(x, y, cellWidth, cellHeight, 'F');
        } else if (dayIndex < daysInMonth) {
          dayIndex++;
          
          // Get events for this day
          const dayEvents = getEventsForDay(dayIndex);
          
          // Fill cell background (no special highlighting for today)
          pdf.setFillColor(...colors.cellBackground);
          pdf.rect(x, y, cellWidth, cellHeight, 'F');

          // Draw border
          pdf.setDrawColor(...colors.cellBorder);
          pdf.setLineWidth(0.5);
          pdf.rect(x, y, cellWidth, cellHeight);

          // Add day number
          pdf.setFontSize(10); // Ensure consistent font size for day numbers
          pdf.setTextColor(...colors.dayText);
          pdf.setFont('helvetica', 'normal');
          pdf.text(
            dayIndex.toString(),
            x + 3,
            y + 5
          );

          // Add events if any
          if (dayEvents.length > 0) {
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(...colors.eventText);
            
            // Show up to 5 events, truncate if needed
            const eventsToShow = dayEvents.slice(0, 5);
            let eventY = y + 8;
            
            eventsToShow.forEach((event, idx) => {
              if (eventY + 3 > y + cellHeight - 2) return; // Don't overflow cell
              
              // Truncate event title to fit in cell
              let eventTitle = event.title || 'Event';
              const maxWidth = cellWidth - 6;
              const textWidth = pdf.getTextWidth(eventTitle);
              
              if (textWidth > maxWidth) {
                // Truncate and add ellipsis
                while (pdf.getTextWidth(eventTitle + '...') > maxWidth && eventTitle.length > 0) {
                  eventTitle = eventTitle.slice(0, -1);
                }
                eventTitle = eventTitle + '...';
              }
              
              pdf.text(eventTitle, x + 3, eventY);
              eventY += 3.5;
            });
            
            // If there are more events, show indicator
            if (dayEvents.length > 5) {
              pdf.setFontSize(6);
              pdf.text(`+${dayEvents.length - 5}`, x + 3, eventY);
            }
          }
        } else {
          // Empty cell after month ends
          pdf.setFillColor(...colors.cellBackground);
          pdf.rect(x, y, cellWidth, cellHeight, 'F');
        }
      }
    }

    // Save PDF
    const fileName = `${monthNames[month]}_${year}_Calendar_Light.pdf`;
    pdf.save(fileName);
  };

  // Generate calendar days
  const calendarDays = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  
  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-50">
          {monthNames[month]} {year}
        </h2>
        <div className="flex items-center gap-2">
          {/* Print Icon */}
          <div className="relative">
            <button
              onClick={() => setShowPdfPopup(!showPdfPopup)}
              className={calendarIconButtonClass}
              title="Export to PDF"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
            </button>
            
            {/* PDF Export Popup */}
            {showPdfPopup && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowPdfPopup(false)}
                />
                {/* Popup */}
                <div className="absolute right-0 top-full mt-2 z-20 w-64 rounded-lg border border-slate-700 bg-slate-800 shadow-xl p-4">
                  <div className="space-y-4">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        exportToPDF();
                        setShowPdfPopup(false);
                      }}
                      className="w-full px-4 py-2 text-sm font-medium text-slate-50 bg-emerald-500 hover:bg-emerald-600 transition-colors rounded-lg flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      Export to PDF
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Today Button */}
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-emerald-300 transition-colors rounded-lg hover:bg-slate-800"
          >
            Today
          </button>
          
          {/* Navigation Arrows */}
          <button
            onClick={goToPreviousMonth}
            className="p-2 text-slate-400 hover:text-emerald-300 transition-colors rounded-lg hover:bg-slate-800"
            aria-label="Previous month"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 text-slate-400 hover:text-emerald-300 transition-colors rounded-lg hover:bg-slate-800"
            aria-label="Next month"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day Headers */}
        {dayNames.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-semibold text-slate-400 py-2"
          >
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {calendarDays.map((day, index) => {
          if (day === null) {
            return (
              <div
                key={`empty-${index}`}
                className="aspect-square rounded-lg"
              />
            );
          }

          const isCurrentDay = isToday(day);
          const dayEvents = getEventsForDay(day);

          return (
            <div
              key={day}
              onClick={() => {
                setSelectedDay({ day, events: dayEvents });
              }}
              className={`aspect-square rounded-lg border transition-colors cursor-pointer ${
                dayEvents.length > 0
                  ? 'border-slate-600 text-slate-300 hover:border-emerald-500/50 hover:bg-slate-800/50'
                  : 'border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800/50'
              } flex flex-col items-start justify-start p-2 relative`}
            >
              <span className="text-sm">{day}</span>
              {dayEvents.length > 0 && (
                <div className="mt-1 flex flex-col gap-1 w-full">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className="w-full px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/50 rounded text-xs text-emerald-300 truncate"
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="w-full px-1.5 py-0.5 bg-slate-700/50 border border-slate-600 rounded text-xs text-slate-400 text-center">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Event Details Popup */}
      {selectedDay && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedDay(null)}
          />
          {/* Popup */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-xl p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-100">
                  {monthNames[month]} {selectedDay.day}, {year}
                </h3>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors rounded"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="space-y-3">
                {selectedDay.events.map((event) => {
                  const scheduledDate = event.scheduled_date ? new Date(event.scheduled_date) : null;
                  const subscriptionName =
                    typeof event.metadata?.subscriptionName === 'string'
                      ? event.metadata.subscriptionName.trim()
                      : '';
                  const memberName =
                    typeof event.metadata?.memberName === 'string' ? event.metadata.memberName.trim() : '';
                  const petName =
                    typeof event.metadata?.petName === 'string' ? event.metadata.petName.trim() : '';
                  const headerName =
                    typeof event.metadata?.headerName === 'string' ? event.metadata.headerName.trim() : '';
                  const categoryName =
                    typeof event.metadata?.categoryName === 'string' ? event.metadata.categoryName.trim() : '';
                  const forName = memberName || petName || headerName || categoryName;
                  const detailName = subscriptionName || event.title;
                  const priorityColors = {
                    high: 'text-red-400',
                    medium: 'text-amber-400',
                    low: 'text-slate-400',
                  };
                  return (
                    <div
                      key={event.id}
                      className="p-3 rounded-lg border border-slate-700 bg-slate-800/50"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-slate-100 flex-1 min-w-0 break-words">{detailName}</h4>
                        {event.priority && (
                          <span className={`text-xs font-medium ${priorityColors[event.priority as keyof typeof priorityColors]}`}>
                            {event.priority.toUpperCase()}
                          </span>
                        )}
                      </div>
                      {forName && (
                        <p className="text-xs text-slate-400 mb-2">
                          <span className="text-slate-500">For:</span> {forName}
                        </p>
                      )}
                      {event.description && (
                        <p className="text-xs text-slate-400 mb-2">{event.description}</p>
                      )}
                      {scheduledDate && (
                        <p className="text-xs text-slate-400 mb-2">
                          Time: {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {event.tools && (
                        <p className="text-xs text-slate-400">
                          <span className="text-slate-500">From tool:</span> {event.tools.name || 'Unknown Tool'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
