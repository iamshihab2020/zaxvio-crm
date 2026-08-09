# 06 — Variables & Templating

Every string field in every node config is templated. `{{contact.first_name}}` in an SMS body,
`{{lead.pipelineStageName}}` in a condition, `{{httpResponse.body.id}}` in a downstream HTTP call.
This is what makes a workflow feel dynamic rather than a static rule.

## 6.1 The two-part contract

```mermaid
graph LR
    subgraph SHARED["packages/shared — workflow-variables.ts — 4,087 lines"]
        PATHS["WORKFLOW_VARIABLE_PATHS<br/>~700 path-to-description entries<br/><i>the declared vocabulary</i>"]
        SCHEMAS["Zod context schemas<br/>Contact · Lead · User · Organization<br/>SubjectOrg · Actor · Agency · Attribution<br/>Webhook · System · EventDiff"]
        GEN["generate*Variables()<br/>VariableDefinition list for the editor picker"]
    end

    subgraph API["apps/api — variableInterpolation.ts — 1,256 lines"]
        MAP["a hand-written flat map<br/>'contact.email' maps to context.contact.email<br/>… ~700 entries"]
        RESOLVE["resolution cascade + deny-list"]
    end

    subgraph WEB["apps/web/src/lib/workflow/variables/"]
        PICKER["variable picker UI<br/>trigger-scoped filtering"]
    end

    SCHEMAS --> PATHS
    PATHS -.->|"⚠️ kept in sync BY CONVENTION"| MAP
    PATHS --> GEN
    GEN --> PICKER
    MAP --> RESOLVE

    style MAP fill:#5f1e1e,stroke:#d94a4a,color:#fae8e8
```

> ### ⚠️ The dotted line is a real defect
>
> `WORKFLOW_VARIABLE_PATHS` (the declaration) and the flat map inside `interpolateVariables()`
> (the implementation) are **two hand-maintained lists of the same ~700 paths**. Nothing enforces
> that they agree. A path declared but not mapped resolves to `""` with a warning; a path mapped but
> not declared works but never appears in the picker.
>
> **In a port: derive one from the other.** Define each namespace once as
> `{ path, description, resolve: (ctx) => value }` and generate both the picker list and the
> interpolation map from it. This single change removes an entire class of "the variable is in the
> dropdown but comes out blank" bugs.

## 6.2 Namespaces

| Namespace | Source | Examples |
|---|---|---|
| `contact.*` | loaded entity | `id, first_name, last_name, name, email, phone, email_secondary/tertiary, phone_secondary/tertiary, company, address, city, state, zip_code, full_address, calendly_link, source, status, owner_id, tags, customFields` |
| `lead.*` | loaded entity | `id, title, email, phone, full_address, value, score, status, source, assignedTo, assignedToName, pipelineId, pipelineName, pipelineStageId, pipelineStageName, squareFootage, tags, dynamic_fields` |
| `user.*` | assigned user | `id, first_name, last_name, name, email, phone` |
| `organization.*` | tenant org | `id, name, email_slug, email, phone, website, address1/2, city, state, postal_code, country, full_address` |
| `system.*` | computed at interpolation time | `currentDate, currentTime, currentDatetime, currentDayOfWeek, timestamp` (+ snake_case aliases) |
| `attribution.*` | tracking | `utm_source/medium/campaign/content/term, gclid, wbraid, gbraid, fbclid, msclkid, ttclid, li_fat_id, facebook_lead_id, landing_page_url, referrer_url, device, source` |
| `webhook.*` | inbound webhook | `method, path, headers, body, query, ip, timestamp` |
| Trigger-specific | `eventData` | `call.*`, `sms.*`, `email.*`, `message.*`, `booking.*`, `appointment.*`, `task.*`, `note.*`, `form.*`, `formData.*`, `keyword.*`, `tagEvent.*`, `dndEvent.*`, `assignmentEvent.*`, `inactivityData.*`, `facebookLead.*`, `facebookMessage.*`, `score.*`, `field.*` |
| Node outputs | `context.nodeOutputs` | `{{<nodeId>}}`, `{{<nodeId>.<key>}}`, and named vars like `{{httpResponse.body}}` |
| Loop | `context.loopState` | `{{currentItem}}`, `{{currentIndex}}`, plus user-named aliases |
| Agency (scope=agency) | `context.variables` | `org.*`, `org.csm.*`, `actor.*`, `agency.*`, `event.changedFields` |
| Call attribution | `eventData.call` | `call.attribution.firstTouch.*` / `lastTouch.*` × {source, medium, campaign, keyword, landingPage, gclid, wbraid, gbraid, fbclid, msclkid, ttclid, liFatId} |

**Immutability rule.** In SiloCRM these paths are treated as a **permanent public API** — customers'
saved workflows, Facebook form mappings, and exported data reference the exact strings. New keys are
fine; renames and removals are not. Display labels can change; the key cannot. Adopt the same rule
from day one and write it down.

## 6.3 Resolution cascade

`interpolateVariables(template, context, encoding, options)` —
`apps/api/src/lib/workflow/utils/variableInterpolation.ts:98`

```mermaid
flowchart TD
    T["regex-match every double-brace token<br/>in the template"] --> TRIM["trim the path"]

    TRIM --> B1{"starts with 'env.' or equals 'env'?"}
    B1 -->|yes| BLOCK1["return '[BLOCKED: env access not allowed]'<br/>+ console.warn"]
    B1 -->|no| B2{"starts with double-underscore, or contains<br/>'prototype' / 'constructor'?"}
    B2 -->|yes| BLOCK2["return '[BLOCKED: restricted access]'"]
    B2 -->|no| ALIAS["MESSAGE_TEMPLATE_ALIASES lookup<br/><i>maps camelCase snippet tokens<br/>contact.firstName → canonical snake_case</i>"]

    ALIAS --> S1{"exact key in the flat map?"}
    S1 -->|"yes, and value is an object<br/>and path has a dot"| NEST1["try nested resolution<br/>inside that object"]
    S1 -->|yes| FMT
    NEST1 --> FMT
    S1 -->|no| S2{"getNestedValue(context.variables, path)?"}
    S2 -->|found| FMT
    S2 -->|no| S3{"getNestedValue(context, path)?"}
    S3 -->|found| FMT
    S3 -->|no| S4{"base segment is an object in<br/>context.variables? resolve the rest"}
    S4 -->|found| FMT
    S4 -->|no| MISS

    FMT["formatValue()"] --> F1["arrays → join(', ')<br/>objects → JSON.stringify<br/>ISO datetimes → human, in the right TZ<br/>E.164 → (xxx) xxx-xxxx <b>only if the path<br/>looks like a phone field</b>"]
    F1 --> ENC["encode(value, encoding)<br/>none | html | url | js | json | sql"]
    ENC --> OUT([substituted string])

    MISS["logWarn with a HINT:<br/>'did you mean: contact.email, contact.phone?'<br/>or 'webhookData.body is a string —<br/>form-urlencoded not parsed?'"] --> EMPTY["return empty string"]

    style BLOCK1 fill:#5f1e1e,stroke:#d94a4a,color:#fae8e8
    style BLOCK2 fill:#5f1e1e,stroke:#d94a4a,color:#fae8e8
```

## 6.4 Details worth copying

### Unresolved variables produce a *diagnostic*, not silence

```
[VariableInterpolation] Unresolved variable: contact.emial
  (did you mean: contact.email, contact.email_secondary, contact.first_name?)
```

It computes the suggestion by filtering `WORKFLOW_VARIABLE_PATHS` on the namespace prefix. For
webhook paths it goes further and inspects the actual payload:
`[webhookData.body is a string — form-urlencoded not parsed?]` or
`[webhookData.body keys: name, email, phone, …]`.

**This is excellent.** A blank SMS is otherwise undebuggable. Copy this pattern for every
templating system you build.

### Timezone resolution is layered and never falls back to the server zone

`variableInterpolation.ts:115-132`:

```ts
const orgTz  = context.organization?.timezone || "America/Chicago";  // NEVER the server zone
const bookerTz = eventData.timezone ?? eventData.booking?.timezone;  // the booker's own zone
const eventTz    = options?.datetimeTimeZone ?? bookerTz ?? orgTz;   // lead-facing datetimes
const activityTz = options?.datetimeTimeZone ?? orgTz;               // call/note timestamps
```

The comment is emphatic: *"Datetimes must NEVER fall back to the server zone (UTC on Railway). Org
timezone is the floor; Central is the floor under that."*

And `formatHumanDatetime` **always appends the short zone name** (`3:30 PM CDT`) — because
lead-facing sends use the booker's zone while business-side sends use the org's, and without the
label the two are indistinguishable to the reader.

**Port this exactly.** Timezone bugs in automation are the most common and the most damaging: an
appointment reminder in the wrong zone is a missed appointment.

### Phone formatting is path-gated, not value-gated

`maybeFormatPhoneNumber()` only prettifies E.164 → `(xxx) xxx-xxxx` when the **last path segment**
is in an allowlist (`phone`, `mobile`, `cell`, `from`, `to`, `caller`, …). The comment explains why:
a 10-digit Google Ads `campaign_id` was being rendered as a phone number.

**Rule: never infer a value's type from its shape. Infer it from its declared path.**

### Output encoding is a parameter

`encode(value, 'html' | 'url' | 'js' | 'json' | 'sql' | 'none')` — `security/OutputEncoder.ts`.
Email bodies interpolate with `html`, URL builders with `url`. Prevents an injected
`<script>` in a contact's last name from reaching an email template.

**Port note:** the encoding is chosen **at each call site**, so a new node that forgets to pass one
silently gets `'none'`. Consider making the encoding part of the *property* declaration
(`"encoding": "html"` on the NodeProperty) so it's declared once with the field, not remembered at
every use.

### Node outputs are flattened for addressability

`flattenNodeOutputs()` exposes both `{{nodeId}}` (whole output) and `{{nodeId.key}}` (one field).
Named variables set by nodes (e.g. `httpResponse`) are spread into the same namespace, so
`{{httpResponse.body.items.0.id}}` resolves through `getNestedValue`.

## 6.5 The editor side

`apps/web/src/lib/workflow/variables/`

- `services/variable-service.ts` — assembles the picker list.
- `utils/trigger-detector.ts` — inspects the workflow's trigger node and **scopes the variable list
  to what that trigger actually provides**. A workflow triggered by `lead.created` doesn't offer
  `{{call.recordingUrl}}`.
- `data/static-variables.ts`, `data/trigger-variables.ts`, `data/agency-variables.ts` — the source
  lists.
- `hooks/use-variable-search.ts` — fuzzy search in the picker.
- `components/automation/variable-selector/` — the `{{ }}` insert UI.

**Trigger-scoped variables are a significant UX win** and cheap to build once the vocabulary is
declared per-namespace with a `providedBy: triggerType[]` field.

## 6.6 Security posture

| Threat | Mitigation |
|---|---|
| Secret exfiltration via `{{env.DATABASE_URL}}` | `env.*` explicitly blocked, returns a visible `[BLOCKED]` marker + warns |
| Prototype pollution / gadget access | `__*`, `prototype`, `constructor` blocked |
| XSS via interpolated CRM data in an email | `encode(value, 'html')` |
| Injection into generated URLs | `encode(value, 'url')` |
| Accidental object dumps into an SMS | objects `JSON.stringify`d rather than `[object Object]` |

The blocked-value markers are *returned into the output* rather than silently dropped — so a user
who tries `{{env.X}}` sees `[BLOCKED: env access not allowed]` in their test SMS and learns
immediately. Better than a silent empty string.

## 6.7 Recommended design for a port

```ts
// ONE declaration per variable — picker, docs, and resolver all derive from it.
interface VariableDef<Ctx> {
  path: string;                       // "contact.email"        — IMMUTABLE
  label: string;                      // "Email"                — freely renameable
  description: string;
  type: "string" | "number" | "boolean" | "date" | "array" | "object";
  providedBy?: TriggerType[];         // scope the picker; omit = always available
  format?: "phone" | "datetime" | "currency";   // formatting by declaration, not by guess
  encoding?: EncodingContext;         // default encoding when used in this field type
  resolve: (ctx: Ctx) => unknown;     // THE implementation — no second hand-written map
}

export const VARIABLES: VariableDef<ExecutionContext>[] = [
  { path: "contact.email", label: "Email", type: "string",
    description: "Primary email address", resolve: c => c.contact?.email },
  // …
];
```

From this one array, generate: the interpolation map, the editor picker, the trigger-scoped
filtering, the "did you mean" suggestions, and the public variable documentation. That is roughly
5,300 lines of SiloCRM code collapsed into one table plus ~150 lines of machinery.
