import type { AppState, Member } from './types';
import { PRIORITY_LABEL, STATUS_LABEL, memberName } from './utils';

/* PDF generation pulls in jsPDF (~400 KB), so it is loaded only when a PDF is requested. */
export const dailyReportPdf = async (state: AppState, date: string) => (await import('./pdf')).dailyReportPdf(state, date);
export const memberReportPdf = async (state: AppState, member: Member) => (await import('./pdf')).memberReportPdf(state, member);
export const tasksPdf = async (state: AppState) => (await import('./pdf')).tasksPdf(state);

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export function tasksCsv(state: AppState): Blob {
  const rows = [
    ['Title', 'Description', 'Colleague', 'Status', 'Progress', 'Priority', 'Due date', 'Created', 'Completed', 'Notes'],
    ...state.tasks.map((t) => [t.title, t.description, memberName(state, t.assigneeId), STATUS_LABEL[t.status], t.progress, PRIORITY_LABEL[t.priority], t.dueDate, t.createdAt, t.completedAt ?? '', t.notes.map((n) => `[${n.author}] ${n.text}`).join(' | ')]),
  ];
  return new Blob(['﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' });
}

export function reportsCsv(state: AppState): Blob {
  const rows = [
    ['Date', 'Colleague', 'Accomplished', 'Blockers', 'Tomorrow', 'Hours', 'Mood', 'Rating', 'Manager note', 'Reviewed'],
    ...[...state.reports].sort((a, b) => b.date.localeCompare(a.date)).map((r) => [r.date, memberName(state, r.memberId), r.accomplished, r.blockers, r.tomorrow, r.hours, r.mood, r.rating || '', r.managerNote, r.reviewed ? 'yes' : 'no']),
  ];
  return new Blob(['﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' });
}

export const backupJson = (state: AppState) => new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Share a file via the native share sheet when supported; otherwise download it. Returns what happened. */
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text: title });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

/** Share a text/link via the native share sheet, falling back to the clipboard. */
export async function shareText(title: string, text: string, url?: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText([text, url].filter(Boolean).join('\n'));
    return 'copied';
  } catch {
    return 'failed';
  }
}
