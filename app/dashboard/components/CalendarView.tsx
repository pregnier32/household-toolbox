'use client';

import { useState } from 'react';
import { useTheme } from '../../components/AppThemeProvider';

function eventLocationText(event: { location?: unknown; metadata?: { location?: unknown } }): string {
  const direct = typeof event.location === 'string' ? event.location.trim() : '';
  if (direct) return direct;
  const fromMetadata = typeof event.metadata?.location === 'string' ? event.metadata.location.trim() : '';
  return fromMetadata;
}

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
  const [includeLocations, setIncludeLocations] = useState(true);
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

    // Calendar grid settings. Stop the grid above the footer so branding stays clear.
    const margin = 20;
    const gridWidth = pageWidth - (margin * 2);
    const pageHeight = pdf.internal.pageSize.getHeight();
    const footerY = pageHeight - 10;
    const contentBottom = footerY - 4;
    const cellWidth = gridWidth / 7;
    const numRows = Math.ceil((startingDayOfWeek + daysInMonth) / 7);
    const startY = 35;
    const gridTop = startY + 12;
    const gridHeight = contentBottom - gridTop;
    const cellHeight = gridHeight / numRows;

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
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(...colors.eventText);

            const maxWidth = cellWidth - 6;
            const cellBottom = y + cellHeight - 2;
            let eventY = y + 8;

            dayEvents.forEach((event) => {
              const eventTitle = typeof event.title === 'string' && event.title.trim() ? event.title.trim() : 'Event';
              let fontSize = 7;
              let wrapped: string[] = [eventTitle];
              let lineHeight = fontSize * 0.42;
              const room = Math.max(cellBottom - eventY, lineHeight);
              while (fontSize >= 4) {
                pdf.setFontSize(fontSize);
                wrapped = pdf.splitTextToSize(eventTitle, maxWidth) as string[];
                lineHeight = fontSize * 0.42;
                if (wrapped.length * lineHeight <= room) break;
                fontSize -= 0.5;
              }
              pdf.setFontSize(fontSize);
              wrapped.forEach((line: string) => {
                pdf.text(line, x + 3, eventY);
                eventY += lineHeight;
              });
              eventY += 0.5;
            });
          }
        } else {
          // Empty cell after month ends
          pdf.setFillColor(...colors.cellBackground);
          pdf.rect(x, y, cellWidth, cellHeight, 'F');
        }
      }
    }

    const monthEvents: { day: number; event: any }[] = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      getEventsForDay(day).forEach((event) => {
        monthEvents.push({ day, event });
      });
    }

    let yPos = margin;
    const contentWidth = pageWidth - margin * 2;
    const openDetailPage = () => {
      pdf.addPage();
      pdf.setFillColor(...colors.background);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      yPos = margin;
    };

    if (monthEvents.length > 0) {
      openDetailPage();
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...colors.title);
      pdf.text('Events', margin, yPos);
      yPos += 8;

      monthEvents.forEach(({ day, event }) => {
        const title = typeof event.title === 'string' && event.title.trim() ? event.title.trim() : 'Event';
        const heading = `${monthNames[month]} ${day}, ${year}  ·  ${title}`;
        const scheduledDate = event.scheduled_date ? new Date(event.scheduled_date) : null;
        const timeLabel = scheduledDate
          ? scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '';
        const locationLabel = eventLocationText(event);
        const rows: { text: string; fontSize: number; isBold: boolean }[] = [
          { text: heading, fontSize: 11, isBold: true },
        ];
        if (timeLabel) rows.push({ text: `Time: ${timeLabel}`, fontSize: 9, isBold: false });
        if (includeLocations) {
          rows.push({
            text: locationLabel ? `Location: ${locationLabel}` : 'Location:',
            fontSize: 9,
            isBold: false,
          });
        }

        const rowHeight = (row: { text: string; fontSize: number; isBold: boolean }) => {
          pdf.setFontSize(row.fontSize);
          pdf.setFont('helvetica', row.isBold ? 'bold' : 'normal');
          const wrapped = pdf.splitTextToSize(row.text, contentWidth) as string[];
          return wrapped.length * row.fontSize * 0.42 + 2;
        };
        const blockHeight = rows.reduce((sum, row) => sum + rowHeight(row), 2);
        if (yPos > margin && yPos + blockHeight > contentBottom) {
          openDetailPage();
        }

        rows.forEach((row) => {
          pdf.setFontSize(row.fontSize);
          pdf.setFont('helvetica', row.isBold ? 'bold' : 'normal');
          pdf.setTextColor(...(row.isBold ? colors.title : colors.dayText));
          const wrapped = pdf.splitTextToSize(row.text, contentWidth) as string[];
          const lineHeight = row.fontSize * 0.42;
          wrapped.forEach((line: string) => {
            if (yPos + lineHeight > contentBottom) openDetailPage();
            pdf.text(line, margin, yPos);
            yPos += lineHeight;
          });
          yPos += 2;
        });
        yPos += 2;
      });
    }

    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105);
      pdf.text('Household Toolbox', pageWidth / 2, footerY, { align: 'center' });
    }

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
            
            {showPdfPopup && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div
                  className={
                    isLight
                      ? 'w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl'
                      : 'w-full max-w-sm rounded-lg border border-slate-700 bg-slate-800 p-5 shadow-xl'
                  }
                >
                  <h3 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>
                    Export
                  </h3>
                  <label
                    htmlFor="calendar-include-locations"
                    className={`mt-4 flex items-start gap-3 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
                  >
                    <input
                      id="calendar-include-locations"
                      type="checkbox"
                      checked={includeLocations}
                      onChange={(e) => setIncludeLocations(e.target.checked)}
                      className={
                        isLight
                          ? 'mt-0.5 h-4 w-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500'
                          : 'mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'
                      }
                    />
                    <span>Include locations</span>
                  </label>
                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        exportToPDF();
                        setShowPdfPopup(false);
                      }}
                      className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-emerald-600"
                    >
                      Export to PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPdfPopup(false)}
                      className={
                        isLight
                          ? 'rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100'
                          : 'rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700'
                      }
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
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
