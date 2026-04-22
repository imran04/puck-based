# Datasource & Dynamic Tables Feature

## What was asked

1. **Dynamic tables with relations** — users can create custom tables with typed columns and define 1:1, 1:N, N:N relations between them
2. **Tables as datasources in the page editor** — each page can configure named datasources (single record, list) with filters; components can bind their text fields to datasource fields via `{DS:source.field}` markers
3. **Publish → Razor artifact + compiled binary** — on publish, placeholders transform to `@ViewBag` syntax (CSHTML stored in DB), and a C# renderer class is compiled with Roslyn to assembly bytes (also stored in DB), plus a datasource map JSON
4. **Runtime render controller** — `GET /api/pages/{id}/render` resolves datasource queries, populates a ViewBag dictionary, loads the compiled assembly, and returns rendered HTML

---

## Backend (api/Builder.Api/)

- **New models:** `TableDefinition`, `TableRelation`, `DynamicRow`, `DynamicRelationRow`
- **Updated Page model:** Added `DataSourceMapJson`, `RazorTemplate`, `CompiledAssemblyBytes` columns
- **DbContext:** `BuilderDbContext.cs` — 7 DbSets, EF Core mappings
- **RazorCompiler service:** `Services/RazorCompiler.cs` — uses Roslyn `CSharpCompilation` to compile C# renderer to assembly bytes
- **NuGet:** `Microsoft.CodeAnalysis.CSharp 5.0.0` (must be 5.x to match EF Core Design 10.x dependency on Roslyn 5)
- **Program.cs:** Full CRUD for tables, rows, relations; publish endpoint compiles renderer; `/api/pages/{id}/render` resolves datasources and invokes compiled assembly
- **Schema migration:** `EnsureCreatedAsync()` + inline `IF NOT EXISTS` CREATE TABLE / ALTER TABLE for both new tables and new Page columns (no EF migrations used)

### Schema bootstrap order (Program.cs)

1. `EnsureCreatedAsync()` — creates full schema for fresh DBs
2. ALTER TABLE Pages — adds `DataSourceMapJson`, `RazorTemplate`, `CompiledAssemblyBytes` if missing
3. CREATE TABLE `TableDefinitions` if not exists
4. CREATE TABLE `TableRelations` if not exists (FK cascade to TableDefinitions)
5. CREATE TABLE `DynamicRows` if not exists (FK cascade to TableDefinitions)
6. CREATE TABLE `DynamicRelationRows` if not exists (FK cascade to TableRelations)

---

## Frontend (src/)

- **`lib/tables-api.ts`:** Server-only API client for table/row/relation CRUD
- **`lib/datasource-template.ts`:** Generates `{DS:source.field}` and `{DS_LIST_START:x}...{DS_LIST_END}` markers in HTML, CSHTML template, and C# renderer source
- **`lib/builder-api.ts`:** Updated `publishApiPage` to accept and forward `TemplateBundle`
- **`lib/page-store.ts`:** Updated `publishPage` to accept optional `TemplateBundle`
- **API routes:** `/api/tables/**` proxy routes (tables, rows, relations)
- **Updated publish route:** Calls `buildTemplateBundle()` before publishing to generate Razor + C# source
- **UI pages:** `/tables` (manager), `/tables/[tableId]` (schema designer), `/tables/[tableId]/data` (row editor)
- **Components:** `TableDesigner.tsx`, `TableDataEditor.tsx`, `DataSourcePanel.tsx` (DataSourceManager + DsBindingsEditor)
- **Puck config:** Added `dataSources` field to root, `_dsBindings` field to Hero/Heading/FeatureCard/Callout, new `DynamicList` component for list iteration
- **Dashboard:** Added Tables link and Render button (points to ASP.NET render endpoint)

---

## Key design decisions

- Template generation is a two-path system: `export-html.tsx` for static export, `datasource-template.ts` for datasource-aware publish
- C# renderer uses Base64-encoded HTML template + regex replacement at runtime (avoids string escaping, handles both single-record and list bindings)
- CSHTML template stored as human-readable artifact; compiled assembly bytes for actual runtime rendering
- `usePuck().appState.data.root.props.dataSources` is how the DsBindingsEditor reads page-level datasources in the Puck editor context

---

## Bugs fixed during implementation

| Bug | Fix |
|-----|-----|
| `RouteContext` typed params error on new API routes | Used `{ params: Promise<{ tableId: string }> }` pattern instead |
| `TableDataEditor` inputType TS error | Used `const typeMap: Record<string, string>` with explicit type |
| `usePuck()` wrong property (`state` vs `appState`) | Changed to `const { appState } = usePuck()` (Puck v0.21 API) |
| Roslyn version conflict with EF Core 10 | Upgraded `Microsoft.CodeAnalysis.CSharp` from 4.14.0 → 5.0.0 |
| `Invalid object name 'TableDefinitions'` on existing DB | Added inline `IF NOT EXISTS CREATE TABLE` SQL for all 4 new tables in schema bootstrap |

---

## Outstanding issue

**`usePuck` Turbopack build error** — `config.tsx` imports `usePuck` from `@puckeditor/core`, but `config.tsx` is also imported by the server component `src/app/p/[pageId]/page.tsx`. Turbopack resolves `@puckeditor/core` using the `react-server` export condition for server-component import chains, which maps to `rsc.mjs` — and that bundle does not export `usePuck`.

**Error message:**
```
./src/puck/config.tsx:1:1
Export usePuck doesn't exist in target module
```

**Root cause:** `config.tsx` has no `"use client"` directive, so when imported from a server page, Turbopack uses the RSC variant of `@puckeditor/core`.

**Planned fix:**
1. Remove `usePuck` from the import in `config.tsx`
2. Extract the render function inside `dsBindingsField()` (lines 314–335 of `config.tsx`) into a new `"use client"` file (e.g. `src/puck/DsBindingsFieldRenderer.tsx`) that imports `usePuck` there
3. Have `config.tsx` import and use that component — since `config.tsx` itself no longer directly imports `usePuck`, Turbopack won't try to find it in the RSC bundle

The dev server (`next dev`) works fine; only `next build` triggers the error.
