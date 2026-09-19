import { env } from "cloudflare:workers";
import { z } from "zod";

export const runtime = "edge";

type RpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: unknown };
type StoredData = {
  nutrition?: { entries?: unknown[]; calorieTarget?: number | null; proteinTarget?: number | null; carbTarget?: number | null; fatTarget?: number | null; activityCalorieAdjustment?: 0 | 50 | 100; hydration?: unknown };
  activityEnergy?: { templates?: unknown[]; logs?: unknown[] };
  bodyMeasurements?: { date: string; weight: number | null }[];
};

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const foodInput = z.object({
  name: z.string().trim().min(1).max(100),
  date: date.optional(),
  calories: z.number().finite().min(0).max(10000).nullable().optional(),
  proteinGrams: z.number().finite().min(0).max(1000).nullable().optional(),
  carbsGrams: z.number().finite().min(0).max(2000).nullable().optional(),
  fatGrams: z.number().finite().min(0).max(1000).nullable().optional(),
});
const activityInput = z.object({
  name: z.string().trim().min(1).max(100),
  date: date.optional(),
  durationMinutes: z.number().int().min(1).max(1440),
  intensity: z.enum(["Light", "Moderate", "Vigorous"]),
  met: z.number().finite().min(1).max(18).optional(),
  caloriesBurned: z.number().finite().min(0).max(20000).optional(),
  notes: z.string().max(500).optional(),
});
const summaryInput = z.object({ date: date.optional() });

const tools = [
  {
    name: "log_food",
    title: "Log food",
    description: "Use this when the user asks to save a food or meal in their Stride food log. Only log nutrition values the user supplied or explicitly asked you to estimate.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD; omit for today" }, calories: { type: ["number", "null"] }, proteinGrams: { type: ["number", "null"] }, carbsGrams: { type: ["number", "null"] }, fatGrams: { type: ["number", "null"] } }, required: ["name"] },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "log_activity",
    title: "Log activity",
    description: "Use this when the user asks to save a non-strength activity such as a walk, run, ride, class, or sport in their Stride activity log.",
    inputSchema: { type: "object", properties: { name: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD; omit for today" }, durationMinutes: { type: "integer" }, intensity: { type: "string", enum: ["Light", "Moderate", "Vigorous"] }, met: { type: "number", description: "Optional MET estimate" }, caloriesBurned: { type: "number", description: "Optional user-supplied calorie value" }, notes: { type: "string" } }, required: ["name", "durationMinutes", "intensity"] },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "get_daily_log_summary",
    title: "Get daily log summary",
    description: "Use this when the user asks what food or activities they have logged for a day.",
    inputSchema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD; omit for today" } } },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
];

function today() { return new Date().toISOString().slice(0, 10); }
const mcpHeaders = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "https://chatgpt.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "MCP-Protocol-Version, MCP-Session-Id",
};
function response(id: RpcRequest["id"], result: unknown, status = 200) { return Response.json({ jsonrpc: "2.0", id: id ?? null, result }, { status, headers: mcpHeaders }); }
function error(id: RpcRequest["id"], code: number, message: string, status = 200) { return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status, headers: mcpHeaders }); }
function textResult(value: string, structuredContent?: Record<string, unknown>) { return { content: [{ type: "text", text: value }], ...(structuredContent ? { structuredContent } : {}) }; }

async function dataStore() {
  const config = env as unknown as { DB?: D1Database; MCP_LOG_TOKEN?: string; MCP_ACCOUNT_ID?: string };
  if (!config.DB || !config.MCP_LOG_TOKEN || !config.MCP_ACCOUNT_ID) throw new Error("MCP logging is not configured.");
  return { db: config.DB, accountId: config.MCP_ACCOUNT_ID };
}

async function readData(db: D1Database, accountId: string): Promise<StoredData> {
  const row = await db.prepare("SELECT data FROM user_training_data WHERE user_id = ?").bind(accountId).first<{ data: string }>();
  if (!row) throw new Error("No synced Stride account data was found for this MCP connection.");
  return JSON.parse(row.data) as StoredData;
}
async function saveData(db: D1Database, accountId: string, data: StoredData) {
  await db.prepare("UPDATE user_training_data SET data = ?, updated_at = ? WHERE user_id = ?").bind(JSON.stringify(data), new Date().toISOString(), accountId).run();
}
function knownWeight(data: StoredData, day: string) {
  return (data.bodyMeasurements || []).filter((item) => item.date <= day && item.weight && item.weight > 0).sort((a, b) => b.date.localeCompare(a.date))[0]?.weight ?? null;
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const config = env as unknown as { MCP_LOG_TOKEN?: string };
  const { token } = await context.params;
  if (!config.MCP_LOG_TOKEN || token !== config.MCP_LOG_TOKEN) return new Response("Not found", { status: 404 });
  let rpc: RpcRequest;
  try { rpc = await request.json() as RpcRequest; } catch { return error(null, -32700, "Invalid JSON.", 400); }
  if (rpc.jsonrpc !== "2.0" || !rpc.method) return error(rpc.id, -32600, "Invalid JSON-RPC request.");
  if (rpc.method === "initialize") {
    const requestedVersion = (rpc.params as { protocolVersion?: unknown } | undefined)?.protocolVersion;
    return response(rpc.id, { protocolVersion: typeof requestedVersion === "string" ? requestedVersion : "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "stride-food-activity", version: "1.0.0" }, instructions: "Use these tools only to log food or non-strength activities the user explicitly asks to save. Confirm missing details before logging; do not invent nutritional values." });
  }
  if (rpc.method === "notifications/initialized") return new Response(null, { status: 202 });
  if (rpc.method === "tools/list") return response(rpc.id, { tools });
  if (rpc.method !== "tools/call") return error(rpc.id, -32601, "Method not found.");
  const call = rpc.params as { name?: string; arguments?: unknown };
  try {
    const { db, accountId } = await dataStore();
    const data = await readData(db, accountId);
    if (call.name === "log_food") {
      const input = foodInput.parse(call.arguments ?? {}), day = input.date ?? today();
      const nutrition = data.nutrition ?? { entries: [], calorieTarget: null, proteinTarget: null, carbTarget: null, fatTarget: null, activityCalorieAdjustment: 0, hydration: { dailyTargetOz: null, entries: [] } };
      const entry = { id: crypto.randomUUID(), date: day, name: input.name, calories: input.calories ?? null, protein: input.proteinGrams ?? null, carbs: input.carbsGrams ?? null, fat: input.fatGrams ?? null };
      data.nutrition = { ...nutrition, entries: [...(nutrition.entries ?? []), entry] };
      await saveData(db, accountId, data);
      return response(rpc.id, textResult(`Logged ${entry.name} for ${day}.`, { entry }));
    }
    if (call.name === "log_activity") {
      const input = activityInput.parse(call.arguments ?? {}), day = input.date ?? today();
      const met = input.met ?? ({ Light: 2.5, Moderate: 4.5, Vigorous: 7 } as const)[input.intensity];
      const weight = knownWeight(data, day);
      const calories = input.caloriesBurned ?? (weight ? Math.max(5, Math.round((met * 3.5 * (weight / 2.2046226218) / 200 * input.durationMinutes) / 5) * 5) : 0);
      const activity = data.activityEnergy ?? { templates: [], logs: [] };
      const entry = { id: crypto.randomUUID(), name: input.name, date: day, durationMinutes: input.durationMinutes, intensity: input.intensity, met, caloriesBurned: calories, calorieSource: input.caloriesBurned === undefined ? "estimate" : "manual", energyWeightLb: weight, notes: input.notes ?? "" };
      data.activityEnergy = { ...activity, logs: [...(activity.logs ?? []), entry] };
      await saveData(db, accountId, data);
      return response(rpc.id, textResult(`Logged ${entry.name}: ${entry.durationMinutes} minutes on ${day}.`, { entry }));
    }
    if (call.name === "get_daily_log_summary") {
      const input = summaryInput.parse(call.arguments ?? {}), day = input.date ?? today();
      const foods = ((data.nutrition?.entries ?? []) as { date?: string; calories?: number | null; protein?: number | null }[]).filter((entry) => entry.date === day);
      const activities = ((data.activityEnergy?.logs ?? []) as { date?: string; caloriesBurned?: number; durationMinutes?: number }[]).filter((entry) => entry.date === day);
      const summary = { date: day, foodCount: foods.length, calories: foods.reduce((total, entry) => total + (entry.calories ?? 0), 0), proteinGrams: foods.reduce((total, entry) => total + (entry.protein ?? 0), 0), activityCount: activities.length, activityMinutes: activities.reduce((total, entry) => total + (entry.durationMinutes ?? 0), 0), activityCalories: activities.reduce((total, entry) => total + (entry.caloriesBurned ?? 0), 0) };
      return response(rpc.id, textResult(`${day}: ${summary.foodCount} food entries and ${summary.activityCount} activities logged.`, summary));
    }
    return error(rpc.id, -32602, "Unknown tool.");
  } catch (cause) {
    const message = cause instanceof z.ZodError ? cause.issues.map((issue) => issue.message).join(" ") : cause instanceof Error ? cause.message : "Unable to process the log.";
    return response(rpc.id, { content: [{ type: "text", text: message }], isError: true });
  }
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const config = env as unknown as { MCP_LOG_TOKEN?: string };
  const { token } = await context.params;
  if (!config.MCP_LOG_TOKEN || token !== config.MCP_LOG_TOKEN) return new Response("Not found", { status: 404 });
  return Response.json({ name: "Stride food & activity MCP", endpoint: new URL(request.url).pathname, transport: "streamable-http" }, { headers: mcpHeaders });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: mcpHeaders });
}
