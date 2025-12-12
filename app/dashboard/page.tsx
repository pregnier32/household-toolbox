'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { UserMenu } from '../components/UserMenu';
import { HelpMenu } from '../components/HelpMenu';
import { AdminMenu } from '../components/AdminMenu';
import { ToolModal } from '../components/ToolModal';
import { DynamicIcon } from '../components/DynamicIcon';
import { PercentOfOrderTool } from '../components/PercentOfOrderTool';
import { PetCareScheduleTool } from '../components/PetCareScheduleTool';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// Calendar Component
function CalendarView({ 
  calendarEvents = [], 
  onMonthChange 
}: { 
  calendarEvents?: any[];
  onMonthChange?: (month: string) => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [pdfTheme, setPdfTheme] = useState<'dark' | 'light'>('dark');
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
  const exportToPDF = async (theme: 'dark' | 'light' = pdfTheme) => {
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

    // Theme colors
    const colors = theme === 'dark' ? {
      background: [15, 23, 42], // slate-950
      title: [241, 245, 249], // slate-50
      dayHeader: [148, 163, 184], // slate-400
      cellBackground: [15, 23, 42], // slate-950
      cellBorder: [51, 65, 85], // slate-700
      dayText: [203, 213, 225], // slate-300
      eventText: [16, 185, 129], // emerald-500
      eventBackground: [16, 185, 129, 0.2], // emerald-500/20
    } : {
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
    const themeSuffix = theme === 'light' ? '_Light' : '';
    const fileName = `${monthNames[month]}_${year}_Calendar${themeSuffix}.pdf`;
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
              className="p-2 text-slate-400 hover:text-emerald-300 transition-colors rounded-lg hover:bg-slate-800"
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
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Theme
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPdfTheme('dark')}
                          className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            pdfTheme === 'dark'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          Dark
                        </button>
                        <button
                          onClick={() => setPdfTheme('light')}
                          className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            pdfTheme === 'light'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          Light
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        exportToPDF(pdfTheme);
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
                if (dayEvents.length > 0) {
                  setSelectedDay({ day, events: dayEvents });
                }
              }}
              className={`aspect-square rounded-lg border transition-colors ${
                dayEvents.length > 0
                  ? 'border-slate-600 text-slate-300 hover:border-emerald-500/50 hover:bg-slate-800/50 cursor-pointer'
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
      {selectedDay && selectedDay.events.length > 0 && (
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
                        <h4 className="text-sm font-semibold text-slate-100 flex-1">{event.title}</h4>
                        {event.priority && (
                          <span className={`text-xs font-medium ${priorityColors[event.priority as keyof typeof priorityColors]}`}>
                            {event.priority.toUpperCase()}
                          </span>
                        )}
                      </div>
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

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  userStatus?: string;
};

type ToolIcon = {
  id: string;
  icon_url: string | null;
  has_icon_data: boolean;
};

type Tool = {
  id: string;
  name: string;
  tool_tip: string | null;
  description: string | null;
  price: number;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  isOwned?: boolean;
  trialStatus?: string | null;
  trialEndDate?: string | null;
  icons: {
    default?: ToolIcon;
    coming_soon?: ToolIcon;
    available?: ToolIcon;
  };
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'tools' | 'dashboard' | 'overview' | 'store'>('dashboard');
  const [dashboardSubTab, setDashboardSubTab] = useState<'overview' | 'calendar'>('overview');
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [openedToolIds, setOpenedToolIds] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeUserCount, setActiveUserCount] = useState<number | null>(null);
  const [guestUserCount, setGuestUserCount] = useState<number | null>(null);
  const [activeTrialToolsCount, setActiveTrialToolsCount] = useState<number | null>(null);
  const [avgToolsPerAdmin, setAvgToolsPerAdmin] = useState<number | null>(null);
  const [usersByMonth, setUsersByMonth] = useState<{ month: string; count: number }[]>([]);
  const [toolsByName, setToolsByName] = useState<{ name: string; value: number }[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number | null>(null);
  const [lifetimeRevenue, setLifetimeRevenue] = useState<number | null>(null);
  const [revenueByDay, setRevenueByDay] = useState<{ date: string; revenue: number }[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [isLoadingActionItems, setIsLoadingActionItems] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [isLoadingCalendarEvents, setIsLoadingCalendarEvents] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [buyMessage, setBuyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedActionItemId, setExpandedActionItemId] = useState<string | null>(null);
  const [completingItemId, setCompletingItemId] = useState<string | null>(null);
  const [completeMessage, setCompleteMessage] = useState<{ type: 'success' | 'error'; text: string; itemId: string } | null>(null);
  const router = useRouter();
  
  const isSuperAdmin = user?.userStatus === 'superadmin';

  useEffect(() => {
    // Fetch user session
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        } else {
          router.push('/');
        }
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  const loadTools = useCallback(() => {
    setIsLoadingTools(true);
    fetch('/api/tools')
      .then((res) => res.json())
      .then((data) => {
        if (data.tools) {
          setTools(data.tools || []);
        }
        setIsLoadingTools(false);
      })
      .catch((error) => {
        console.error('Error fetching tools:', error);
        setIsLoadingTools(false);
      });
  }, []);

  useEffect(() => {
    // Fetch admin stats when Overview tab is active and user is superadmin
    if (activeTab === 'overview' && isSuperAdmin) {
      setIsLoadingStats(true);
      fetch('/api/admin/stats')
        .then((res) => res.json())
        .then((data) => {
          if (data.activeUserCount !== undefined) {
            setActiveUserCount(data.activeUserCount);
          }
          if (data.guestUserCount !== undefined) {
            setGuestUserCount(data.guestUserCount);
          }
          if (data.activeTrialToolsCount !== undefined) {
            setActiveTrialToolsCount(data.activeTrialToolsCount);
          }
          if (data.avgToolsPerAdmin !== undefined) {
            setAvgToolsPerAdmin(data.avgToolsPerAdmin);
          }
          if (data.usersByMonth) {
            setUsersByMonth(data.usersByMonth);
          }
          if (data.toolsByName) {
            setToolsByName(data.toolsByName);
          }
          if (data.monthlyRevenue !== undefined) {
            setMonthlyRevenue(data.monthlyRevenue);
          }
          if (data.lifetimeRevenue !== undefined) {
            setLifetimeRevenue(data.lifetimeRevenue);
          }
          if (data.revenueByDay) {
            setRevenueByDay(data.revenueByDay);
          }
          setIsLoadingStats(false);
        })
        .catch((error) => {
          console.error('Error fetching stats:', error);
          setIsLoadingStats(false);
        });
    }
  }, [activeTab, isSuperAdmin]);

  useEffect(() => {
    // Fetch tools when Tools or Store tab is active
    if (activeTab === 'tools' || activeTab === 'store') {
      loadTools();
    }
  }, [activeTab, loadTools]);

  // Fetch action items when Dashboard Overview tab is active
  const loadActionItems = useCallback(() => {
    setIsLoadingActionItems(true);
    fetch('/api/dashboard/items?type=action_item&status=pending&limit=50')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          console.error('Error from API:', data.error);
          setActionItems([]);
        } else if (data.items) {
          console.log(`Loaded ${data.items.length} action items`);
          setActionItems(data.items || []);
        } else {
          setActionItems([]);
        }
        setIsLoadingActionItems(false);
      })
      .catch((error) => {
        console.error('Error fetching action items:', error);
        setActionItems([]);
        setIsLoadingActionItems(false);
      });
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard' && dashboardSubTab === 'overview') {
      loadActionItems();
    }
  }, [activeTab, dashboardSubTab, loadActionItems]);

  // Fetch calendar events when Calendar tab is active
  const loadCalendarEvents = useCallback((month?: string) => {
    setIsLoadingCalendarEvents(true);
    const monthParam = month || new Date().toISOString().slice(0, 7); // YYYY-MM format
    fetch(`/api/dashboard/items?type=calendar_event&month=${monthParam}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          console.error('Error from API:', data.error);
          setCalendarEvents([]);
        } else if (data.items) {
          console.log(`Loaded ${data.items.length} calendar events for ${monthParam}`);
          setCalendarEvents(data.items || []);
        } else {
          setCalendarEvents([]);
        }
        setIsLoadingCalendarEvents(false);
      })
      .catch((error) => {
        console.error('Error fetching calendar events:', error);
        setCalendarEvents([]);
        setIsLoadingCalendarEvents(false);
      });
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard' && dashboardSubTab === 'calendar') {
      loadCalendarEvents();
    }
  }, [activeTab, dashboardSubTab, loadCalendarEvents]);

  // Handle calendar month changes
  const handleCalendarMonthChange = useCallback((month: string) => {
    loadCalendarEvents(month);
  }, [loadCalendarEvents]);

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/');
  };

  const handleToolClick = (tool: Tool) => {
    // If tool is owned, open it in a sub-tab
    if (tool.isOwned) {
      setActiveTab('tools');
      setActiveToolId(tool.id);
      // Track that this tool has been opened during the session
      setOpenedToolIds(prev => new Set(prev).add(tool.id));
      return;
    }
    // Otherwise, show purchase modal
    setSelectedTool(tool);
    setIsModalOpen(true);
    setBuyMessage(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTool(null);
    setBuyMessage(null);
    setIsBuying(false);
  };

  const handleBuy = async (toolId: string) => {
    setIsBuying(true);
    setBuyMessage(null);

    try {
      const response = await fetch('/api/tools/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toolId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setBuyMessage({ type: 'error', text: data.error || 'Failed to purchase tool' });
        setIsBuying(false);
        return;
      }

      setBuyMessage({ type: 'success', text: data.message || 'Tool purchased successfully!' });
      
      // Refresh tools list after successful purchase
      setTimeout(() => {
        setIsBuying(false);
        loadTools();
        handleCloseModal();
      }, 1500);
    } catch (error) {
      console.error('Error purchasing tool:', error);
      setBuyMessage({ type: 'error', text: 'An error occurred while purchasing the tool' });
      setIsBuying(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center relative">
            <Image
              src="/images/logo/Logo_Side_White.png"
              alt="Household Toolbox"
              width={200}
              height={40}
              className="h-auto"
              priority
            />
          </div>

          <div className="flex items-center gap-3">
            {isSuperAdmin && <AdminMenu />}
            <HelpMenu />
            <UserMenu
              userName={`${user.firstName} ${user.lastName || ''}`.trim()}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/30">
        <div className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'border-b-2 border-emerald-500 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Overview
            </button>
          )}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'border-b-2 border-emerald-500 text-emerald-300'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'tools'
                ? 'border-b-2 border-emerald-500 text-emerald-300'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Tool Box
          </button>
          <button
            onClick={() => setActiveTab('store')}
            className={`px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'store'
                ? 'border-b-2 border-emerald-500 text-emerald-300'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Store
          </button>
        </div>
      </div>

      {/* Dashboard Sub-tabs */}
      {activeTab === 'dashboard' && (
        <div className="border-b border-slate-800 bg-slate-900/20">
          <div className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setDashboardSubTab('overview')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                dashboardSubTab === 'overview'
                  ? 'border-b-2 border-emerald-500 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setDashboardSubTab('calendar')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                dashboardSubTab === 'calendar'
                  ? 'border-b-2 border-emerald-500 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Calendar
            </button>
          </div>
        </div>
      )}

      {/* Tools Sub-tabs */}
      {activeTab === 'tools' && openedToolIds.size > 0 && (
        <div className="border-b border-slate-800 bg-slate-900/20">
          <div className="mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setActiveToolId(null)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeToolId === null
                  ? 'border-b-2 border-emerald-500 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              All Tools
            </button>
            {tools
              .filter(t => t.isOwned === true && openedToolIds.has(t.id))
              .map((tool) => (
                <div
                  key={tool.id}
                  className="group relative"
                >
                  <button
                    onClick={() => setActiveToolId(tool.id)}
                    className={`px-6 py-3 text-sm font-medium transition-colors ${
                      activeToolId === tool.id
                        ? 'border-b-2 border-emerald-500 text-emerald-300'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {tool.name}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Remove tool from opened tools
                      setOpenedToolIds(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(tool.id);
                        return newSet;
                      });
                      // If this was the active tool, switch back to All Tools
                      if (activeToolId === tool.id) {
                        setActiveToolId(null);
                      }
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                    aria-label={`Close ${tool.name}`}
                  >
                    <svg
                      className="h-4 w-4"
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
              ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && (
          <div>
            {dashboardSubTab === 'overview' && (
              <div>
                <h1 className="text-2xl font-semibold text-slate-50 mb-4">Dashboard</h1>
                <p className="text-slate-400 mb-6">
                  Welcome to your Household Toolbox dashboard. This is your central hub for managing your household.
                </p>
                <div className="w-1/2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4">Upcoming Action Items</h3>
                    {isLoadingActionItems ? (
                      <p className="text-sm text-slate-400">Loading action items...</p>
                    ) : actionItems.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        No upcoming action items. Items from your tools will appear here.
                      </p>
                    ) : (
                      <div>
                        {/* Header row */}
                        <div className="grid grid-cols-[2fr_1fr_auto] gap-4 mb-3 pb-3 border-b border-slate-700">
                          <div className="text-xs font-semibold text-slate-400 uppercase">Action Item</div>
                          <div className="text-xs font-semibold text-slate-400 uppercase">Due Date</div>
                          <div className="w-20"></div>
                        </div>
                        
                        {/* Action items */}
                        <div className="space-y-3">
                          {actionItems.map((item) => {
                            const dueDate = item.due_date ? new Date(item.due_date) : null;
                            const isOverdue = dueDate && dueDate < new Date() && item.status === 'pending';
                            const isExpanded = expandedActionItemId === item.id;
                            const priorityBgColors = {
                              high: 'bg-red-500/10 border-red-500/50',
                              medium: 'bg-amber-500/10 border-amber-500/50',
                              low: 'bg-slate-800/50 border-slate-700',
                            };
                            
                            return (
                              <div
                                key={item.id}
                                className={`rounded-lg border transition-colors ${
                                  isOverdue
                                    ? 'border-red-500/50 bg-red-500/10'
                                    : priorityBgColors[item.priority as keyof typeof priorityBgColors] || 'border-slate-700 bg-slate-800/50'
                                } ${isExpanded ? 'p-4' : 'p-3'}`}
                              >
                                {/* Single line view */}
                                <div className="grid grid-cols-[2fr_1fr_auto] gap-4 items-center">
                                  <div 
                                    className="flex items-center gap-2 min-w-0 cursor-pointer"
                                    onClick={() => {
                                      setExpandedActionItemId(isExpanded ? null : item.id);
                                    }}
                                  >
                                    <h4 className="text-sm font-semibold text-slate-100">{item.title}</h4>
                                    <svg
                                      className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                  </div>
                                  <div className="text-sm text-slate-300">
                                    {dueDate ? dueDate.toLocaleDateString() : '—'}
                                    {isOverdue && (
                                      <span className="ml-2 text-xs text-red-400">(Overdue)</span>
                                    )}
                                  </div>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setCompletingItemId(item.id);
                                      setCompleteMessage(null);
                                      try {
                                        const response = await fetch(`/api/dashboard/items/${item.id}`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ status: 'completed' }),
                                        });
                                        if (response.ok) {
                                          setCompleteMessage({ type: 'success', text: 'Item completed!', itemId: item.id });
                                          setTimeout(() => {
                                            loadActionItems();
                                            setExpandedActionItemId(null);
                                            setCompletingItemId(null);
                                            setCompleteMessage(null);
                                          }, 1000);
                                        } else {
                                          const data = await response.json();
                                          setCompleteMessage({ 
                                            type: 'error', 
                                            text: data.error || 'Failed to complete item', 
                                            itemId: item.id 
                                          });
                                          setCompletingItemId(null);
                                        }
                                      } catch (error) {
                                        console.error('Error completing item:', error);
                                        setCompleteMessage({ 
                                          type: 'error', 
                                          text: 'An error occurred', 
                                          itemId: item.id 
                                        });
                                        setCompletingItemId(null);
                                      }
                                    }}
                                    disabled={completingItemId === item.id}
                                    className={`px-4 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap ${
                                      completingItemId === item.id
                                        ? 'text-slate-500 cursor-not-allowed bg-slate-700/50'
                                        : 'text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/20'
                                    }`}
                                    title="Mark as completed"
                                  >
                                    {completingItemId === item.id ? 'Completing...' : 'Complete'}
                                  </button>
                                </div>
                                
                                {/* Expanded details */}
                                {isExpanded && (
                                  <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2">
                                    {completeMessage && completeMessage.itemId === item.id && (
                                      <div className={`p-2 rounded text-xs ${
                                        completeMessage.type === 'success'
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                                          : 'bg-red-500/20 text-red-300 border border-red-500/50'
                                      }`}>
                                        {completeMessage.text}
                                      </div>
                                    )}
                                    {item.tools && (
                                      <p className="text-sm text-slate-300">
                                        <span className="text-slate-400">From tool:</span> {item.tools.name || 'Unknown Tool'}
                                      </p>
                                    )}
                                    {item.description && (
                                      <p className="text-sm text-slate-400">{item.description}</p>
                                    )}
                                    {item.priority && (
                                      <p className="text-sm text-slate-400">
                                        Priority: {item.priority.toUpperCase()}
                                      </p>
                                    )}
                                    {item.metadata && typeof item.metadata === 'object' && item.metadata.notes && item.metadata.notes.trim() && (
                                      <p className="text-sm text-slate-300 italic mt-2">
                                        <span className="text-slate-400">Notes:</span> "{item.metadata.notes}"
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {dashboardSubTab === 'calendar' && (
              <div>
                <h1 className="text-2xl font-semibold text-slate-50 mb-4">Calendar</h1>
                <p className="text-slate-400 mb-6">
                  View and manage your household calendar events and schedules.
                </p>
                <CalendarView 
                  calendarEvents={calendarEvents} 
                  onMonthChange={handleCalendarMonthChange}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'tools' && (
          <div>
            {activeToolId === null ? (
              <>
                <h1 className="text-2xl font-semibold text-slate-50 mb-4">Your Tool Box</h1>
                {isLoadingTools ? (
                  <p className="text-slate-400">Loading tools...</p>
                ) : (
                  <div className="space-y-8">
                    {/* Active Tools - Tools the user owns */}
                    <div>
                      <h2 className="text-lg font-semibold text-slate-100 mb-4">Active</h2>
                      {tools.filter(t => t.isOwned === true).length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
                          {tools
                            .filter(t => t.isOwned === true)
                            .map((tool) => {
                              // Use default icon first, then fallback to available/coming_soon for backward compatibility
                              const icon = tool.icons.default || tool.icons.available || tool.icons.coming_soon;
                              // Get icon name/URL - if it's a URL (starts with http or /), use it, otherwise use icon name
                              // Handle empty strings by checking for truthy and non-empty values
                              const iconUrl = icon?.icon_url && icon.icon_url.trim() !== '' ? icon.icon_url : null;
                              const iconSrc = iconUrl || (icon?.id ? `/api/tools/icons/${icon.id}` : null);
                              return (
                                <div 
                                  key={tool.id} 
                                  onClick={() => handleToolClick(tool)}
                                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition-colors cursor-pointer hover:border-emerald-500/50"
                                >
                                  {iconSrc && (
                                    <div className="mb-3 flex items-center justify-center">
                                      <DynamicIcon 
                                        iconName={iconSrc} 
                                        size={60} 
                                        className="text-slate-300"
                                      />
                                    </div>
                                  )}
                                  <div className="flex flex-col items-center">
                                    <h3 className="text-sm font-semibold text-slate-100 mb-1 text-center">{tool.name}</h3>
                                    {tool.trialStatus === 'trial' && (
                                      <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300 mb-1">
                                        Trial
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm">No active tools at this time.</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // Individual tool view
              <>
                {tools
                  .filter(t => t.id === activeToolId)
                  .map((tool) => (
                    <div key={tool.id}>
                      {tool.name === 'Percent of my Order' ? (
                        <PercentOfOrderTool />
                      ) : tool.name === 'Pet Care Schedule' ? (
                        <PetCareScheduleTool toolId={tool.id} />
                      ) : (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                          <h2 className="text-xl font-semibold text-slate-50 mb-4">{tool.name}</h2>
                          <p className="text-slate-400">{tool.description || 'No description available.'}</p>
                        </div>
                      )}
                    </div>
                  ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'store' && (
          <div>
            {activeToolId === null ? (
              <>
                <h1 className="text-2xl font-semibold text-slate-50 mb-4">Shop Household Tools</h1>
                {isLoadingTools ? (
                  <p className="text-slate-400">Loading tools...</p>
                ) : (
                  <div className="space-y-8">
                    {/* Available Tools - Tools available for purchase that user doesn't own */}
                    <div>
                      <h2 className="text-lg font-semibold text-slate-100 mb-4">Available</h2>
                      {tools.filter(t => t.status === 'available' && !t.isOwned).length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
                          {tools
                            .filter(t => t.status === 'available' && !t.isOwned)
                            .map((tool) => {
                              // Use default icon first, then fallback to available/coming_soon for backward compatibility
                              const icon = tool.icons.default || tool.icons.available || tool.icons.coming_soon;
                              // Get icon name/URL - if it's a URL (starts with http or /), use it, otherwise use icon name
                              // Handle empty strings by checking for truthy and non-empty values
                              const iconUrl = icon?.icon_url && icon.icon_url.trim() !== '' ? icon.icon_url : null;
                              const iconSrc = iconUrl || (icon?.id ? `/api/tools/icons/${icon.id}` : null);
                              return (
                                <div 
                                  key={tool.id} 
                                  onClick={() => handleToolClick(tool)}
                                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-emerald-500/50 transition-colors cursor-pointer"
                                >
                                  {iconSrc && (
                                    <div className="mb-3 flex items-center justify-center">
                                      <DynamicIcon 
                                        iconName={iconSrc} 
                                        size={60} 
                                        className="text-slate-300"
                                      />
                                    </div>
                                  )}
                                  <h3 className="text-sm font-semibold text-slate-100 mb-1 text-center">{tool.name}</h3>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm">No available tools at this time.</p>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-800 my-6"></div>

                    {/* Coming Soon Tools */}
                    <div>
                      <h2 className="text-lg font-semibold text-slate-100 mb-4">Coming Soon</h2>
                      {tools.filter(t => t.status === 'coming_soon').length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
                          {tools
                            .filter(t => t.status === 'coming_soon')
                            .map((tool) => {
                              // Use default icon first, then fallback to coming_soon/available for backward compatibility
                              const icon = tool.icons.default || tool.icons.coming_soon || tool.icons.available;
                              // Get icon name/URL - if it's a URL (starts with http or /), use it, otherwise use icon name
                              // Handle empty strings by checking for truthy and non-empty values
                              const iconUrl = icon?.icon_url && icon.icon_url.trim() !== '' ? icon.icon_url : null;
                              const iconSrc = iconUrl || (icon?.id ? `/api/tools/icons/${icon.id}` : null);
                              return (
                                <div 
                                  key={tool.id} 
                                  onClick={() => handleToolClick(tool)}
                                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-emerald-500/50 transition-colors cursor-pointer"
                                >
                                  {iconSrc && (
                                    <div className="mb-3 flex items-center justify-center">
                                      <DynamicIcon 
                                        iconName={iconSrc} 
                                        size={60} 
                                        className="text-slate-300"
                                      />
                                    </div>
                                  )}
                                  <h3 className="text-sm font-semibold text-slate-100 mb-1 text-center">{tool.name}</h3>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm">No tools coming soon at this time.</p>
                      )}
                    </div>

                    {/* Custom Tools - Only visible to superadmins */}
                    {isSuperAdmin && (
                      <>
                        {/* Divider */}
                        <div className="border-t border-slate-800 my-6"></div>

                        {/* Custom Tools */}
                        <div>
                          <h2 className="text-lg font-semibold text-slate-100 mb-4">Custom</h2>
                          {tools.filter(t => t.status === 'custom').length > 0 ? (
                            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
                              {tools
                                .filter(t => t.status === 'custom')
                                .map((tool) => {
                                  // Use default icon first, then fallback to available/coming_soon for backward compatibility
                                  const icon = tool.icons.default || tool.icons.available || tool.icons.coming_soon;
                                  // Get icon name/URL - if it's a URL (starts with http or /), use it, otherwise use icon name
                                  // Handle empty strings by checking for truthy and non-empty values
                                  const iconUrl = icon?.icon_url && icon.icon_url.trim() !== '' ? icon.icon_url : null;
                                  const iconSrc = iconUrl || (icon?.id ? `/api/tools/icons/${icon.id}` : null);
                                  return (
                                    <div 
                                      key={tool.id} 
                                      onClick={() => handleToolClick(tool)}
                                      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-emerald-500/50 transition-colors cursor-pointer"
                                    >
                                      {iconSrc && (
                                        <div className="mb-3 flex items-center justify-center">
                                          <DynamicIcon 
                                            iconName={iconSrc} 
                                            size={60} 
                                            className="text-slate-300"
                                          />
                                        </div>
                                      )}
                                      <h3 className="text-sm font-semibold text-slate-100 mb-1 text-center">{tool.name}</h3>
                                    </div>
                                  );
                                })}
                            </div>
                          ) : (
                            <p className="text-slate-400 text-sm">No custom tools at this time.</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              // Individual tool view
              <>
                {tools
                  .filter(t => t.id === activeToolId)
                  .map((tool) => (
                    <div key={tool.id}>
                      {tool.name === 'Percent of my Order' ? (
                        <PercentOfOrderTool />
                      ) : tool.name === 'Pet Care Schedule' ? (
                        <PetCareScheduleTool toolId={tool.id} />
                      ) : (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                          <h2 className="text-xl font-semibold text-slate-50 mb-4">{tool.name}</h2>
                          <p className="text-slate-400">{tool.description || 'No description available.'}</p>
                        </div>
                      )}
                    </div>
                  ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'overview' && isSuperAdmin && (
          <div>
            <h1 className="text-2xl font-semibold text-slate-50 mb-4">System Stats</h1>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <p className="text-2xl mb-2">👥</p>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Active Users</h3>
                {isLoadingStats ? (
                  <p className="text-xs text-slate-400">Loading...</p>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-emerald-400 mb-1">
                      {activeUserCount !== null ? activeUserCount : '—'}
                    </p>
                    <p className="text-xs text-slate-400 mb-4">
                      Users with active status
                    </p>
                    <div className="pt-3 border-t border-slate-800">
                      <p className="text-2xl font-bold text-purple-400 mb-1">
                        {guestUserCount !== null ? guestUserCount : '—'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Guest users
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Users Created by Month</h3>
                {isLoadingStats ? (
                  <p className="text-xs text-slate-400">Loading...</p>
                ) : usersByMonth.length > 0 ? (
                  <div className="mt-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={usersByMonth}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fill: '#94a3b8', fontSize: 10 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          tick={{ fill: '#94a3b8', fontSize: 10 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#e2e8f0'
                          }}
                          labelStyle={{ color: '#94a3b8' }}
                        />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No data available</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <p className="text-2xl mb-2">🔧</p>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Active & Trial Tools</h3>
                {isLoadingStats ? (
                  <p className="text-xs text-slate-400">Loading...</p>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-emerald-400 mb-1">
                      {activeTrialToolsCount !== null ? activeTrialToolsCount : '—'}
                    </p>
                    <p className="text-xs text-slate-400 mb-4">
                      Tools with active or trial status
                    </p>
                    <div className="pt-3 border-t border-slate-800">
                      <p className="text-2xl font-bold text-emerald-400 mb-1">
                        {avgToolsPerAdmin !== null ? avgToolsPerAdmin.toFixed(2) : '—'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Average Tools per admin user
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Tools by Name</h3>
                {isLoadingStats ? (
                  <p className="text-xs text-slate-400">Loading...</p>
                ) : toolsByName.length > 0 ? (
                  <div className="mt-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={toolsByName}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {toolsByName.map((entry, index) => {
                            const colors = [
                              '#10b981', // emerald
                              '#3b82f6', // blue
                              '#8b5cf6', // purple
                              '#f59e0b', // amber
                              '#ef4444', // red
                              '#06b6d4', // cyan
                              '#ec4899', // pink
                              '#84cc16', // lime
                            ];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#e2e8f0'
                          }}
                          formatter={(value: number) => [value, 'Count']}
                        />
                        <Legend 
                          wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }}
                          formatter={(value) => value}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No data available</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <p className="text-2xl mb-2">💰</p>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Monthly Revenue</h3>
                {isLoadingStats ? (
                  <p className="text-xs text-slate-400">Loading...</p>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-emerald-400 mb-1">
                      {monthlyRevenue !== null 
                        ? new Intl.NumberFormat('en-US', { 
                            style: 'currency', 
                            currency: 'USD',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }).format(monthlyRevenue)
                        : '—'}
                    </p>
                    <p className="text-xs text-slate-400 mb-4">
                      Total pending revenue from billing_active
                    </p>
                    <div className="pt-3 border-t border-slate-800">
                      <p className="text-2xl font-bold text-emerald-400 mb-1">
                        {lifetimeRevenue !== null 
                          ? new Intl.NumberFormat('en-US', { 
                              style: 'currency', 
                              currency: 'USD',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }).format(lifetimeRevenue)
                          : '—'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Lifetime Revenue
                      </p>
                    </div>
                  </>
                )}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-sm font-semibold text-slate-100 mb-2">Revenue by Day</h3>
                {isLoadingStats ? (
                  <p className="text-xs text-slate-400">Loading...</p>
                ) : revenueByDay.length > 0 ? (
                  <div className="mt-4">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={revenueByDay}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#94a3b8"
                          style={{ fontSize: '12px' }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          stroke="#94a3b8"
                          style={{ fontSize: '12px' }}
                          tickFormatter={(value) => `$${value.toFixed(0)}`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#e2e8f0'
                          }}
                          formatter={(value: number) => [
                            new Intl.NumberFormat('en-US', { 
                              style: 'currency', 
                              currency: 'USD',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }).format(value),
                            'Revenue'
                          ]}
                        />
                        <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No data available</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tool Modal */}
      <ToolModal
        tool={selectedTool}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onBuy={handleBuy}
        isBuying={isBuying}
        buyMessage={buyMessage}
      />
    </main>
  );
}

