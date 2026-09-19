# Stride food & activity MCP

This is a private, tool-only MCP server for one Stride account. It adds three ChatGPT tools: `log_food`, `log_activity`, and `get_daily_log_summary`. Logged items are saved into the same synced data used by Stride.

## Configure before deployment

Set these Worker secrets on the deployed Stride project. Do not commit either value.

* `MCP_LOG_TOKEN` — create a long random string (at least 32 bytes). It is used only in the private MCP URL.
* `MCP_ACCOUNT_ID` — the Stride account-data ID for the account to receive logs. Sign into Stride and let it complete one sync, then while still signed in open `https://YOUR-STRIDE-DOMAIN/api/training-data`; use the returned `accountId` value.

The connection URL is:

`https://YOUR-STRIDE-DOMAIN/api/mcp/YOUR_MCP_LOG_TOKEN`

Treat it as a password: anyone who has the complete URL can read daily totals and add food/activity entries to that configured account. Rotate `MCP_LOG_TOKEN` immediately if it is exposed. This private, single-account design intentionally avoids a shared unauthenticated log store; a multi-user public version should use OAuth 2.1.

## Connect in ChatGPT

1. Deploy Stride so the URL above is publicly reachable over HTTPS.
2. In ChatGPT, turn on **Settings → Security and login → Developer mode**.
3. Open **ChatGPT Plugins**, use the plus button, and paste the private MCP URL.
4. Install the created personal plugin, start a new **Work** chat, then type `@` and select it.
5. Try: “Log a chicken burrito: 650 calories, 42 g protein” or “Log a 35 minute moderate walk.”

After a log is created, refresh Stride if it was already open so it fetches the newer synced data. The endpoint supports the MCP streamable HTTP request shape at the private URL; inspect it with MCP Inspector before relying on it for daily use.

## Tool behavior

Food values are nullable: the tool saves only values supplied in the conversation. Activity calorie burn is only estimated when Stride has a body weight recorded on or before the entry date; otherwise it is stored as zero unless the user supplies calories. Strength workouts remain in Stride and are not duplicated by `log_activity`.
