import type { ComponentType } from 'react';
import { PercentOfOrderTool } from '../components/PercentOfOrderTool';
import { PetCareScheduleTool } from '../components/PetCareScheduleTool';
import { SubscriptionTrackerTool } from '../components/SubscriptionTrackerTool';
import { CalendarEventsTool } from '../components/CalendarEventsTool';
import { ImportantDocumentsTool } from '../components/ImportantDocumentsTool';
import { NotesTool } from '../components/NotesTool';
import { RepairHistoryTool } from '../components/RepairHistoryTool';
import { HealthcareApptsHistoryTool } from '../components/HealthcareApptsHistoryTool';
import { ToDoListTool } from '../components/ToDoListTool';
import { GoalsTrackingTool } from '../components/GoalsTrackingTool';
import { ShoppingListTool } from '../components/ShoppingListTool';
import { MealPlannerTool } from '../components/MealPlannerTool';
import { HSATrackerTool } from '../components/HSATrackerTool';
import { AddressBookTool } from '../components/AddressBookTool';
import { TravelLogTool } from '../components/TravelLogTool';
import { EventBudgetPlannerTool } from '../components/EventBudgetPlannerTool';
import { CleaningScheduleTool } from '../components/CleaningScheduleTool';
import { HomeMaintenanceScheduleTool } from '../components/HomeMaintenanceScheduleTool';
import { EndOfLifePlannerTool } from '../components/EndOfLifePlannerTool';

export type ToolComponent = ComponentType<{ toolId?: string }>;

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
