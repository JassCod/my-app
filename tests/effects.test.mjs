// Guards against a crash seen in newer Chrome: an effect written as `useEffect(() => someCall(), …)`
// hands someCall's return value to React as the cleanup. When that value is not a function
// (e.g. window.scrollTo now returns a Promise), React calls it on the next page change and crashes
// with "x is not a function". Effects must use a block body unless they return a real unsubscribe.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ALLOWED = [/onAuthStateChanged\(/, /^\(\) =>/]; // returns an unsubscribe function / returns a cleanup arrow
const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : /\.tsx?$/.test(f) ? [join(dir, f)] : []));

test('effects never return a non-function by accident', () => {
  const bad = [];
  for (const file of files('src')) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      const m = line.match(/use(?:Layout)?Effect\(\(\) => (?!\{)(.*)/);
      if (m && !ALLOWED.some((re) => re.test(m[1]))) bad.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(bad, [], 'Use a block body: useEffect(() => { ... }, deps)');
});
