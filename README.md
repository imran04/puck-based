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

## Routes

- `/` - builder dashboard
- `/api/pages` - list/create pages for the dashboard
- `/builder/pages/home` - Puck WYSIWYG editor
- `/p/home` - published page render
- `/api/pages/home/export` - standalone HTML export
- `/api/forms/submit` - placeholder form submission endpoint
- `/api/custom-blocks` - Next proxy for saved sections/forms
- ASP.NET API: `/api/pages/{id}`, `/api/custom-blocks`, `/api/form-submissions`

## Storage

- Next uses `BUILDER_API_URL` when set, or `http://127.0.0.1:5056` by default.
- The ASP.NET app uses MSSQL LocalDB: `(localdb)\MSSQLLocalDB`, database `PuckBuilder`.
- If the API is not running, Next falls back to ignored local JSON files under `data/`.

## Builder Security

Set `BUILDER_TOKEN` in deployed environments to protect `/builder/*` and the publish API.

With a token set, open the builder once with:

```text
/builder/pages/home?token=YOUR_TOKEN
```

The app stores the token in an HTTP-only cookie for later same-origin publish requests.

## Notes

- Puck owns the drag-and-drop editor surface.
- The form block is first-party JSON, not Form.io or SurveyJS.
- The Library action can save sections and forms as reusable snapshots.
- HTML export serializes the Puck JSON into portable markup with embedded CSS.
