# API Endpoints

## POST `/api/revalidate`

Triggers cache revalidation for a specific tag. Protected by the shared secret in the `x-revalidate-secret` header (this is the only access check in the app).

**Headers:**
- `x-revalidate-secret` (required): Must match the `REVALIDATE_SECRET` environment variable

**Body (JSON):**
```json
{ "tag": "repo-owner-name" }
```

**Example:**
```bash
curl -X POST https://bmad.example.com/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: your_secret_here" \
  -d '{"tag": "repo-owner-name"}'
```

**Responses:**
- `200 OK` — `{ "revalidated": true, "now": <timestamp> }`
- `401 Unauthorized` — Invalid or missing secret
- `503 Service Unavailable` — Revalidation is disabled (no secret configured)

## GET `/api/health`

Health check endpoint for monitoring and load balancers.

**Responses:**
- `200 OK` — `{ "status": "ok" }`
- `503 Service Unavailable` — `{ "status": "error" }`

## GET `/api/search?q=<query>`

Searches the documents of all registered projects. Responses are not cached. The app has no authentication, so every endpoint except `/api/revalidate` is open to anyone who can reach the port.

## GET `/api/repo-asset?owner=&repo=&path=`

Serves an image from a BMAD directory of a registered local project, so Markdown documents can reference images by relative path. Only works for local projects (`ENABLE_LOCAL_FS=true`), allows a fixed set of image types, enforces a size limit and rejects path traversal.
