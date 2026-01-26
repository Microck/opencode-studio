# OpenCode Studio Server

Backend server for [OpenCode Studio](https://github.com/Microck/opencode-studio).

## Installation

```bash
npm install -g opencode-studio-server
```

## Setup

After installing, register the protocol handler to allow the web UI to launch the backend:

```bash
opencode-studio-server --register
```

## Usage

Start the server manually:

```bash
opencode-studio-server
```

The server runs on port **1920** (auto-detects next available) and provides an API for managing your local OpenCode configuration.

## Features

- **Protocol Handler**: `opencodestudio://` support for one-click actions
- **Config Management**: Reads/writes `~/.config/opencode/opencode.json`
- **MCP Management**: Add/remove/toggle MCP servers
- **Auth**: Manage authentication profiles

## License

MIT
