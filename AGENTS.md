# Repository guidance for agents

This repository is the source for the deployed Stride Site. Before handling a request to publish, deploy, or push changes, read [the deployment guide](docs/deploying-with-codex.md) and follow it. Preserve the Site's configured project ID and current audience. Never discard local work or force-push to resolve a source-branch mismatch.

After changing the hosted Site, publish the completed change unless the user explicitly requests local-only work or asks to save without deploying. If the user asks to commit or push, include the requested local changes and push the resulting commit to the requested Git remote and branch.
