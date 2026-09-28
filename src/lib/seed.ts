import type { AppState, DailyReport, Member, Priority, Task, TaskStatus } from './types';
import { addDays, fromKey, todayKey, uid } from './utils';

const at = (dayKey: string, hour: number, min = 0) => {
  const d = fromKey(dayKey);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};

/** Demo workspace generated relative to today so the app always looks alive on first launch. */
export function createSeed(): AppState {
  const t = todayKey();
  const d = (n: number) => addDays(t, n);

  const members: Member[] = [
    { id: 'm1', name: 'Aarav Sharma', role: 'Frontend Developer', email: 'aarav@example.com', phone: '', color: '#7c5cff', joinedAt: at(d(-30), 9) },
    { id: 'm2', name: 'Priya Kaur', role: 'UI/UX Designer', email: 'priya@example.com', phone: '', color: '#f472b6', joinedAt: at(d(-30), 9) },
    { id: 'm3', name: 'Rohan Mehta', role: 'Backend Engineer', email: 'rohan@example.com', phone: '', color: '#22d3ee', joinedAt: at(d(-30), 9) },
    { id: 'm4', name: 'Sara Ali', role: 'QA Analyst', email: 'sara@example.com', phone: '', color: '#34d399', joinedAt: at(d(-30), 9) },
    { id: 'm5', name: 'Kabir Singh', role: 'Marketing Lead', email: 'kabir@example.com', phone: '', color: '#fbbf24', joinedAt: at(d(-30), 9) },
  ];

  const task = (
    title: string,
    assigneeId: string,
    created: number,
    due: number,
    priority: Priority,
    status: TaskStatus,
    progress: number,
    doneDay?: number,
    description = ''
  ): Task => ({
    id: uid(),
    title,
    description,
    assigneeId,
    priority,
    status,
    progress,
    dueDate: d(due),
    createdAt: at(d(created), 9, 30),
    completedAt: doneDay !== undefined ? at(d(doneDay), 17, 10) : undefined,
    notes: [],
  });

  const tasks: Task[] = [
    task('Build login screen', 'm1', -6, -3, 'high', 'done', 100, -3, 'Email + password with validation and error states.'),
    task('Dashboard charts integration', 'm1', -4, 1, 'high', 'in_progress', 65, undefined, 'Weekly bar chart and progress ring on the home screen.'),
    task('Fix navbar overflow on small phones', 'm1', -1, 0, 'medium', 'todo', 0),
    task('Design onboarding flow', 'm2', -6, -2, 'high', 'done', 100, -2, 'Three welcome screens with illustrations.'),
    task('Create icon set v2', 'm2', -3, 2, 'medium', 'in_progress', 40),
    task('Dark-mode palette review', 'm2', -1, 3, 'low', 'todo', 0),
    task('REST API for tasks', 'm3', -6, -2, 'high', 'in_progress', 80, undefined, 'CRUD endpoints + pagination.'),
    task('Database backup cron', 'm3', -5, -4, 'medium', 'done', 100, -4),
    task('Rate limiting middleware', 'm3', -2, 2, 'medium', 'todo', 10),
    task('Regression test suite', 'm4', -5, -1, 'high', 'in_progress', 55),
    task('Bug bash for release 1.2', 'm4', -3, -1, 'medium', 'done', 100, -1),
    task('Write test cases for reports', 'm4', 0, 2, 'low', 'todo', 0),
    task('Launch campaign plan', 'm5', -6, -3, 'high', 'done', 100, -3),
    task('Social media calendar', 'm5', -2, 0, 'medium', 'done', 100, 0),
    task('Competitor analysis deck', 'm5', -1, 4, 'low', 'in_progress', 30),
  ];
  tasks[1].notes.push({ id: uid(), text: 'Use the brand gradient for the bars please.', at: at(d(-2), 11), author: 'manager' });
  tasks[6].notes.push({ id: uid(), text: 'Blocked on DB credentials — need access from IT.', at: at(d(-1), 16), author: 'member' });

  const texts: Record<string, [string, string, string][]> = {
    m1: [['Finished login screen UI and validation', '', 'Start dashboard charts'], ['Wired chart data to store', 'Waiting on final colours', 'Polish animations'], ['Chart hover tooltips done', '', 'Fix navbar overflow']],
    m2: [['Onboarding screens delivered', '', 'Start icon set v2'], ['12 of 30 icons drawn', '', 'Continue icons'], ['Reviewed palette contrast', 'Need feedback on accent colour', 'Dark-mode review']],
    m3: [['Backup cron deployed', '', 'Tasks API'], ['Tasks CRUD endpoints', 'DB credentials pending', 'Pagination'], ['Pagination done', 'Still blocked on credentials', 'Rate limiting']],
    m4: [['Wrote 40 regression cases', '', 'Bug bash'], ['Bug bash: 18 issues logged', '', 'Verify fixes'], ['Verified 12 fixes', '', 'Report test cases']],
    m5: [['Campaign plan approved', '', 'Social calendar'], ['Calendar drafted for October', '', 'Competitor deck'], ['Collected 6 competitor profiles', '', 'Finish deck']],
  };

  const reports: DailyReport[] = [];
  [-3, -2, -1].forEach((offset, i) => {
    members.forEach((m, mi) => {
      if (offset === -1 && mi === 4) return; // one missing report to show tracking
      const [accomplished, blockers, tomorrow] = texts[m.id][i];
      reports.push({
        id: uid(),
        memberId: m.id,
        date: d(offset),
        accomplished,
        blockers,
        tomorrow,
        hours: 7 + ((mi + i) % 3),
        mood: blockers ? 3 : 4 + ((mi + i) % 2),
        taskUpdates: [],
        managerNote: offset === -3 && mi === 0 ? 'Great work on the login screen!' : '',
        rating: offset === -3 ? 4 + (mi % 2) : 0,
        reviewed: offset !== -1,
        source: 'colleague',
        createdAt: at(d(offset), 18, 5 * mi),
      });
    });
  });
  // Two reports already in for today.
  reports.push(
    { id: uid(), memberId: 'm5', date: t, accomplished: 'Published social media calendar', blockers: '', tomorrow: 'Competitor deck slides', hours: 6, mood: 5, taskUpdates: [], managerNote: '', rating: 0, reviewed: false, source: 'colleague', createdAt: new Date().toISOString() },
    { id: uid(), memberId: 'm4', date: t, accomplished: 'Regression suite at 55%', blockers: 'Staging env is flaky', tomorrow: 'Continue regression', hours: 8, mood: 3, taskUpdates: [], managerNote: '', rating: 0, reviewed: false, source: 'colleague', createdAt: new Date().toISOString() }
  );

  return {
    members,
    tasks,
    reports,
    activity: [
      { id: uid(), at: new Date().toISOString(), text: 'Sara Ali submitted today’s report', kind: 'report' },
      { id: uid(), at: new Date().toISOString(), text: 'Kabir Singh completed “Social media calendar”', kind: 'task' },
      { id: uid(), at: at(d(-1), 16), text: 'Rohan Mehta added a note on “REST API for tasks”', kind: 'note' },
      { id: uid(), at: at(d(-2), 11), text: 'You commented on “Dashboard charts integration”', kind: 'note' },
    ],
    settings: { managerName: 'Manager', teamName: 'Product Team', theme: 'dark', effects: true },
  };
}
