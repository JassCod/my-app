// Security rules tests. Run: npm run test:rules (starts the Firestore emulator).
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, query, collection, where, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

let env;
const boss = { uid: 'boss', email: 'boss@team.com' };
const aarav = { uid: 'u-aarav', email: 'aarav@team.com' };
const priya = { uid: 'u-priya', email: 'priya@team.com' };
const stranger = { uid: 'u-x', email: 'x@evil.com' };
const as = (u) => env.authenticatedContext(u.uid, { email: u.email }).firestore();

const task = (id, assigneeId, extra = {}) => ({ id, title: 't ' + id, description: '', assigneeId, priority: 'medium', status: 'todo', progress: 0, dueDate: '2026-10-01', createdAt: '2026-09-28T00:00:00Z', notes: [], ...extra });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-teampulse', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  // A workspace with a manager, two joined colleagues and their tasks/reports.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'meta/workspace'), { teamName: 'Team', ownerUid: boss.uid });
    await setDoc(doc(db, 'users', boss.uid), { uid: boss.uid, email: boss.email, name: 'Boss', role: 'manager', memberId: null });
    await setDoc(doc(db, 'users', aarav.uid), { uid: aarav.uid, email: aarav.email, name: 'Aarav', role: 'member', memberId: 'm1' });
    await setDoc(doc(db, 'users', priya.uid), { uid: priya.uid, email: priya.email, name: 'Priya', role: 'member', memberId: 'm2' });
    await setDoc(doc(db, 'members/m1'), { id: 'm1', name: 'Aarav', email: aarav.email, uid: aarav.uid });
    await setDoc(doc(db, 'members/m2'), { id: 'm2', name: 'Priya', email: priya.email, uid: priya.uid });
    await setDoc(doc(db, 'members/m3'), { id: 'm3', name: 'Neha', email: 'neha@team.com' });
    await setDoc(doc(db, 'invites/code-neha'), { code: 'code-neha', memberId: 'm3', email: 'neha@team.com', name: 'Neha' });
    await setDoc(doc(db, 'tasks/t1'), task('t1', 'm1'));
    await setDoc(doc(db, 'tasks/t2'), task('t2', 'm2'));
    await setDoc(doc(db, 'reports/m2_2026-09-28'), { id: 'm2_2026-09-28', memberId: 'm2', date: '2026-09-28', accomplished: 'x', managerNote: '', rating: 0, reviewed: false });
  });
});

describe('setup', () => {
  test('first account can found the workspace as manager only when none exists', async () => {
    await env.clearFirestore();
    const db = as(boss);
    const b = writeBatch(db);
    b.set(doc(db, 'users', boss.uid), { uid: boss.uid, email: boss.email, name: 'Boss', role: 'manager', memberId: null });
    b.set(doc(db, 'meta/workspace'), { teamName: 'T', ownerUid: boss.uid });
    await assertSucceeds(b.commit());
    // a second founder is refused
    const db2 = as(stranger);
    const b2 = writeBatch(db2);
    b2.set(doc(db2, 'users', stranger.uid), { uid: stranger.uid, email: stranger.email, name: 'X', role: 'manager', memberId: null });
    b2.set(doc(db2, 'meta/workspace'), { teamName: 'Mine', ownerUid: stranger.uid });
    await assertFails(b2.commit());
  });

  test('a stranger cannot make themselves manager or member without an invite', async () => {
    const db = as(stranger);
    await assertFails(setDoc(doc(db, 'users', stranger.uid), { uid: stranger.uid, email: stranger.email, name: 'X', role: 'manager', memberId: null }));
    await assertFails(setDoc(doc(db, 'users', stranger.uid), { uid: stranger.uid, email: stranger.email, name: 'X', role: 'member', memberId: 'm3', inviteCode: 'code-neha' }));
    await assertFails(getDocs(collection(db, 'members')));
    await assertFails(getDoc(doc(db, 'tasks/t1')));
  });

  test('an invited colleague can join with the invite issued to their email', async () => {
    const neha = { uid: 'u-neha', email: 'neha@team.com' };
    const db = as(neha);
    const b = writeBatch(db);
    b.set(doc(db, 'users', neha.uid), { uid: neha.uid, email: neha.email, name: 'Neha', role: 'member', memberId: 'm3', inviteCode: 'code-neha' });
    b.update(doc(db, 'members/m3'), { uid: neha.uid });
    await assertSucceeds(b.commit());
    // but cannot claim another person's record
    await assertFails(updateDoc(doc(db, 'members/m1'), { uid: neha.uid }));
  });

  test('invites are readable by code but not listable by colleagues', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'invites/code-neha')));
    await assertFails(getDocs(collection(as(aarav), 'invites')));
  });
});

describe('colleague', () => {
  test('sees only their own tasks and reports', async () => {
    const db = as(aarav);
    await assertSucceeds(getDocs(query(collection(db, 'tasks'), where('assigneeId', '==', 'm1'))));
    await assertFails(getDocs(collection(db, 'tasks')));
    await assertFails(getDoc(doc(db, 'tasks/t2')));
    await assertFails(getDoc(doc(db, 'reports/m2_2026-09-28')));
    await assertSucceeds(getDocs(collection(db, 'members')));
  });

  test('can update progress, status and notes on their own task only', async () => {
    const db = as(aarav);
    await assertSucceeds(updateDoc(doc(db, 'tasks/t1'), { progress: 50, status: 'in_progress', notes: [{ id: 'n', text: 'hi', author: 'member' }] }));
    await assertFails(updateDoc(doc(db, 'tasks/t1'), { title: 'renamed' }));
    await assertFails(updateDoc(doc(db, 'tasks/t1'), { assigneeId: 'm2' }));
    await assertFails(updateDoc(doc(db, 'tasks/t1'), { progress: 500 }));
    await assertFails(updateDoc(doc(db, 'tasks/t2'), { progress: 50 }));
    await assertFails(setDoc(doc(db, 'tasks/new'), task('new', 'm1')));
    await assertFails(deleteDoc(doc(db, 'tasks/t1')));
  });

  test('can submit their own report but not rate it or report for others', async () => {
    const db = as(aarav);
    const r = { id: 'm1_2026-09-28', memberId: 'm1', date: '2026-09-28', accomplished: 'done', managerNote: '', rating: 0, reviewed: false };
    await assertSucceeds(setDoc(doc(db, 'reports/m1_2026-09-28'), r));
    await assertSucceeds(setDoc(doc(db, 'reports/m1_2026-09-28'), { ...r, accomplished: 'edited' }));
    await assertFails(setDoc(doc(db, 'reports/m1_2026-09-28'), { ...r, rating: 5 }));
    await assertFails(setDoc(doc(db, 'reports/m1_2026-09-29'), { ...r, id: 'm1_2026-09-29', date: '2026-09-29', managerNote: 'self praise' }));
    await assertFails(setDoc(doc(db, 'reports/m2_2026-09-29'), { ...r, id: 'm2_2026-09-29', memberId: 'm2', date: '2026-09-29' }));
  });

  test('cannot change access levels, team members or read activity', async () => {
    const db = as(aarav);
    await assertFails(updateDoc(doc(db, 'users', aarav.uid), { role: 'manager' }));
    await assertSucceeds(updateDoc(doc(db, 'users', aarav.uid), { name: 'Aarav S' }));
    await assertFails(getDoc(doc(db, 'users', priya.uid)));
    await assertFails(setDoc(doc(db, 'members/m9'), { id: 'm9', name: 'Fake' }));
    await assertFails(updateDoc(doc(db, 'members/m2'), { name: 'Hacked' }));
    await assertFails(getDocs(collection(db, 'activity')));
    await assertSucceeds(setDoc(doc(db, 'activity/a1'), { id: 'a1', text: 'Aarav submitted a report', kind: 'report', at: 'x' }));
    await assertFails(updateDoc(doc(db, 'meta/workspace'), { teamName: 'Mine' }));
  });
});

describe('manager', () => {
  test('can do everything', async () => {
    const db = as(boss);
    await assertSucceeds(getDocs(collection(db, 'tasks')));
    await assertSucceeds(getDocs(collection(db, 'reports')));
    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(setDoc(doc(db, 'tasks/t9'), task('t9', 'm2')));
    await assertSucceeds(updateDoc(doc(db, 'tasks/t1'), { title: 'New title', assigneeId: 'm2' }));
    await assertSucceeds(updateDoc(doc(db, 'reports/m2_2026-09-28'), { managerNote: 'Great', rating: 5, reviewed: true }));
    await assertSucceeds(setDoc(doc(db, 'invites/c2'), { code: 'c2', memberId: 'm3', email: 'neha@team.com' }));
    await assertSucceeds(updateDoc(doc(db, 'users', priya.uid), { role: 'manager' }));
    await assertSucceeds(updateDoc(doc(db, 'meta/workspace'), { teamName: 'Renamed' }));
    await assertSucceeds(deleteDoc(doc(db, 'tasks/t2')));
    await assertSucceeds(deleteDoc(doc(db, 'users', aarav.uid)));
  });

  test('cannot demote themselves (the team always keeps a manager)', async () => {
    await assertFails(updateDoc(doc(as(boss), 'users', boss.uid), { role: 'member' }));
  });

  test('a removed colleague loses access immediately', async () => {
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'users', aarav.uid)));
    await assertFails(getDoc(doc(as(aarav), 'tasks/t1')));
    await assertFails(getDocs(collection(as(aarav), 'members')));
  });
});
