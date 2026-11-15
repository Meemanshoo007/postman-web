# Relay API Tester

A Postman-style API workspace that runs entirely in your browser. Relay has no application backend, database, account system, or server-side request proxy. It sends API requests directly from your browser to the URL you enter.

## Run locally

Install Node.js 20 or newer, open a terminal in this `relay` folder, then run:

```sh
npm start
```

Open the local address printed in the terminal. There are no dependencies to install and no build step. `npm run dev` starts the same preview server. The included Node server serves static files only; it does not execute or store your API requests.

To verify the project:

```sh
npm test
npm run check
```

## Static hosting

Deploy the contents of `dist/` to any static website host. `dist/index.html` is the entry point. Keep `app.js`, `core.js`, `icons.js`, and the stylesheet beside it as shipped. No Node process, database, environment secrets, or API server is required on the host.

Use the local HTTP server for development rather than opening `index.html` with a `file://` address: browser module loading and storage behave differently for local files.

## Features

- GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS requests.
- Multiple request tabs, named requests, and collections.
- Editable query parameters and headers, including enabled/disabled rows.
- JSON, text, and URL-encoded request bodies.
- Bearer tokens, Basic authentication, and API keys in headers or query parameters.
- Named environments with `{{variable_name}}` substitution in URLs, parameters, headers, authentication, and bodies.
- cURL import and export; Postman v2 collection import and export.
- Response body formatting, search, headers, status, duration, and size.
- Copy/download responses, cancel requests, and configurable timeouts.
- Browser-local saved requests, open drafts, environments, settings, and the last 100 sent requests.
- Workspace JSON backups, dark/light themes, and keyboard shortcuts.

Use **Save** to name a request and place it in a collection. Edits to open tabs are remembered as drafts. Use **Export workspace** to download a backup. Request history stores the request and metadata; response bodies are kept in memory for the current session.

Keyboard shortcuts: **Ctrl/Cmd + Enter** sends the current request, **Ctrl/Cmd + S** opens Save, and **Ctrl/Cmd + K** focuses workspace search.

## Browser limits

Relay reproduces the common request workflow, not every desktop Postman feature. Because API calls use browser `fetch`, the target API must allow the website's origin through CORS. CORS configuration belongs on the target API; Relay cannot bypass it. A request that succeeds in terminal cURL or desktop Postman may therefore fail in Relay. HTTPS pages may also block requests to HTTP endpoints.

Browsers control certain headers and cookies. Manually setting a `Cookie`, `Host`, `Content-Length`, or other browser-managed header does not grant desktop-client control. The optional cookie setting includes browser cookies only when the API and browser permit credentialed cross-origin requests. Response headers are limited to those the browser exposes.

The app does not implement a collection runner, test/pre-request scripts, OAuth sign-in flows, WebSockets, client certificates, file uploads, or multipart request bodies. Unsupported cURL options and file references are rejected with an explanation. Import only transfers supported request definitions; it does not execute imported code. cURL export uses POSIX shell quoting and line continuations suitable for Bash or zsh (including Git Bash/WSL on Windows).

Responses larger than 5 MB are truncated in the viewer. A partial response may no longer be valid JSON. Requests can time out after the configured interval, which defaults to 30 seconds.

## Local storage and backups

Your workspace stays in this browser's `localStorage`, under `relay.workspace.v1`. Storage is specific to the browser profile and website origin, including the port. A hosted copy and a local copy have separate workspaces. Clearing browser data, switching profiles, or using a temporary browsing session can remove or hide your saved workspace.

Authentication values, environment variables, request bodies, and history are stored as **plain text**, not encrypted. Workspace and collection exports can contain those same secrets, and cURL export includes resolved credentials. Keep backups private and remove sensitive values before sharing them. API requests themselves still send the data and credentials you configure to the target API.

Export backups periodically, especially before clearing browser data or moving to another browser. The app reports storage failures when browser storage is unavailable or full.
