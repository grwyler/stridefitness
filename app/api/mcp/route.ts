import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { accountDataId } from '@/lib/admin-activity';
import { goalProgress, type Goal } from '@/lib/goals';
import { volume as workoutVolume } from '@/lib/training';
import type { Data, Workout } from '@/lib/training';
import { authenticateAccessToken, consumeMcpRateLimit, metadataUrl } from '@/lib/mcp-oauth';

export const runtime = 'edge';
type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
type Args = Record<string, unknown>;
const MODERN_VERSION = '2026-07-28';
const SERVER_META = { 'io.modelcontextprotocol/serverInfo': { name: 'stride-fitness', version: '1.0.0' } };
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const scope = [{ type: 'oauth2', scopes: ['fitness:read'] }];
const tools = [
  { name: 'get_workout_history', title: 'Workout history', description: 'Read completed and planned strength workouts, including exercises, sets, repetitions, loads, RPE, and notes. Use date filters and pagination.', inputSchema: { type: 'object', properties: { startDate: { type: 'string', description: 'Inclusive YYYY-MM-DD' }, endDate: { type: 'string', description: 'Inclusive YYYY-MM-DD' }, status: { type: 'string', enum: ['all', 'completed', 'planned'] }, limit: { type: 'integer', minimum: 1, maximum: 100 }, offset: { type: 'integer', minimum: 0 } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, securitySchemes: scope },
  { name: 'get_exercise_progress', title: 'Exercise progress', description: 'Read recorded exercise history and strength progression. Personal records and estimated one-rep max values are derived only from completed or modified sets and are labeled as estimates.', inputSchema: { type: 'object', properties: { exerciseId: { type: 'string' }, exerciseName: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 100 }, offset: { type: 'integer', minimum: 0 } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, securitySchemes: scope },
  { name: 'get_training_progress', title: 'Training progress', description: 'Summarize completed and planned strength sessions, distinct training days, recorded lifting volume, weekly frequency, and derived exercise records for a date range.', inputSchema: { type: 'object', properties: { startDate: { type: 'string' }, endDate: { type: 'string' } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, securitySchemes: scope },
  { name: 'get_activity_history', title: 'Activity history', description: 'Read logged non-strength activities such as BJJ, walking, running, or classes. Logged activities are separate from planned strength workouts.', inputSchema: { type: 'object', properties: { startDate: { type: 'string' }, endDate: { type: 'string' }, activityType: { type: 'string', description: 'Optional case-insensitive name filter, such as BJJ or jiu-jitsu' }, limit: { type: 'integer', minimum: 1, maximum: 100 }, offset: { type: 'integer', minimum: 0 } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, securitySchemes: scope },
  { name: 'get_nutrition_summary', title: 'Nutrition summary', description: 'Read logged foods and available calorie and macronutrient totals for a date range. Missing values remain null and are not treated as measured zeroes.', inputSchema: { type: 'object', properties: { startDate: { type: 'string' }, endDate: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 100 }, offset: { type: 'integer', minimum: 0 } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, securitySchemes: scope },
  { name: 'get_body_measurements', title: 'Body measurements', description: 'Read weight and body-fat measurements recorded in Stride. Values are returned only when present.', inputSchema: { type: 'object', properties: { startDate: { type: 'string' }, endDate: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 100 }, offset: { type: 'integer', minimum: 0 } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, securitySchemes: scope },
  { name: 'get_fitness_goals', title: 'Fitness goals', description: 'Read active goals and their recorded progress as of a date. Goal values use Stride’s existing goal progress rules.', inputSchema: { type: 'object', properties: { asOf: { type: 'string', description: 'YYYY-MM-DD; defaults to current UTC date' }, includeArchived: { type: 'boolean' } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, securitySchemes: scope },
  { name: 'get_workout_templates', title: 'Workout templates', description: 'Read saved workout templates and their exercise prescriptions. Templates are plans, not completed workouts.', inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100 }, offset: { type: 'integer', minimum: 0 } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, securitySchemes: scope },
  { name: 'get_daily_fitness_summary', title: 'Daily fitness summary', description: 'Read one local calendar day of recorded training, logged activities, nutrition, measurements, and goal progress for a daily journal. Pass the user’s IANA timezone; planned workouts are clearly separated from completed workouts.', inputSchema: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD in the requested timezone; defaults to today there' }, timezone: { type: 'string', description: 'IANA timezone such as America/New_York' } } }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, securitySchemes: scope },
];

function jsonRpc(id: Rpc['id'], result: unknown, headers: HeadersInit = {}, modern = false) {
  const payload = modern && result && typeof result === 'object' ? { ...(result as Record<string, unknown>), resultType: 'complete', _meta: SERVER_META } : result;
  return Response.json({ jsonrpc: '2.0', id: id ?? null, result: payload }, { headers: { 'Cache-Control': 'no-store', ...headers } });
}
function rpcError(id: Rpc['id'], code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });
}
function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized', error_description: 'A Stride fitness:read authorization is required.' }), { status: 401, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl()}", scope="fitness:read"` } });
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !dayPattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function localToday(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function range(args: Args, fallbackDays = 30, timezone = 'UTC') {
  const endDate = args.endDate ?? localToday(timezone);
  const startDate = args.startDate ?? new Date(Date.parse(`${endDate}T00:00:00Z`) - (fallbackDays - 1) * 86400000).toISOString().slice(0, 10);
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) throw new Error('Provide a valid date range with startDate on or before endDate.');
  return { startDate, endDate };
}
function page<T>(rows: T[], args: Args) {
  const limit = Number(args.limit ?? 50), offset = Number(args.offset ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) throw new Error('Use limit from 1 to 100 and a non-negative integer offset.');
  return { items: rows.slice(offset, offset + limit), total: rows.length, limit, offset, hasMore: offset + limit < rows.length };
}
function dateOf(value: unknown) { return typeof value === 'string' ? value.slice(0, 10) : ''; }
async function loadAccount(accountId: string): Promise<Data> {
  const database = (env as unknown as { DB?: D1Database }).DB;
  if (!database) throw new Error('Stride training data is temporarily unavailable.');
  const row = await database.prepare('SELECT data FROM user_training_data WHERE user_id=?').bind(accountId).first<{ data: string }>();
  if (!row) return { user: { id: 'account', name: 'Stride account' }, exercises: [], workouts: [], templates: [], overrides: {}, dark: false };
  return JSON.parse(row.data) as Data;
}
function exerciseNames(data: Data) { return new Map((data.exercises || []).map((exercise) => [exercise.id, exercise.name])); }
function detailedWorkout(workout: Workout, names: Map<string, string>) {
  return { id: workout.id, name: workout.name, date: dateOf(workout.date), status: workout.completed ? 'completed' : 'planned', completed: !!workout.completed, durationMinutes: workout.durationMinutes ?? null, notes: workout.notes || '', exercises: (workout.entries || []).map((entry) => ({ exerciseId: entry.exerciseId, exerciseName: names.get(entry.exerciseId) || null, sets: (entry.sets || []).map((set) => ({ weight: set.weight, reps: set.reps, status: set.status, rpe: set.actualRpe ?? null, rir: set.actualRir ?? null, notes: set.notes || '' })) })) };
}
function toolResult(value: unknown) { const json = JSON.stringify(value); return { content: [{ type: 'text', text: json }], structuredContent: value as Record<string, unknown> }; }
function listedTools(pathname: string) {
  return pathname === '/mcp' ? tools.map((tool) => ({ ...tool, securitySchemes: [{ type: 'noauth' }] })) : tools;
}

async function callTool(name: string, args: Args, data: Data) {
  const names = exerciseNames(data), workouts = data.workouts || [], activities = data.activityEnergy?.logs || [], foods = data.nutrition?.entries || [], measurements = data.bodyMeasurements || [];
  if (name === 'get_workout_history') {
    const { startDate, endDate } = range(args), status = args.status ?? 'all';
    if (!['all', 'completed', 'planned'].includes(String(status))) throw new Error('status must be all, completed, or planned.');
    const rows = workouts.filter((item) => dateOf(item.date) >= startDate && dateOf(item.date) <= endDate && (status === 'all' || (status === 'completed') === !!item.completed)).sort((a, b) => b.date.localeCompare(a.date)).map((item) => detailedWorkout(item, names));
    return { startDate, endDate, ...page(rows, args) };
  }
  if (name === 'get_exercise_progress') {
    const queryId = typeof args.exerciseId === 'string' ? args.exerciseId : '', queryName = typeof args.exerciseName === 'string' ? args.exerciseName.trim().toLowerCase() : '';
    if (!queryId && !queryName) throw new Error('Provide exerciseId or exerciseName.');
    const exercise = (data.exercises || []).find((item) => queryId ? item.id === queryId : item.name.toLowerCase() === queryName);
    if (!exercise) return { exercise: null, history: [], personalRecords: null };
    const { startDate, endDate } = range(args, 365), rows = workouts.filter((w) => w.completed && dateOf(w.date) >= startDate && dateOf(w.date) <= endDate).flatMap((w) => (w.entries || []).filter((e) => e.exerciseId === exercise.id).map((e) => ({ date: dateOf(w.date), workoutId: w.id, workoutName: w.name, sets: e.sets.filter((s) => s.status === 'completed' || s.status === 'modified').map((s) => ({ weight: s.weight, reps: s.reps, rpe: s.actualRpe ?? null, rir: s.actualRir ?? null, status: s.status, volume: s.weight * s.reps, estimatedOneRepMax: s.weight > 0 && s.reps > 0 ? Math.round(s.weight * (1 + (s.reps - 1) / 30)) : null })) }))).sort((a, b) => b.date.localeCompare(a.date));
    const sets = rows.flatMap((row) => row.sets.map((set) => ({ ...set, date: row.date, workoutId: row.workoutId })));
    const personalRecords = { maxRecordedWeight: Math.max(0, ...sets.map((s) => s.weight)), maxEstimatedOneRepMax: Math.max(0, ...sets.map((s) => s.estimatedOneRepMax || 0)), maxSetVolume: Math.max(0, ...sets.map((s) => s.volume)), recordsAreDerivedEstimates: true };
    return { exercise: { id: exercise.id, name: exercise.name }, startDate, endDate, personalRecords, history: page(rows, args) };
  }
  if (name === 'get_training_progress') {
    const { startDate, endDate } = range(args, 90), rangeWorkouts = workouts.filter((item) => dateOf(item.date) >= startDate && dateOf(item.date) <= endDate), completed = rangeWorkouts.filter((item) => item.completed), planned = rangeWorkouts.filter((item) => !item.completed);
    const daily = new Map<string, { completedWorkouts: number; plannedWorkouts: number; liftingVolume: number }>();
    for (const workout of rangeWorkouts) {
      const day = dateOf(workout.date), current = daily.get(day) || { completedWorkouts: 0, plannedWorkouts: 0, liftingVolume: 0 };
      if (workout.completed) { current.completedWorkouts += 1; current.liftingVolume += workoutVolume(workout); } else current.plannedWorkouts += 1;
      daily.set(day, current);
    }
    const prs = new Map<string, { exerciseId: string; exerciseName: string | null; maxRecordedWeight: number; maxEstimatedOneRepMax: number }>();
    for (const workout of completed) for (const entry of workout.entries || []) for (const set of entry.sets || []) {
      if (set.status !== 'completed' && set.status !== 'modified') continue;
      const current = prs.get(entry.exerciseId) || { exerciseId: entry.exerciseId, exerciseName: names.get(entry.exerciseId) || null, maxRecordedWeight: 0, maxEstimatedOneRepMax: 0 };
      const e1rm = set.weight > 0 && set.reps > 0 ? Math.round(set.weight * (1 + (set.reps - 1) / 30)) : 0;
      current.maxRecordedWeight = Math.max(current.maxRecordedWeight, set.weight);
      current.maxEstimatedOneRepMax = Math.max(current.maxEstimatedOneRepMax, e1rm);
      prs.set(entry.exerciseId, current);
    }
    const days = Math.max(1, (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 + 1);
    return { startDate, endDate, completedWorkoutCount: completed.length, plannedWorkoutCount: planned.length, completedTrainingDays: new Set(completed.map((item) => dateOf(item.date))).size, completedSessionsPerWeek: Math.round(completed.length / (days / 7) * 10) / 10, liftingVolumePoundReps: completed.reduce((sum, item) => sum + workoutVolume(item), 0), dailyTraining: [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, ...value })), exerciseRecords: [...prs.values()].sort((a, b) => (a.exerciseName || '').localeCompare(b.exerciseName || '')).map((row) => ({ ...row, estimatedOneRepMaxIsDerived: true })) };
  }
  if (name === 'get_activity_history') {
    const { startDate, endDate } = range(args), filter = typeof args.activityType === 'string' ? args.activityType.toLowerCase() : '';
    const rows = activities.filter((item) => item.date >= startDate && item.date <= endDate && (!filter || item.name.toLowerCase().includes(filter))).sort((a, b) => b.date.localeCompare(a.date));
    const bjj = rows.filter((item) => /jiu.?jitsu|\bbjj\b/i.test(item.name));
    return { startDate, endDate, ...page(rows, args), bjjSessionCount: bjj.length, recordedActivityMinutes: rows.reduce((sum, item) => sum + item.durationMinutes, 0) };
  }
  if (name === 'get_nutrition_summary') {
    const { startDate, endDate } = range(args), rows = foods.filter((item) => item.date >= startDate && item.date <= endDate).sort((a, b) => b.date.localeCompare(a.date));
    return { startDate, endDate, entryCount: rows.length, totals: { calories: rows.some((item) => item.calories == null) ? null : rows.reduce((sum, item) => sum + (item.calories || 0), 0), proteinGrams: rows.some((item) => item.protein == null) ? null : Math.round(rows.reduce((sum, item) => sum + (item.protein || 0), 0) * 10) / 10, carbsGrams: rows.some((item) => item.carbs == null) ? null : Math.round(rows.reduce((sum, item) => sum + (item.carbs || 0), 0) * 10) / 10, fatGrams: rows.some((item) => item.fat == null) ? null : Math.round(rows.reduce((sum, item) => sum + (item.fat || 0), 0) * 10) / 10 }, calorieTarget: data.nutrition?.calorieTarget ?? null, proteinTargetGrams: data.nutrition?.proteinTarget ?? null, foods: page(rows, args) };
  }
  if (name === 'get_body_measurements') {
    const { startDate, endDate } = range(args, 365), rows = measurements.filter((item) => item.date >= startDate && item.date <= endDate).sort((a, b) => b.date.localeCompare(a.date));
    return { startDate, endDate, ...page(rows, args) };
  }
  if (name === 'get_fitness_goals') {
    const asOf = args.asOf ?? localToday('UTC'); if (!validDate(asOf)) throw new Error('asOf must be a valid YYYY-MM-DD date.');
    const goals = (data.goals || []).filter((goal) => args.includeArchived === true || !goal.archived).map((goal) => ({ ...goal, progress: goalProgress(goal as Goal, data, asOf) }));
    return { asOf, goals };
  }
  if (name === 'get_workout_templates') {
    const rows = (data.templates || []).map((template) => ({ id: template.id, name: template.name, description: template.description || '', exercises: (template.entries || []).map((entry) => ({ exerciseId: entry.exerciseId, exerciseName: names.get(entry.exerciseId) || null, sets: entry.sets, reps: entry.reps, weight: entry.weight, repScheme: entry.repScheme || null, setPrescriptions: entry.setPrescriptions || null })) }));
    return { ...page(rows, args), kind: 'planned_templates' };
  }
  if (name === 'get_daily_fitness_summary') {
    const timezone = typeof args.timezone === 'string' ? args.timezone : 'UTC';
    try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date()); } catch { throw new Error('timezone must be a valid IANA timezone.'); }
    const date = args.date ?? localToday(timezone); if (!validDate(date)) throw new Error('date must be a valid YYYY-MM-DD date in the requested timezone.');
    const dayWorkouts = workouts.filter((item) => dateOf(item.date) === date), completedWorkouts = dayWorkouts.filter((item) => item.completed).map((item) => detailedWorkout(item, names)), plannedWorkouts = dayWorkouts.filter((item) => !item.completed).map((item) => detailedWorkout(item, names));
    const loggedActivities = activities.filter((item) => item.date === date), bjjSessions = loggedActivities.filter((item) => /jiu.?jitsu|\bbjj\b/i.test(item.name));
    const dayFoods = foods.filter((item) => item.date === date), nutritionTotals = { entryCount: dayFoods.length, calories: dayFoods.some((item) => item.calories == null) ? null : dayFoods.reduce((sum, item) => sum + (item.calories || 0), 0), proteinGrams: dayFoods.some((item) => item.protein == null) ? null : Math.round(dayFoods.reduce((sum, item) => sum + (item.protein || 0), 0) * 10) / 10, carbsGrams: dayFoods.some((item) => item.carbs == null) ? null : Math.round(dayFoods.reduce((sum, item) => sum + (item.carbs || 0), 0) * 10) / 10, fatGrams: dayFoods.some((item) => item.fat == null) ? null : Math.round(dayFoods.reduce((sum, item) => sum + (item.fat || 0), 0) * 10) / 10 };
    const dayMeasurements = measurements.filter((item) => item.date === date), activeGoals = (data.goals || []).filter((goal) => !goal.archived).map((goal) => ({ id: goal.id, title: goal.title, progress: goalProgress(goal as Goal, data, date) }));
    const prior7 = new Date(Date.parse(`${date}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10), recentCompleted = workouts.filter((item) => item.completed && dateOf(item.date) >= prior7 && dateOf(item.date) <= date).length;
    return { date, timezone, workoutStatus: { completed: completedWorkouts, planned: plannedWorkouts }, loggedActivities, bjjSessions, nutrition: nutritionTotals, bodyMeasurements: dayMeasurements, activeGoals, trainingTrend: { completedWorkoutCountLast7Days: recentCompleted }, factualDataOnly: true };
  }
  throw new Error(`Unknown tool: ${name}`);
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && ![new URL(request.url).origin, 'https://chatgpt.com', 'https://chat.openai.com'].includes(origin)) return new Response('Forbidden origin', { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 1_000_000) return new Response('Request too large', { status: 413 });
  let rpc: Rpc;
  try { rpc = await request.json() as Rpc; } catch { return rpcError(null, -32700, 'Invalid JSON.', 400); }
  if (rpc.jsonrpc !== '2.0' || !rpc.method) return rpcError(rpc.id, -32600, 'Invalid JSON-RPC request.', 400);
  const method = rpc.method;
  const params = rpc.params || {}, requestMeta = params._meta && typeof params._meta === 'object' ? params._meta as Record<string, unknown> : null;
  const bodyVersion = requestMeta?.['io.modelcontextprotocol/protocolVersion'];
  const headerVersion = request.headers.get('MCP-Protocol-Version');
  const modern = bodyVersion === MODERN_VERSION || headerVersion === MODERN_VERSION || method === 'server/discover';
  if (modern) {
    if (!requestMeta || requestMeta['io.modelcontextprotocol/protocolVersion'] !== MODERN_VERSION || !requestMeta['io.modelcontextprotocol/clientCapabilities'] || typeof requestMeta['io.modelcontextprotocol/clientCapabilities'] !== 'object') return rpcError(rpc.id, -32602, 'Modern MCP requests require protocolVersion and clientCapabilities in params._meta.', 400);
    if (headerVersion && headerVersion !== MODERN_VERSION) return rpcError(rpc.id, -32020, 'MCP-Protocol-Version does not match the request envelope.', 400);
    if (request.headers.get('Mcp-Method') && request.headers.get('Mcp-Method') !== method) return rpcError(rpc.id, -32020, 'Mcp-Method does not match the JSON-RPC method.', 400);
    const principalName = method === 'tools/call' ? params.name : undefined;
    if (request.headers.get('Mcp-Name') && request.headers.get('Mcp-Name') !== principalName) return rpcError(rpc.id, -32020, 'Mcp-Name does not match the JSON-RPC request.', 400);
  }
  if (modern && method === 'initialize') return rpcError(rpc.id, -32601, 'initialize is not part of the stateless MCP protocol.', 400);
  if (method === 'initialize') {
    const version = rpc.params?.protocolVersion;
    const supported = ['2025-03-26', '2025-06-18', '2025-11-25'];
    return jsonRpc(rpc.id, { protocolVersion: supported.includes(String(version)) ? version : '2025-11-25', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'stride-fitness', version: '1.0.0' }, instructions: 'Read-only access to the connected Stride account. Use get_daily_fitness_summary(date, timezone) for a factual daily journal summary. Planned workouts and recorded activities are reported separately.' }, { 'MCP-Protocol-Version': supported.includes(String(version)) ? String(version) : '2025-11-25' });
  }
  if (method === 'server/discover') return jsonRpc(rpc.id, { supportedVersions: [MODERN_VERSION, '2025-11-25', '2025-06-18', '2025-03-26'], capabilities: { tools: { listChanged: false } }, instructions: 'Read-only access to the connected Stride account. Use get_daily_fitness_summary(date, timezone) for a factual daily journal summary.', ttlMs: 3600000, cacheScope: 'public' }, {}, true);
  if (method === 'notifications/initialized') return new Response(null, { status: 202 });
  if (method === 'ping') return jsonRpc(rpc.id, {});
  if (method === 'tools/list') return jsonRpc(rpc.id, modern ? { tools: listedTools(new URL(request.url).pathname), ttlMs: 300000, cacheScope: 'public' } : { tools: listedTools(new URL(request.url).pathname) }, modern ? { 'MCP-Protocol-Version': MODERN_VERSION } : {}, modern);
  if (method !== 'tools/call') return rpcError(rpc.id, -32601, 'Method not found.');
  const auth = await authenticateAccessToken(request);
  let accountId = auth?.account_id, rateLimitId = auth?.grant_id;
  if (!auth && new URL(request.url).pathname === '/mcp') {
    const user = await getChatGPTUser(request);
    if (user) { accountId = await accountDataId(user); rateLimitId = `site:${accountId}`; }
  }
  if (!accountId || (auth && !auth.scope.split(/\s+/).includes('fitness:read'))) return unauthorized();
  if (!await consumeMcpRateLimit(rateLimitId || accountId)) return new Response(JSON.stringify({ error: 'rate_limited', error_description: 'Stride MCP allows up to 60 read requests per minute.' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '60' } });
  const name = String(params.name || ''), args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Args;
  try {
    if (!tools.some((tool) => tool.name === name)) return rpcError(rpc.id, -32602, 'Unknown tool.');
    const data = await loadAccount(accountId), result = await callTool(name, args, data);
    return jsonRpc(rpc.id, modern ? { ...toolResult(result), isError: false } : toolResult(result), modern ? { 'MCP-Protocol-Version': MODERN_VERSION } : {}, modern);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read Stride fitness data.';
    return jsonRpc(rpc.id, modern ? { content: [{ type: 'text', text: message }], isError: true } : { content: [{ type: 'text', text: message }], isError: true }, modern ? { 'MCP-Protocol-Version': MODERN_VERSION } : {}, modern);
  }
}
export async function GET() { return new Response(null, { status: 405, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }); }
export function OPTIONS(request: Request) {
  const origin = request.headers.get('origin'), allowed = origin && ['https://chatgpt.com', 'https://chat.openai.com'].includes(origin) ? origin : new URL(request.url).origin;
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version', 'Access-Control-Expose-Headers': 'MCP-Protocol-Version, WWW-Authenticate', Vary: 'Origin' } });
}
