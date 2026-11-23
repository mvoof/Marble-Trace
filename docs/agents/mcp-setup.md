# Tauri MCP for app checks

The repository already contains both sides of the Tauri MCP bridge:

- The client-side stdio server is pinned in the root [`.mcp.json`](../../.mcp.json)
  as `npx -y @hypothesi/tauri-mcp-server@0.13.0`.
- The app-side bridge is registered for the `dev` feature in
  `src-tauri/src/lib.rs`; `withGlobalTauri` and `mcp-bridge:default` permission
  are already configured.

The client starts the MCP server. Start the app separately with
`npm run tauri:dev`. Then use the MCP tool `driver_session` to start a session
on port `9223`; use `webview_screenshot`, `webview_find_element`, and
`webview_interact` to inspect and operate the running app.

## Configure your agent

MCP settings belong to each agent client. Claude Code reads the root `.mcp.json`;
other clients may use a different config file or require a CLI command. Use the
same pinned server command in each client.

| Client                    | Setup                                                                                                                                                 | Verify                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Claude Code               | The root `.mcp.json` is already configured. Open Claude Code in this repository, trust the folder, then approve `tauri-mcp` when prompted.            | Run `/mcp` or `claude mcp list`; `claude mcp get tauri-mcp` shows the server details.           |
| Codex                     | Run `codex mcp add tauri-mcp -- npx -y @hypothesi/tauri-mcp-server@0.13.0`. This adds it to your Codex user config.                                   | Run `codex mcp list`, then restart Codex or open a new conversation.                            |
| GitHub Copilot CLI        | Run `copilot mcp add tauri-mcp -- npx -y @hypothesi/tauri-mcp-server@0.13.0`.                                                                         | Run `/mcp` or `copilot mcp list`.                                                               |
| GitHub Copilot in VS Code | Open Chat: Open Customizations → MCP Servers → Add Server. Choose STDIO, command `npx`, arguments `-y @hypothesi/tauri-mcp-server@0.13.0`, then save. | Check that `tauri-mcp` is enabled in MCP Servers.                                               |
| Cursor                    | Add the entry below in Cursor Settings → MCP, or put it in `.cursor/mcp.json` for this repository.                                                    | Check the MCP server status in Cursor Settings → MCP, then restart Cursor if it has not loaded. |
| Gemini CLI                | Run `gemini mcp add --scope user tauri-mcp npx -y @hypothesi/tauri-mcp-server@0.13.0`.                                                                | Run `gemini mcp list`, then restart Gemini CLI.                                                 |
| OpenCode                  | Run `opencode mcp add tauri-mcp -- npx -y @hypothesi/tauri-mcp-server@0.13.0`. This adds it to the current project.                                   | Run `opencode mcp list`.                                                                        |
| Windsurf                  | In Cascade, open MCPs → settings and add a local stdio server using command `npx` and arguments `-y @hypothesi/tauri-mcp-server@0.13.0`.              | Check that the server is enabled in MCP settings.                                               |

Cursor's stdio entry is:

```json
{
  "mcpServers": {
    "tauri-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@hypothesi/tauri-mcp-server@0.13.0"]
    }
  }
}
```

For another MCP-compatible client, configure a local stdio server with command
`npx` and arguments `-y @hypothesi/tauri-mcp-server@0.13.0`. Its config location
and workspace approval are client-specific; follow that client's MCP guide.

## Run an app check

1. Start Marble Trace with `npm run tauri:dev` and wait for its windows to open.
2. In the agent session, call `driver_session` with action `start` and port
   `9223`.
3. Call `webview_screenshot` to inspect the current window. Use
   `webview_find_element` and `webview_interact` to locate and operate controls,
   then take another screenshot to confirm the result.

The companion terminal CLI can start the driver session without an MCP client:

```sh
npm install -g @hypothesi/tauri-mcp-cli
tauri-mcp driver-session start --port 9223
```

If the agent does not list Tauri tools, check the client config, workspace trust,
and MCP approval first; then restart that client. If the tools load but cannot
reach the app, confirm `npm run tauri:dev` is still running and check the app's
logs for bridge/WebSocket errors on port `9223`.

The bridge is an independently maintained community project, not an official
Tauri component. Its [getting-started guide](https://hypothesi.github.io/mcp-server-tauri/guides/getting-started)
documents the integration and troubleshooting details. Client setup references:
[Codex](https://developers.openai.com/codex/mcp),
[Claude Code](https://code.claude.com/docs/en/mcp),
[GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers),
[VS Code](https://code.visualstudio.com/docs/agents/run/manage-mcp-servers),
[Cursor](https://cursor.com/docs/mcp),
[Gemini CLI](https://geminicli.com/docs/tools/mcp-server/), and
[OpenCode](https://opencode.ai/docs/mcp-servers/).

> **Claude Code:** project MCP servers require folder trust and approval. If
> you previously approved the server in a local project settings file that is
> no longer present, approve `tauri-mcp` again in `/mcp`.
