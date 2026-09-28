export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Member {
  id: string;
  name: string;
  role: string; // job title
  email: string;
  phone: string;
  color: string;
  joinedAt: string;
  uid?: string; // set when the colleague has signed in with their own account
}

/** Access level inside the app. Managers can do everything; colleagues work on their own tasks and reports. */
export type Access = 'manager' | 'member';

export interface UserDoc {
  uid: string;
  name: string;
  email: string;
  role: Access;
  memberId: string | null;
  inviteCode?: string;
  createdAt: string;
}

export interface Invite {
  code: string;
  memberId: string;
  email: string;
  name: string;
  teamName: string;
  createdAt: string;
}

export interface Session {
  mode: 'local' | 'cloud';
  role: Access;
  uid: string | null;
  memberId: string | null;
  name: string;
  email: string;
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
  users?: UserDoc[]; // cloud mode, managers only
}
