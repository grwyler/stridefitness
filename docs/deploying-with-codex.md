# Deploying this repository with Codex

This repository is the source for the Stride Fitness Tracker Site. Its Sites project ID is stored in `.openai/hosting.json`; read that file and use its exact `project_id` for every Sites call. The current production audience is public. Preserve the audience returned by `sites.get_site` unless the user explicitly requests an access change.

## Before changing branches or publishing

1. Run `git status --short --branch`, inspect the diff, and check the current branch and configured remotes. Preserve all user changes, including untracked files that belong to the requested feature.
2. For an existing hosted Site, call `sites.get_site` and `sites.create_source_repository_write_credential` for the manifest's project ID. Keep the credential only in session memory; never print it, put it in a command argument, or save it in a file.
3. If the user names a branch, confirm that exact branch exists on a configured remote before merging. Fetch it, inspect its commits and diff against `main`, and merge only after checking for conflicts. Do not infer that `platform-origin/main` is `origin/develop`, or substitute a similarly named branch. Never force-push or reset away local work.
4. Open the existing Site source with the Sites source workflow before editing. Launch `node <sites-plugin-root>/scripts/site-workflow.mjs --project-id <project_id>` in a TTY. Send one JSON object through hidden stdin after the ready prompt. For opening, pass `{ "credential": <credential> }` and omit `archivePath`. Retain the complete successful opening result and its `checkout_path`; use that same source result for publishing. If the workflow reports that remote source advanced while edits are present, stop and reconcile the histories while preserving the local diff before retrying.

Find `<sites-plugin-root>` from the installed Sites skill/tool environment; do not hard-code a versioned cache path. Use the native Sites tools for `get_site`, credential creation, saving, deployment, and status.

## Build, commit, and package

Run only checks appropriate to the change; run lint only when requested. This project uses Vinext and builds a Cloudflare Worker. Build with:

```powershell
pnpm run build
```

On portable Windows, running the plugin's `build-site.mjs` from inside the workflow has failed with `The system cannot find the path specified.` Run the command above directly, then omit completed build commands from the workflow input.

For publication, rerun the source workflow from the selected Site checkout. Pass the opening result as `source`, the credential, the absolute archive path, and remaining commands (if any). Use the ignored `outputs/` directory for the archive; `site-deploy.tar.gz` in the repository root is a tracked historical artifact and is not a valid output destination:

```json
{
  "credential": "<credential object>",
  "source": "<complete opening result>",
  "commands": [],
  "archivePath": "<absolute path to outputs/site-deploy.tar.gz>"
}
```

The actual JSON values for `credential` and `source` are objects, not quoted placeholders. Keep the input on hidden stdin. The successful result must include a verified `commit_sha` and archive path. The workflow stages and commits the Site source, then pushes its configured source branch. Do not use its commit SHA for publication unless the workflow confirms it.

### Packaging troubleshooting

The current Sites helper packages with Node.js and `tar`/`tar.exe`. If an older installed helper fails on Windows with a Bash path error, the source commit may already have been pushed before packaging failed. If that happens:

1. Read the workflow error, then inspect `git status`, `git rev-parse HEAD`, and the source branch state. The commit/push happens before packaging, so do not blindly rerun the whole workflow or create a second commit. Continue only after confirming the source tree is clean and `HEAD` is the pushed source commit.
2. Use the plugin's `skills/sites/scripts/prepare-site-build.cjs` helper to copy the Worker output into a staging directory inside the repository. The following PowerShell commands mirror Worker packaging; set `$pluginRoot` to the installed Sites plugin directory first:

```powershell
$root = (Get-Location).Path
$stage = Join-Path $root '.package-stage\site-workflow'
$dist = Join-Path $stage 'dist'
New-Item -ItemType Directory -Force $stage | Out-Null
node (Join-Path $pluginRoot 'skills\sites\scripts\prepare-site-build.cjs') $root $dist
New-Item -ItemType Directory -Force (Join-Path $dist '.openai') | Out-Null
Copy-Item -LiteralPath (Join-Path $root '.openai\hosting.json') -Destination (Join-Path $dist '.openai\hosting.json') -Force
if (Test-Path (Join-Path $root 'drizzle')) {
  Copy-Item -LiteralPath (Join-Path $root 'drizzle') -Destination (Join-Path $dist '.openai\drizzle') -Recurse -Force
}
$output = Join-Path $root 'outputs'
New-Item -ItemType Directory -Force $output | Out-Null
$archive = Join-Path $output 'site-deploy.tar.gz'
tar.exe -czf $archive -C $stage dist
$entries = tar.exe -tzf $archive
if ($entries -notcontains 'dist/.openai/hosting.json') { throw 'The deployment archive is missing its hosting manifest.' }
```

The archive contains build output, not the project source tree. Keep it unchanged until `sites.save_site_version` succeeds. Afterward, remove only temporary staging/output artifacts created for this deployment and verify `git status` before finishing.

## Save, deploy, and push

1. Save the built archive against the verified pushed source commit with `sites.save_site_version({ project_id, commit_sha, archive })`.
2. Preserve the audience from `get_site`. This Site is public, so deploy with `sites.deploy_site_version({ project_id, version_id })`. For a Site confirmed owner-private, use `sites.save_version_and_deploy_private` instead of saving and deploying separately. Never change access to make deployment work.
3. If deployment is `pending`, `building`, or `publishing`, poll `sites.get_deployment_status` with the returned deployment ID. Report the production URL from the successful result.
4. If the user asked to push to GitHub, push the same committed `main` history to `origin/main` after deployment. Do not assume the Sites source repository and GitHub `origin` are interchangeable; each must be handled with its own configured remote. Verify `HEAD`, `origin/main`, and `git status` when finished.

For MCP tool changes, deploying the Site updates the server implementation but does not refresh tool metadata already cached in the OpenAI Plugins portal. After production deployment, reconnect or rescan the MCP server there, then verify the live tool list and annotations. Verify that all value-replacing tools (`update_fitness_profile`, `set_nutrition_targets`, `update_fitness_goal`, `update_workout_plan`, `edit_workout_plan_exercises`, and `add_body_measurement`) report `destructiveHint: true`, and that the unsupported `archive_workout_plan` tool is absent. In particular, `add_body_measurement` can replace an existing same-date check-in and affect profile bodyweight. Tool definitions are scanned from the hosted endpoint; a package ZIP upload does not refresh them.

If the workflow or Git reports divergent/advanced source history, preserve both sides and reconcile before saving a version. Never force-push, discard changes, publish an archive built from a different commit, or claim deployment succeeded without a successful Sites result.
