# Security Policy

## Architecture

Thread Manager for Amp is a **local development tool** that runs a web server on your machine. It is designed for personal use on trusted networks.

### Important Security Characteristics

- The server binds to `127.0.0.1` (localhost only) — it is not accessible from other devices on your network
- There is **no authentication** on the API or WebSocket endpoints — any local process can interact with the server
- The app reads your Amp CLI credentials (`~/.local/share/amp/secrets.json`) to interact with the Amp API
- The integrated shell terminal provides full PTY access as your user
- Thread data may contain sensitive information from your coding sessions

### Recommendations

- Do **not** expose this server to the internet or untrusted networks
- Do **not** modify the server to bind to `0.0.0.0` unless you understand the implications
- Be aware that any application running on your machine can access the server's API

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainers or use GitHub's [private vulnerability reporting](https://github.com/block/thread-manager-for-amp/security/advisories/new)
3. Include a description of the vulnerability and steps to reproduce

We will acknowledge receipt within 48 hours and work to address the issue promptly.
