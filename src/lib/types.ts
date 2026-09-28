export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Member {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  color: string;
  joinedAt: string;
}

export interface Note {
  id: string;
  text: string;
  at: string;
  author: 'manager' | 'member';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  dueDate: string; // YYYY-MM-DD
  createdAt: string; // ISO
  completedAt?: string; // ISO
  notes: Note[];
}

export interface TaskUpdate {
  taskId: string;
  progress: number;
  status: TaskStatus;
}

export interface DailyReport {
  id: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  accomplished: string;
  blockers: string;
  tomorrow: string;
  hours: number;
  mood: number; // 1..5
  taskUpdates: TaskUpdate[];
  managerNote: string;
  rating: number; // 0 = not rated, 1..5
  reviewed: boolean;
  source: 'manager' | 'colleague';
  createdAt: string;
}

export interface Activity {
  id: string;
  at: string;
  text: string;
  kind: 'task' | 'report' | 'member' | 'note' | 'system';
}

export interface Settings {
  managerName: string;
  teamName: string;
  theme: 'dark' | 'light';
  effects: boolean;
}

export interface AppState {
  members: Member[];
  tasks: Task[];
  reports: DailyReport[];
  activity: Activity[];
  settings: Settings;
}
