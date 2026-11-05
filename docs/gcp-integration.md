# Google Cloud integration: uptime monitoring

Tripboard runs on Vercel, so a check inside the app can't tell you when the app is down. Google Cloud Monitoring **Uptime Checks** probe Tripboard from several regions on a schedule, record pass/fail history, and can email you when it fails. Tripboard then reads that history back to draw the 30-day bars on `/status` and `/admin/status`.

```
 Google Cloud (3+ regions)                         Vercel
 ┌────────────────────────┐   GET /api/health   ┌──────────────────────────┐
 │ Uptime check, every 5m │ ──────────────────▶ │ runs DB + auth probes    │
 │   records check_passed │ ◀── 200 / 503 ───── │ (src/lib/health.ts)      │
 └──────────┬─────────────┘                     │                          │
            │ alert policy                      │ /status, /admin/status   │
            ▼                                   │   read Cloud Monitoring  │
       email / Slack  ◀───────────────          │   (src/lib/gcp-monitoring.ts)
                                                └──────────────────────────┘
```

Everything here is optional. Without GCP the status pages still show the live checks, and `/admin/status` shows a "Connect Google Cloud Monitoring" card.

## What the app exposes

| Route | Who | What |
| --- | --- | --- |
| `GET /api/health` | public | JSON health report. **200** when operational or degraded, **503** when a critical service (web app, database, sign-in) is down. `Cache-Control: no-store`. |
| `GET /api/health?scope=app` | public | Same shape, but checks only that the app answers. No database or auth calls. Use it for frequent probes. |
| `/status` | public | Overall status, per-service status, and 30-day uptime bars from GCP. No error text or schema names. |
| `/admin/status` | `ADMIN_EMAIL` | The same, plus each check's detail (latency, missing columns, error messages), each uptime check's target, interval and regions, and any Cloud Monitoring errors. |

A sample response:

```json
{
  "status": "operational",
  "version": "0.43.0",
  "checkedAt": "2026-11-04T19:02:11.481Z",
  "checks": [
    { "id": "app", "label": "Web app", "status": "operational", "probed": true },
    { "id": "database", "label": "Database", "status": "operational", "probed": true, "latencyMs": 41 },
    { "id": "schema", "label": "Database schema", "status": "operational", "probed": true },
    { "id": "auth", "label": "Sign-in", "status": "operational", "probed": true, "latencyMs": 88 },
    { "id": "maps", "label": "Maps and directions", "status": "operational", "probed": false },
    { "id": "places", "label": "Place search", "status": "operational", "probed": false },
    { "id": "assistant", "label": "Trip assistant", "status": "operational", "probed": false }
  ]
}
```

`probed: false` means the check only confirms the key is set. It doesn't call Mapbox, Google Places or OpenRouter, so a status probe never uses up paid or rate-limited quota.

Status rules (`overallStatus` in `src/lib/health.ts`):

- **down**: a critical check (`app`, `database`, `auth`) is down. The route returns 503.
- **degraded**: any check is down or degraded, or a probe took over 1.5 s. The route returns 200.
- **operational**: everything else. Features that aren't configured (`not_configured`, shown as "Off") don't count against it.

## Setup

You need a Google Cloud project with billing enabled. Uptime checks have a free monthly allowance that this setup stays well inside; see [Cloud Monitoring pricing](https://cloud.google.com/stackdriver/pricing). Install the [gcloud CLI](https://cloud.google.com/sdk/docs/install) and run `gcloud auth login`.

```bash
export PROJECT_ID=tripboard-ops         # your project
export HOST=usetripboard.vercel.app     # production host, no scheme
export ALERT_EMAIL=you@example.com

gcloud config set project "$PROJECT_ID"
gcloud services enable monitoring.googleapis.com
```

### 1. Create the uptime checks

Create two checks. A cheap, frequent one tells you whether the site is reachable, and a slower one watches the database and sign-in.

```bash
# Reachability: every minute, no database calls.
gcloud monitoring uptime create tripboard-app \
  --resource-type=uptime-url \
  --resource-labels=host="$HOST",project_id="$PROJECT_ID" \
  --protocol=https --path="/api/health?scope=app" \
  --period=1 --timeout=10 \
  --regions=usa-oregon,usa-virginia,europe,asia-pacific

# Full stack: every 15 minutes, includes Neon and Neon Auth.
gcloud monitoring uptime create tripboard-full \
  --resource-type=uptime-url \
  --resource-labels=host="$HOST",project_id="$PROJECT_ID" \
  --protocol=https --path="/api/health" \
  --period=15 --timeout=10 \
  --regions=usa-oregon,usa-virginia,europe
```

Google needs at least three regions per check. Valid regions are `usa-oregon`, `usa-iowa`, `usa-virginia`, `europe`, `south-america` and `asia-pacific`.

> **Why the full check runs every 15 minutes:** each full probe runs `select 1` against Neon. Neon suspends idle compute after about 5 minutes, so probing the database every 1–5 minutes from several regions keeps it awake around the clock and you pay for those compute hours. 15 minutes still catches a broken database quickly, and the `scope=app` check covers reachability every minute.

Both checks pass on any 2xx response. `/api/health` returns 503 only on a real outage, so a degraded state (slow database, missing migration) won't page you. To be alerted on degraded too, add `--matcher-content='"status":"operational"' --matcher-type=contains-string` to the full check.

You can also do all of this in the Console: **Monitoring → Uptime checks → Create uptime check**.

### 2. Alert when it fails

```bash
# Notification channel (email). Slack, SMS and PagerDuty work the same way with a different --type.
gcloud beta monitoring channels create \
  --display-name="Tripboard on-call" --type=email \
  --channel-labels=email_address="$ALERT_EMAIL"

CHANNEL=$(gcloud beta monitoring channels list --filter='displayName="Tripboard on-call"' --format='value(name)')
CHECK_ID=$(gcloud monitoring uptime list-configs --filter='displayName="tripboard-app"' --format='value(name.basename())')
```

Save this as `uptime-alert.json`, replacing the two placeholders:

```json
{
  "displayName": "Tripboard is down",
  "combiner": "OR",
  "conditions": [{
    "displayName": "tripboard-app failing in 2+ regions",
    "conditionThreshold": {
      "filter": "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.label.check_id=\"CHECK_ID\" AND resource.type=\"uptime_url\"",
      "aggregations": [{
        "alignmentPeriod": "300s",
        "perSeriesAligner": "ALIGN_NEXT_OLDER",
        "crossSeriesReducer": "REDUCE_COUNT_FALSE",
        "groupByFields": ["resource.label.project_id", "resource.label.host"]
      }],
      "comparison": "COMPARISON_GT",
      "thresholdValue": 1,
      "duration": "120s",
      "trigger": { "count": 1 }
    }
  }],
  "notificationChannels": ["CHANNEL"],
  "documentation": { "content": "Open https://usetripboard.vercel.app/admin/status and the Vercel deployment logs.", "mimeType": "text/markdown" }
}
```

```bash
gcloud alpha monitoring policies create --policy-from-file=uptime-alert.json
```

This fires when more than one region fails for two minutes, which filters out one-off network noise. Repeat with the `tripboard-full` check ID if you want a separate alert for the database.

### 3. Let Tripboard read the history

Create a service account that can only **read** monitoring data:

```bash
gcloud iam service-accounts create tripboard-status --display-name="Tripboard status page (read-only)"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:tripboard-status@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/monitoring.viewer"

gcloud iam service-accounts keys create tripboard-status-key.json \
  --iam-account="tripboard-status@$PROJECT_ID.iam.gserviceaccount.com"
```

Add both values to Vercel, then delete the local key file:

```bash
vercel env add GCP_PROJECT_ID production          # paste the project id
base64 -i tripboard-status-key.json | tr -d '\n' | vercel env add GCP_SERVICE_ACCOUNT_KEY production --sensitive
rm tripboard-status-key.json
```

`GCP_SERVICE_ACCOUNT_KEY` accepts the key file as raw JSON or base64. Base64 is safer because some env var editors mangle the newlines in the private key. Repeat for `preview` if you want previews to show history, and paste the values into `.env.local` to try it locally. Redeploy so the new variables take effect.

> If your organization blocks key creation (`iam.disableServiceAccountKeyCreation`), see [Keyless auth](#later-keyless-auth-with-vercel-oidc) below.

### 4. Check it works

1. `curl -i https://$HOST/api/health` should return `HTTP/2 200` and `"status":"operational"`.
2. In the Console, **Monitoring → Uptime checks** should show both checks passing in each region after a few minutes.
3. Open `/admin/status`. The "Uptime history" card should list `tripboard-app` and `tripboard-full`, with today's bar filled in and older days grey ("No data") until history builds up.
4. To test the alert, temporarily point a copy of the check at a path that 404s, wait for the email, then delete the copy.

## How the app reads Cloud Monitoring

The client is in `src/lib/gcp-monitoring.ts` and has no dependencies:

1. It signs a JWT with the service account's private key (RS256, Node `crypto`) and exchanges it at `oauth2.googleapis.com/token` for an access token scoped to `monitoring.read`. The token is cached in memory until it's close to expiring.
2. It lists `projects/{id}/uptimeCheckConfigs` to get each check's name, host, path, interval and regions.
3. It reads the `monitoring.googleapis.com/uptime_check/check_passed` time series twice, using `ALIGN_FRACTION_TRUE` per region and `REDUCE_MEAN` across regions, grouped by `check_id`:
   - 30 days in 24-hour windows for the daily bars and the 24h, 7d and 30d percentages
   - the last 20 minutes for the current Up or Down pill
4. Results are cached in memory for 60 seconds, so a busy status page makes about one round of API calls a minute per instance.

The daily windows are rolling 24-hour windows that end at the time of the request, not calendar days, so each bar is approximately one UTC day. A bar shows green at 99.5% or more, amber at 95% or more, red below that, and grey when there's no data.

Any failure (bad key, missing role, API disabled) is caught. `/status` then shows "History is unavailable right now", and `/admin/status` shows the error Google returned.

## Platform analytics (`/admin/platform`)

The Platform tab charts everything running Tripboard on one page. Each card works on its own and shows a setup hint when its source isn't connected.

| Card | Source | Needs |
| --- | --- | --- |
| Google API traffic | `serviceruntime.googleapis.com/api/request_count` and `request_latencies` for `tripboard-ops`, as 30 daily bars split into successes and 4xx/5xx errors, plus a table of requests, last-24h count, error rate and p95 latency per service | the GCP variables above |
| Places quota today | `serviceruntime.googleapis.com/quota/rate/net_usage` against `quota/limit`, since midnight Pacific when Google resets daily quotas. A bar turns red at 80%. | the GCP variables above |
| Uptime checks | the same data as `/status` | the GCP variables above |
| Deployments | Vercel REST `/v6/deployments`, `/v9/projects/{id}` and `/v9/projects/{id}/domains`, as daily ready and failed bars, the last 12 deploys, the success rate and the median build time | `VERCEL_API_TOKEN` |
| This server | Vercel's system env vars (`VERCEL_ENV`, `VERCEL_REGION`, `VERCEL_GIT_COMMIT_*`), plus the project's root directory, Node version and domains when the token is set | nothing |
| Largest tables | `pg_database_size` and `pg_stat_user_tables` on Neon | `DATABASE_URL` |

Google and Vercel results are cached in memory for 60 seconds.

The Google traffic only counts API keys that belong to `tripboard-ops`. Calls made with a key from another project show up in that project instead.

To connect Vercel, create a token at [vercel.com/account/settings/tokens](https://vercel.com/account/settings/tokens). Give it a name, scope it to the team that owns Tripboard, and set an expiry. Then store it:

```bash
vercel env add VERCEL_API_TOKEN production --sensitive --value "<token>"
```

Vercel tokens can't be made read-only. The app only sends `GET` requests, but treat the token like any other secret. `vercel tokens create` doesn't work from a normal CLI login ("Cannot create tokens for this app"), so use the dashboard.

You don't need to set the project and team IDs. Vercel sends every function an OIDC token (the `x-vercel-oidc-token` header), and the app reads `project_id` and `owner_id` from its claims. OIDC is on by default. If it's off, or you want a different project, set `VERCEL_PROJECT_ID` and `VERCEL_TEAM_ID` (`projectId` and `orgId` in `.vercel/project.json`). Locally, `vercel env pull .env.local` writes a `VERCEL_OIDC_TOKEN` the app reads the same way.

Revoke the token on the same dashboard page, or with `vercel tokens list` and then `vercel tokens revoke <id>`.

Billing isn't on the page. Exact spend needs a [Cloud Billing export to BigQuery](https://cloud.google.com/billing/docs/how-to/export-data-bigquery) and Vercel's usage dashboard. A good follow-up is to add a billing card once the export exists.

## Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `GCP_PROJECT_ID` | for history | The project that owns the uptime checks. |
| `GCP_SERVICE_ACCOUNT_KEY` | for history | Service-account key JSON, raw or base64. Server-only, so never prefix it with `NEXT_PUBLIC_`. Needs `roles/monitoring.viewer` and nothing else. |
| `VERCEL_API_TOKEN` | for deploys | Team-scoped token from vercel.com/account/settings/tokens. Server-only. |
| `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | no | Override the project and team read from the OIDC token. |

Like the other secrets, blank values and the `[SENSITIVE]` placeholder that `vercel env pull` writes count as unset.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "Google sign-in failed (400)" | The key is truncated or its newlines were mangled. Re-add it as base64. |
| "Permission monitoring.uptimeCheckConfigs.list denied" | The service account is missing `roles/monitoring.viewer`, or `GCP_PROJECT_ID` names a different project. |
| "Cloud Monitoring API has not been used in project…" | Run `gcloud services enable monitoring.googleapis.com`. |
| Checks are listed but every bar is grey | No history yet. The first points appear a few minutes after a check is created. |
| Full check fails but the site works | Open `/admin/status` to see which probe failed. A down database or a Neon Auth 5xx returns 503 by design. |
| Uptime check fails with 401 or 403 | Vercel Deployment Protection is on for that URL. Point the check at the production domain, or add a [protection bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection) header in the check's `--headers`. |

## Later: keyless auth with Vercel OIDC

A long-lived key is the simplest setup, but GCP Workload Identity Federation lets Vercel functions exchange their built-in OIDC token for short-lived Google credentials, so no key is stored at all. Outline:

1. Enable [Vercel OIDC](https://vercel.com/docs/oidc) for the project (Settings → Security → Secure backend access).
2. Create a workload identity pool and an OIDC provider with issuer `https://oidc.vercel.com/<team-slug>`, audience `https://vercel.com/<team-slug>`, and an attribute condition that only allows the Tripboard project.
3. Grant the pool's principal `roles/iam.workloadIdentityUser` on `tripboard-status@…`.
4. Replace `accessToken()` in `src/lib/gcp-monitoring.ts` with an STS exchange (`sts.googleapis.com/v1/token`) of the request's `x-vercel-oidc-token`, followed by `iamcredentials…:generateAccessToken`, or use `google-auth-library`'s `ExternalAccountClient` with `@vercel/oidc`'s `getVercelOidcToken`.

Vercel's guide: [Connect to Google Cloud Platform](https://vercel.com/docs/oidc/gcp).

## Transit directions (Routes and Time Zone APIs)

"Find transit options" in a day's ride editor calls `POST /api/routes/transit`, which asks the [Routes API](https://developers.google.com/maps/documentation/routes/transit-route) for up to three transit routes between two stops: lines, transfers, walks, times and fare when known. The [Time Zone API](https://developers.google.com/maps/documentation/timezone) turns the trip's local departure time into the UTC time Routes expects. Google only has timetables from 7 days ago to 100 days ahead, so trips outside that window get today's timetable and the editor says so. Results are fetched on click and never stored (`src/lib/transit-routes.ts`). Both use `GOOGLE_MAPS_API_KEY`, so the key needs both APIs:

```bash
PROJECT=tripboard-ops
gcloud services enable routes.googleapis.com timezone-backend.googleapis.com --project "$PROJECT"

# Allow them on each Tripboard key alongside Places and Geocoding.
for KEY in $(gcloud services api-keys list --project "$PROJECT" --filter='displayName~Tripboard' --format='value(uid)'); do
  gcloud services api-keys update "$KEY" --project "$PROJECT" \
    --api-target=service=places.googleapis.com \
    --api-target=service=geocoding-backend.googleapis.com \
    --api-target=service=routes.googleapis.com \
    --api-target=service=timezone-backend.googleapis.com
done
```

Then set a daily request cap for each in **APIs & Services → Routes API (and Time Zone API) → Quotas**, the same way Places is capped. Without the key, or if a call fails, the editor falls back to the "Compare transit in Google Maps" link.

## Billing budget

A budget emails the billing admins as spend climbs. It doesn't stop spending; the daily API caps do that.

```bash
gcloud services enable billingbudgets.googleapis.com --project tripboard-ops
gcloud billing budgets create \
  --billing-account=01FDCD-FE36DB-E77339 \
  --display-name="Tripboard monthly" \
  --budget-amount=25CAD \
  --filter-projects=projects/tripboard-ops \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0 \
  --threshold-rule=percent=1.0,basis=forecasted-spend
```

The last rule warns when the month is *forecast* to pass the budget, before it actually does. Change the amount with `gcloud billing budgets update <budget-id> --billing-account=… --budget-amount=…`.

## Other GCP pieces worth adding later

- **Cloud Logging**: a Vercel log drain into Cloud Logging keeps logs longer than Vercel does and lets you build log-based alerts, such as one on `[tripboard]` warnings.
- **Synthetic monitors**: a Cloud Run function that signs in with a test account and loads a trip, for a deeper check than `/api/health`.
- **SLOs**: once there's a month of history, define a 99.5% availability SLO on the `tripboard-app` check in **Monitoring → Services** and alert on error-budget burn rate instead of single failures.

## Removing it

```bash
gcloud alpha monitoring policies list --format='value(name)' --filter='displayName="Tripboard is down"' | xargs -n1 gcloud alpha monitoring policies delete --quiet
gcloud monitoring uptime delete tripboard-app --quiet   # use the check id from list-configs if the name doesn't resolve
gcloud monitoring uptime delete tripboard-full --quiet
gcloud iam service-accounts delete "tripboard-status@$PROJECT_ID.iam.gserviceaccount.com" --quiet
vercel env rm GCP_PROJECT_ID production && vercel env rm GCP_SERVICE_ACCOUNT_KEY production
```
