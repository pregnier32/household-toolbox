'use client';

import { createElement, type ComponentType } from 'react';
import dynamic from 'next/dynamic';

export type ToolComponent = ComponentType<{ toolId?: string }>;

function ToolLoading() {
  return createElement('p', { className: 'text-slate-400' }, 'Loading...');
}

const PercentOfOrderTool = dynamic(
  () => import('../components/PercentOfOrderTool').then((mod) => mod.PercentOfOrderTool),
  { loading: ToolLoading }
);
const PetCareScheduleTool = dynamic(
  () => import('../components/PetCareScheduleTool').then((mod) => mod.PetCareScheduleTool),
  { loading: ToolLoading }
);
const SubscriptionTrackerTool = dynamic(
  () => import('../components/SubscriptionTrackerTool').then((mod) => mod.SubscriptionTrackerTool),
  { loading: ToolLoading }
);
const CalendarEventsTool = dynamic(
  () => import('../components/CalendarEventsTool').then((mod) => mod.CalendarEventsTool),
  { loading: ToolLoading }
);
const ImportantDocumentsTool = dynamic(
  () => import('../components/ImportantDocumentsTool').then((mod) => mod.ImportantDocumentsTool),
  { loading: ToolLoading }
);
const NotesTool = dynamic(
  () => import('../components/NotesTool').then((mod) => mod.NotesTool),
  { loading: ToolLoading }
);
const RepairHistoryTool = dynamic(
  () => import('../components/RepairHistoryTool').then((mod) => mod.RepairHistoryTool),
  { loading: ToolLoading }
);
const HealthcareApptsHistoryTool = dynamic(
  () => import('../components/HealthcareApptsHistoryTool').then((mod) => mod.HealthcareApptsHistoryTool),
  { loading: ToolLoading }
);
const ToDoListTool = dynamic(
  () => import('../components/ToDoListTool').then((mod) => mod.ToDoListTool),
  { loading: ToolLoading }
);
const GoalsTrackingTool = dynamic(
  () => import('../components/GoalsTrackingTool').then((mod) => mod.GoalsTrackingTool),
  { loading: ToolLoading }
);
const ShoppingListTool = dynamic(
  () => import('../components/ShoppingListTool').then((mod) => mod.ShoppingListTool),
  { loading: ToolLoading }
);
const MealPlannerTool = dynamic(
  () => import('../components/MealPlannerTool').then((mod) => mod.MealPlannerTool),
  { loading: ToolLoading }
);
const HSATrackerTool = dynamic(
  () => import('../components/HSATrackerTool').then((mod) => mod.HSATrackerTool),
  { loading: ToolLoading }
);
const AddressBookTool = dynamic(
  () => import('../components/AddressBookTool').then((mod) => mod.AddressBookTool),
  { loading: ToolLoading }
);
const TravelLogTool = dynamic(
  () => import('../components/TravelLogTool').then((mod) => mod.TravelLogTool),
  { loading: ToolLoading }
);
const EventBudgetPlannerTool = dynamic(
  () => import('../components/EventBudgetPlannerTool').then((mod) => mod.EventBudgetPlannerTool),
  { loading: ToolLoading }
);
const CleaningScheduleTool = dynamic(
  () => import('../components/CleaningScheduleTool').then((mod) => mod.CleaningScheduleTool),
  { loading: ToolLoading }
);
const HomeMaintenanceScheduleTool = dynamic(
  () => import('../components/HomeMaintenanceScheduleTool').then((mod) => mod.HomeMaintenanceScheduleTool),
  { loading: ToolLoading }
);
const EndOfLifePlannerTool = dynamic(
  () => import('../components/EndOfLifePlannerTool').then((mod) => mod.EndOfLifePlannerTool),
  { loading: ToolLoading }
);

const TOOL_COMPONENTS: Record<string, ToolComponent> = {
  'Percent of my Order': PercentOfOrderTool,
  'Pet Care Schedule': PetCareScheduleTool,
  'Subscription Tracker': SubscriptionTrackerTool,
  'Calendar Events': CalendarEventsTool,
  'Important Documents': ImportantDocumentsTool,
  Notes: NotesTool,
  'Repair History': RepairHistoryTool,
  'Healthcare Appts and History': HealthcareApptsHistoryTool,
  'Healthcare Appts & History': HealthcareApptsHistoryTool,
  'To Do List': ToDoListTool,
  'Goals Tracking': GoalsTrackingTool,
  'Shopping List': ShoppingListTool,
  'Meal Planner': MealPlannerTool,
  'HSA Tracker': HSATrackerTool,
  'Address Book': AddressBookTool,
  'Travel Log': TravelLogTool,
  'Event Budget Planner': EventBudgetPlannerTool,
  'Cleaning Schedule': CleaningScheduleTool,
  'Home Maintenance Schedule': HomeMaintenanceScheduleTool,
  'End of Life Planner': EndOfLifePlannerTool,
};

export function getToolComponent(toolName: string): ToolComponent | null {
  return TOOL_COMPONENTS[toolName] ?? null;
}
