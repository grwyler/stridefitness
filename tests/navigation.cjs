const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync('lib/training.ts', 'utf8');
const helper = source.match(/export function normalizeHomeTab\(value:unknown\):NavigationTab \{[\s\S]*?\n\}/)?.[0];
assert.ok(helper, 'navigation preference normalizer exists');
const compiled = ts.transpileModule(helper.replace('export function', 'function'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleBox = { exports: {} };
vm.runInNewContext(`${compiled}\nmodule.exports = { normalizeHomeTab };`, { module: moduleBox });
const { normalizeHomeTab } = moduleBox.exports;

assert.equal(normalizeHomeTab('Overview'), 'Today', 'legacy saved Overview preference opens Today');
assert.equal(normalizeHomeTab('Today'), 'Today', 'new Today preference is retained');
for (const tab of ['Workouts', 'Progress', 'Logs', 'Library']) {
  assert.equal(normalizeHomeTab(tab), tab, `${tab} preference is retained`);
}
for (const stale of [undefined, null, '', 'Workout', 'Admin']) {
  assert.equal(normalizeHomeTab(stale), 'Today', 'invalid preference safely falls back to Today');
}

const page = fs.readFileSync('app/page.tsx', 'utf8');
assert.match(page, /\["Today", LayoutDashboard\]/, 'Today is a persistent navigation item');
assert.match(page, /\["Training", Dumbbell\]/, 'Training is the user-facing workout destination');
assert.match(page, /\["Plans & exercises", Layers\]/, 'plan and exercise area is clearly named');
assert.match(page, /aria-label="Main navigation"/, 'primary navigation is named accessibly');
assert.match(page, /showWorkout\(w\.id\)/, 'recent training opens its selected workout');
assert.match(page, /function openDailyLog[\s\S]*?setTab\("Logs"\)/, 'specific quick-add actions route to Logs');
assert.match(page, /quick-log-workout[\s\S]*?openQuickLog\("workout"\)/, 'workout start remains a distinct quick-add action');
assert.doesNotMatch(page, /area_overview/, 'stale Overview analytics label is removed');

const preferences = fs.readFileSync('components/coach-style.tsx', 'utf8');
assert.match(preferences, /homeTab==='Overview'\?'Today'/, 'legacy preference displays as Today');
assert.match(preferences, /'Today','Training','Progress','Logs','Plans & exercises'/, 'opening preference uses current labels');

console.log('PASS: navigation labels, saved tab compatibility, and task routing.');
