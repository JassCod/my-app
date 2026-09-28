import { CalendarDays, MessageSquare } from 'lucide-react';
import { useStore } from '../lib/store';
import type { Task } from '../lib/types';
import { dueLabel, isOverdue } from '../lib/utils';
import { Avatar, PriorityBadge, ProgressBar, StatusBadge } from './ui';

export function TaskCard({ task, onOpen, showAssignee = true }: { task: Task; onOpen: (t: Task) => void; showAssignee?: boolean }) {
  const { state } = useStore();
  const member = state.members.find((m) => m.id === task.assigneeId);
  const overdue = isOverdue(task);
  return (
    <button className={`task-card glass pressable prio-edge-${task.priority} ${task.status === 'done' ? 'is-done' : ''}`} onClick={() => onOpen(task)}>
      <div className="tc-top">
        <StatusBadge status={task.status} overdue={overdue} />
        <PriorityBadge priority={task.priority} />
      </div>
      <h4 className="tc-title">{task.title}</h4>
      {task.description && <p className="tc-desc">{task.description}</p>}
      <div className="tc-progress">
        <ProgressBar value={task.progress} />
        <span>{task.progress}%</span>
      </div>
      <div className="tc-meta">
        {showAssignee && (
          <span className="tc-who">
            <Avatar member={member} size={22} />
            {member?.name.split(' ')[0] ?? 'Unassigned'}
          </span>
        )}
        <span className={`tc-due ${overdue ? 'danger' : ''}`}>
          <CalendarDays size={13} /> {task.status === 'done' ? 'Completed' : dueLabel(task.dueDate)}
        </span>
        {task.notes.length > 0 && (
          <span className="tc-notes">
            <MessageSquare size={13} /> {task.notes.length}
          </span>
        )}
      </div>
    </button>
  );
}
