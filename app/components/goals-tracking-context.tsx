'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type GoalAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export type Category = {
  id: string;
  name: string;
  card_color: string;
  isStock?: boolean;
};

export type Priority = 'High' | 'Medium' | 'Low';
export type GoalStatus = 'Not Started' | 'In Progress' | 'Delayed' | 'Completed';

export type Task = {
  id: string;
  phaseId: string;
  title: string;
  completed: boolean;
};

export type Phase = {
  id: string;
  goalId: string;
  name: string;
  order: number;
};

export type UpdateNote = {
  id: string;
  goalId: string;
  noteDate: string;
  note: string;
  attachments: GoalAttachment[];
};

export type Goal = {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  targetDate: string;
  priority: Priority;
  status: GoalStatus;
  percentComplete: number;
  reminderDays: number | null;
  lastUpdateDate: string | null;
  useTaskProgressForPercent: boolean;
  addToDashboard: boolean;
  phases: Phase[];
  tasks: Task[];
  updateNotes: UpdateNote[];
  attachments: GoalAttachment[];
};

type GoalsContextValue = {
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
};

const GoalsContext = createContext<GoalsContextValue | null>(null);

export function normalizeGoal(goal: Goal): Goal {
  return {
    ...goal,
    addToDashboard: goal.addToDashboard === true,
    attachments: goal.attachments || [],
    updateNotes: (goal.updateNotes || []).map((note) => ({
      ...note,
      attachments: note.attachments || [],
    })),
  };
}

export function GoalsProvider({
  children,
  goalsToolId = null,
}: {
  children: React.ReactNode;
  goalsToolId?: string | null;
}) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!goalsToolId) return;
    let cancelled = false;
    fetch(`/api/tools/goals-tracking?toolId=${encodeURIComponent(goalsToolId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) return;
        setCategories(data.categories ?? []);
        setGoals(((data.goals ?? []) as Goal[]).map(normalizeGoal));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [goalsToolId]);

  return (
    <GoalsContext.Provider value={{ goals, setGoals, categories, setCategories }}>
      {children}
    </GoalsContext.Provider>
  );
}

export function useGoalsContext() {
  return useContext(GoalsContext);
}
