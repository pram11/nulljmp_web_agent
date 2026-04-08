# nulljmp_web_agent

A scalable Playwright worker system. Jobs are submitted as a JSON action list to RabbitMQ, executed in isolated browser contexts, and results are published back to a results queue.

---

## Queue Overview

| Queue | Direction | Purpose |
|---|---|---|
| `task_queue` | → Worker | Submit a job |
| `task_results` | ← Worker | Receive the job outcome |
| `task_queue.dlq` | ← Worker | Jobs that failed after all retries |

Queue names are configurable via `.env`.

---

## Request — Job Payload

Publish to `task_queue` as a persistent JSON message.

```json
{
  "job_id": "unique-id-001",
  "options": {
    "timeout": 30000,
    "viewport": { "width": 1280, "height": 720 }
  },
  "actions": []
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `job_id` | string | yes | Unique identifier; echoed in the result |
| `options.timeout` | number | no | Per-action timeout in ms (default: 30000) |
| `options.viewport` | object | no | Browser viewport (default: 1280×720) |
| `actions` | Action[] | yes | Ordered list of actions to execute |

---

## Actions

Every action has an optional `id` field that is echoed in the step result.

### Navigation

#### `goto`
Navigate to a URL. The domain must be in the `ALLOWED_DOMAINS` allowlist.
```json
{ "id": "step_1", "type": "goto", "params": { "url": "https://example.com" } }
```

#### `reload`
Reload the current page.
```json
{ "type": "reload" }
```

#### `back`
Navigate to the previous page.
```json
{ "type": "back" }
```

---

### Interaction

#### `click`
```json
{ "type": "click", "params": { "selector": "#submit-btn" } }
```

#### `fill`
Type a value into an input field.
```json
{ "type": "fill", "params": { "selector": "#email", "value": "user@example.com" } }
```

#### `hover`
```json
{ "type": "hover", "params": { "selector": ".menu-item" } }
```

#### `press`
Press a keyboard key while an element is focused.
```json
{ "type": "press", "params": { "selector": "#search", "key": "Enter" } }
```

#### `check`
Check a checkbox or radio button.
```json
{ "type": "check", "params": { "selector": "#agree" } }
```

---

### Wait

#### `wait_for_selector`
Pause until an element appears in the DOM.
```json
{ "type": "wait_for_selector", "params": { "selector": ".results", "timeout": 5000 } }
```
`timeout` overrides the job-level timeout for this step only.

#### `sleep`
Wait for a fixed duration.
```json
{ "type": "sleep", "params": { "ms": 1500 } }
```

---

### Scraping / Output

#### `extract`
Read a value from a DOM element. The result `value` is returned in the step result.

```json
{ "id": "get_title", "type": "extract", "params": { "selector": "h1", "attr": "innerText" } }
```

| `attr` value | Returns |
|---|---|
| `innerText` | Visible text content |
| `innerHTML` | Raw inner HTML |
| `value` | `.value` property (inputs, textareas) |
| any string | The named HTML attribute (e.g. `"href"`, `"src"`, `"data-id"`) |

#### `screenshot`
Capture a screenshot. Returns base64-encoded PNG if `path` is omitted.
```json
{ "type": "screenshot", "params": { "fullPage": true, "path": "/tmp/shot.png" } }
```

| Field | Type | Default | Description |
|---|---|---|---|
| `path` | string | — | Save to disk; omit to get base64 in result |
| `fullPage` | boolean | false | Capture full scrollable page |

#### `pdf`
Generate a PDF. Returns base64-encoded PDF if `path` is omitted.
```json
{ "type": "pdf", "params": { "path": "/tmp/page.pdf" } }
```

---

### Flow Control

#### `exists`
Check whether a selector exists. Executes `on_true` or `on_false` branches accordingly. Branches abort on the first failing step.

```json
{
  "id": "check_login",
  "type": "exists",
  "params": { "selector": "#login-btn" },
  "on_true": [
    { "type": "click",  "params": { "selector": "#login-btn" } },
    { "type": "fill",   "params": { "selector": "#user", "value": "admin" } },
    { "type": "press",  "params": { "selector": "#user", "key": "Enter" } }
  ],
  "on_false": [
    { "type": "extract", "params": { "selector": ".username", "attr": "innerText" } }
  ]
}
```

The step result `value` for `exists` is:
```json
{ "found": true, "branch_results": [ ... ] }
```

---

## Response — Job Result

Consumed from `task_results`.

### Success
```json
{
  "job_id": "unique-id-001",
  "success": true,
  "duration_ms": 1842,
  "steps": [
    { "id": "step_1", "type": "goto",    "success": true, "value": "https://example.com" },
    { "id": "step_2", "type": "extract", "success": true, "value": "Hello World" }
  ]
}
```

### Failure (step error)
Execution stops at the first failed step. Subsequent steps are not present.
```json
{
  "job_id": "unique-id-001",
  "success": false,
  "duration_ms": 523,
  "error": "Step \"step_1\" failed: SSRF blocked: \"https://blocked.com\" is not in the allowed domain list",
  "steps": [
    { "id": "step_1", "type": "goto", "success": false, "error": "SSRF blocked: ..." }
  ]
}
```

### Failure (retries exhausted → DLQ)
Published after all retry attempts fail. `steps` is empty as no step-level detail is retained across retries.
```json
{
  "job_id": "unique-id-001",
  "success": false,
  "duration_ms": 0,
  "error": "Exhausted retries: Step \"step_1\" failed: net::ERR_NAME_NOT_RESOLVED"
}
```

---

## Full Example

**Publish to `task_queue`:**
```json
{
  "job_id": "scrape-001",
  "options": { "timeout": 15000 },
  "actions": [
    { "id": "nav",   "type": "goto",    "params": { "url": "https://example.com" } },
    { "id": "title", "type": "extract", "params": { "selector": "h1", "attr": "innerText" } },
    { "id": "shot",  "type": "screenshot", "params": { "fullPage": false } }
  ]
}
```

**Receive from `task_results`:**
```json
{
  "job_id": "scrape-001",
  "success": true,
  "duration_ms": 1103,
  "steps": [
    { "id": "nav",   "type": "goto",       "success": true, "value": "https://example.com" },
    { "id": "title", "type": "extract",    "success": true, "value": "Example Domain" },
    { "id": "shot",  "type": "screenshot", "success": true, "value": "<base64 PNG>" }
  ]
}
```
