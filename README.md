# Puck Studio

A Next.js 16 + Puck page builder with first-party forms, reusable saved blocks, MSSQL-backed storage, and HTML export.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the ASP.NET API in another terminal when you want MSSQL persistence:

```bash
npm run api:dev
```

The API listens on `http://127.0.0.1:5056` and creates a LocalDB database named `PuckBuilder` by default.

## Aspire Orchestration

You can run the full stack together (Next admin + Builder API + Runtime MVC) with Aspire:

```bash
aspire doctor
aspire start --apphost orchestration/PuckBased.AppHost/PuckBased.AppHost.csproj
aspire describe --apphost orchestration/PuckBased.AppHost/PuckBased.AppHost.csproj
```

Stop everything:

```bash
aspire stop --apphost orchestration/PuckBased.AppHost/PuckBased.AppHost.csproj
```

The AppHost project lives at `orchestration/PuckBased.AppHost`.

## Routes

- `/` - builder dashboard
- `/api/pages` - list/create pages for the dashboard
- `/builder/pages/home` - Puck WYSIWYG editor
- `/p/home` - published page render
- `/login` - author/editor login
- `/api/pages/home/export` - standalone HTML export
- `/api/forms/submit` - placeholder form submission endpoint
- `/api/custom-blocks` - Next proxy for saved sections/forms
- ASP.NET API: `/api/pages/{id}`, `/api/custom-blocks`, `/api/form-submissions`

## Storage

- Next uses `BUILDER_API_URL` when set, or `http://127.0.0.1:5056` by default.
- The ASP.NET app uses MSSQL LocalDB: `(localdb)\MSSQLLocalDB`, database `PuckBuilder`.
- If the API is not running, Next falls back to ignored local JSON files under `data/`.

## Builder Security (Author + Editor Login)

Auth now lives in the ASP.NET Builder API.  
Next.js is frontend/proxy only.

Set one of these auth env options on the API process:

1. Combined list:

```text
BUILDER_USERS=author_user:author_password:author,editor_user:editor_password:editor
```

2. Dedicated vars:

```text
BUILDER_AUTHOR_USERNAME=author_user
BUILDER_AUTHOR_PASSWORD=author_password
BUILDER_EDITOR_USERNAME=editor_user
BUILDER_EDITOR_PASSWORD=editor_password
```

Optional hardening:

```text
BUILDER_SESSION_TTL_SECONDS=43200
BUILDER_TOKEN=legacy_backdoor_token_optional
```

Next.js optional cookie flag:

```text
BUILDER_COOKIE_SECURE=true
```

(`BUILDER_COOKIE_SECURE` defaults to `false` for local HTTP usage.)

What is protected:

- `/`
- `/tables/*`
- `/builder/*`
- builder APIs under `/api/pages/*`, `/api/tables/*`, `/api/custom-blocks/*`, `/api/media/*`

Role behavior:

- `editor`: full access (including publish and status changes)
- `author`: builder access except publish/status endpoints

Development fallback:

- If no auth env vars are provided in local development, default users are enabled:
  - `author / author123`
  - `editor / editor123`

Legacy support:

- `BUILDER_TOKEN` query/header/cookie access is still accepted for backward compatibility.

## Notes

- Puck owns the drag-and-drop editor surface.
- The form block is first-party JSON, not Form.io or SurveyJS.
- The Library action can save sections and forms as reusable snapshots.
- HTML export serializes the Puck JSON into portable markup with embedded CSS.
