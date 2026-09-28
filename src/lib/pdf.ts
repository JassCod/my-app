import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AppState, Member } from './types';
import { PRIORITY_LABEL, STATUS_LABEL, addDays, dueLabel, fmtDate, fmtLongDate, isOverdue, memberName, summarizeDay, todayKey } from './utils';

const BRAND: [number, number, number] = [91, 76, 255];
const INK: [number, number, number] = [30, 30, 46];
const MUTED: [number, number, number] = [110, 110, 130];

function header(doc: jsPDF, title: string, subtitle: string, team: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, 28, 'F');
  doc.setFillColor(34, 211, 238);
  doc.rect(0, 28, w, 1.2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(subtitle, 14, 21);
  doc.text(`TeamPulse · ${team}`, w - 14, 13, { align: 'right' });
  doc.text(`Generated ${new Date().toLocaleString()}`, w - 14, 21, { align: 'right' });
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Page ${i} of ${pages}`, w - 14, h - 8, { align: 'right' });
    doc.text('TeamPulse — daily work record', 14, h - 8);
  }
}

function statRow(doc: jsPDF, y: number, stats: [string, string][]) {
  const w = doc.internal.pageSize.getWidth() - 28;
  const cw = w / stats.length;
  stats.forEach(([label, value], i) => {
    const x = 14 + i * cw;
    doc.setFillColor(244, 243, 255);
    doc.roundedRect(x + 1, y, cw - 2, 18, 2.5, 2.5, 'F');
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(value, x + 5, y + 8.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label, x + 5, y + 14);
  });
  return y + 24;
}

function section(doc: jsPDF, y: number, title: string) {
  if (y > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    y = 16;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...INK);
  doc.text(title, 14, y);
  return y + 3;
}

const lastY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
const table = (doc: jsPDF, y: number, head: string[], body: (string | number)[][], empty = 'Nothing to show') =>
  autoTable(doc, {
    startY: y,
    head: [head],
    body: body.length ? body : [[{ content: empty, colSpan: head.length, styles: { textColor: MUTED, fontStyle: 'italic' } } as never]],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.4, textColor: INK, lineColor: [228, 228, 240], valign: 'top' },
    headStyles: { fillColor: [238, 236, 255], textColor: [60, 50, 160], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [251, 251, 255] },
    margin: { left: 14, right: 14 },
  });

/** Full daily record: stats, colleague reports, completed work and the incomplete backlog. */
export function dailyReportPdf(state: AppState, date: string): Blob {
  const s = summarizeDay(state, date);
  const doc = new jsPDF();
  header(doc, 'Daily Team Report', fmtLongDate(date), state.settings.teamName);
  let y = statRow(doc, 36, [
    ['Completion rate', `${s.rate}%`],
    ['Completed', String(s.completed.length)],
    ['Incomplete', String(s.incomplete.length)],
    ['Overdue', String(s.overdue.length)],
    ['Reports in', `${s.reports.length}/${s.reports.length + s.missing.length}`],
  ]);

  y = section(doc, y, 'Colleague reports');
  table(
    doc,
    y,
    ['Colleague', 'Accomplished', 'Blockers', 'Next', 'Hrs', 'Mood', 'Manager note'],
    s.reports.map((r) => [memberName(state, r.memberId), r.accomplished || '—', r.blockers || '—', r.tomorrow || '—', r.hours, `${r.mood}/5`, [r.rating ? `Rated ${r.rating}/5.` : '', r.managerNote].filter(Boolean).join(' ') || '—']),
    'No reports submitted'
  );
  y = lastY(doc);
  if (s.missing.length) {
    doc.setFontSize(8.5);
    doc.setTextColor(200, 60, 90);
    doc.text(`Missing reports: ${s.missing.map((id) => memberName(state, id)).join(', ')}`, 14, y - 3);
    y += 4;
  }

  y = section(doc, y, `Completed on ${fmtDate(date)}`);
  table(doc, y, ['Task', 'Colleague', 'Priority'], s.completed.map((t) => [t.title, memberName(state, t.assigneeId), PRIORITY_LABEL[t.priority]]), 'No tasks completed this day');
  y = lastY(doc);

  y = section(doc, y, 'Incomplete work (carried forward)');
  table(
    doc,
    y,
    ['Task', 'Colleague', 'Status', 'Progress', 'Due', 'Priority'],
    s.incomplete.map((t) => [t.title, memberName(state, t.assigneeId), STATUS_LABEL[t.status], `${t.progress}%`, `${fmtDate(t.dueDate)}${t.dueDate < date ? ' (overdue)' : ''}`, PRIORITY_LABEL[t.priority]]),
    'All work complete'
  );
  footer(doc);
  return doc.output('blob');
}

/** Per-colleague record: open tasks, completed tasks and the last 14 days of reports. */
export function memberReportPdf(state: AppState, member: Member): Blob {
  const doc = new jsPDF();
  header(doc, member.name, `${member.role} · Colleague report`, state.settings.teamName);
  const tasks = state.tasks.filter((t) => t.assigneeId === member.id);
  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const reports = state.reports.filter((r) => r.memberId === member.id).sort((a, b) => b.date.localeCompare(a.date));
  const since = addDays(todayKey(), -13);
  const recent = reports.filter((r) => r.date >= since);
  let y = statRow(doc, 36, [
    ['Total tasks', String(tasks.length)],
    ['Completed', String(done.length)],
    ['Open', String(open.length)],
    ['Overdue', String(open.filter((t) => isOverdue(t)).length)],
    ['Reports (14d)', String(recent.length)],
  ]);
  y = section(doc, y, 'Incomplete tasks');
  table(doc, y, ['Task', 'Status', 'Progress', 'Due', 'Priority'], open.map((t) => [t.title, STATUS_LABEL[t.status], `${t.progress}%`, dueLabel(t.dueDate), PRIORITY_LABEL[t.priority]]), 'No open tasks');
  y = lastY(doc);
  y = section(doc, y, 'Completed tasks');
  table(doc, y, ['Task', 'Completed', 'Priority'], done.map((t) => [t.title, t.completedAt ? new Date(t.completedAt).toLocaleDateString() : '—', PRIORITY_LABEL[t.priority]]), 'Nothing completed yet');
  y = lastY(doc);
  y = section(doc, y, 'Daily reports — last 14 days');
  table(doc, y, ['Date', 'Accomplished', 'Blockers', 'Hrs', 'Manager note'], recent.map((r) => [fmtDate(r.date), r.accomplished || '—', r.blockers || '—', r.hours, r.managerNote || '—']), 'No reports in this period');
  footer(doc);
  return doc.output('blob');
}

/** Every task, open or done, as a table. */
export function tasksPdf(state: AppState): Blob {
  const doc = new jsPDF({ orientation: 'landscape' });
  header(doc, 'Task Register', `${state.tasks.length} tasks across ${state.members.length} colleagues`, state.settings.teamName);
  table(
    doc,
    36,
    ['Task', 'Colleague', 'Status', 'Progress', 'Priority', 'Due', 'Created', 'Latest note'],
    state.tasks.map((t) => [t.title, memberName(state, t.assigneeId), STATUS_LABEL[t.status], `${t.progress}%`, PRIORITY_LABEL[t.priority], fmtDate(t.dueDate) + (isOverdue(t) ? ' (overdue)' : ''), new Date(t.createdAt).toLocaleDateString(), t.notes.at(-1)?.text ?? '—'])
  );
  footer(doc);
  return doc.output('blob');
}

