import { ClipboardList, Download, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSheets } from '../components/Sheets';
import { TaskCard } from '../components/TaskCard';
import { Avatar, Empty, Segmented } from '../components/ui';
import { shareOrDownload, tasksCsv, tasksPdf } from '../lib/exporters';
import { navigate, useRoute, useStore, useToast } from '../lib/store';
import type { Task } from '../lib/types';
import { isOverdue, todayKey } from '../lib/utils';

type Filter = 'all' | 'todo' | 'in_progress' | 'done' | 'overdue';
type Sort = 'due' | 'priority' | 'recent' | 'progress';
const PRIO = { high: 0, medium: 1, low: 2 };

export function Tasks() {
  const { state } = useStore();
  const sheets = useSheets();
  const { toast } = useToast();
  const route = useRoute();
  const filter = (route.query.get('f') as Filter) || 'all';
  const [q, setQ] = useState('');
  const [who, setWho] = useState<string>('');
  const [sort, setSort] = useState<Sort>('due');
  const [exportOpen, setExportOpen] = useState(false);

  const counts = useMemo(() => {
    const c = { all: state.tasks.length, todo: 0, in_progress: 0, done: 0, overdue: 0 };
    state.tasks.forEach((t) => {
      c[t.status]++;
      if (isOverdue(t)) c.overdue++;
    });
    return c;
  }, [state.tasks]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = state.tasks.filter(
      (t) =>
        (filter === 'all' || (filter === 'overdue' ? isOverdue(t) : t.status === filter)) &&
        (!who || t.assigneeId === who) &&
        (!needle || t.title.toLowerCase().includes(needle) || t.description.toLowerCase().includes(needle))
    );
    const by: Record<Sort, (a: Task, b: Task) => number> = {
      due: (a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.dueDate.localeCompare(b.dueDate),
      priority: (a, b) => PRIO[a.priority] - PRIO[b.priority],
      recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
      progress: (a, b) => a.progress - b.progress,
    };
    return rows.sort(by[sort]);
  }, [state.tasks, filter, who, q, sort]);

  const doExport = async (kind: 'pdf' | 'csv') => {
    setExportOpen(false);
    const stamp = todayKey();
    const res = kind === 'pdf' ? await shareOrDownload(await tasksPdf(state), `tasks-${stamp}.pdf`, 'Task register') : await shareOrDownload(tasksCsv(state), `tasks-${stamp}.csv`, 'Task register');
    if (res !== 'cancelled') toast(res === 'shared' ? 'Shared' : 'Downloaded');
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Work board</p>
          <h1>Tasks</h1>
        </div>
        <div className="row gap-8">
          <div className="menu-wrap">
            <button className="icon-btn glass" onClick={() => setExportOpen((o) => !o)} aria-label="Export tasks">
              <Download size={18} />
            </button>
            {exportOpen && (
              <div className="menu glass-strong">
                <button onClick={() => doExport('pdf')}>Share / download PDF</button>
                <button onClick={() => doExport('csv')}>Download CSV (Excel)</button>
              </div>
            )}
          </div>
          <button className="icon-btn primary" onClick={() => sheets.newTask(who || undefined)} aria-label="Assign task">
            <Plus size={20} />
          </button>
        </div>
      </header>

      <div className="search glass">
        <Search size={17} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" aria-label="Search tasks" />
        {q && (
          <button className="icon-btn tiny" onClick={() => setQ('')} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>

      <Segmented<Filter>
        value={filter}
        onChange={(f) => navigate(`/tasks?f=${f}`)}
        options={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'todo', label: 'To do', count: counts.todo },
          { value: 'in_progress', label: 'In progress', count: counts.in_progress },
          { value: 'done', label: 'Done', count: counts.done },
          { value: 'overdue', label: 'Overdue', count: counts.overdue },
        ]}
      />

      <div className="filter-row">
        <div className="who-filter">
          <button className={`who ${!who ? 'active' : ''}`} onClick={() => setWho('')}>
            All
          </button>
          {state.members.map((m) => (
            <button key={m.id} className={`who ${who === m.id ? 'active' : ''}`} onClick={() => setWho(who === m.id ? '' : m.id)} aria-label={`Filter by ${m.name}`} title={m.name}>
              <Avatar member={m} size={30} />
            </button>
          ))}
        </div>
        <select className="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort tasks">
          <option value="due">Due date</option>
          <option value="priority">Priority</option>
          <option value="recent">Newest</option>
          <option value="progress">Least progress</option>
        </select>
      </div>

      {list.length ? (
        <div className="stack gap-12 stagger">
          {list.map((t) => (
            <TaskCard key={t.id} task={t} onOpen={(x) => sheets.openTask(x.id)} />
          ))}
        </div>
      ) : (
        <Empty
          icon={ClipboardList}
          title="No tasks here"
          text={q || who || filter !== 'all' ? 'Try another filter or search.' : 'Assign the first task to your team.'}
          action={
            <button className="btn primary" onClick={() => sheets.newTask(who || undefined)}>
              <Plus size={16} /> Assign task
            </button>
          }
        />
      )}
    </div>
  );
}
