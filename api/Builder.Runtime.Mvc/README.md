# Builder Runtime MVC Host

This is a standalone ASP.NET MVC runtime host that serves published pages by slug:

- `GET /{slug}` -> proxies to `GET {BuilderApi.BaseUrl}/api/pages/{slug}/render`
- `POST /{slug}` -> proxies to `POST {BuilderApi.BaseUrl}/api/pages/{slug}/render`

It is intended for domain-hosted runtime delivery (for example `xyz.com/{slug}`).

## Configuration

Set in `appsettings.json` (or environment overrides):

```json
{
  "BuilderApi": {
    "BaseUrl": "http://127.0.0.1:5056",
    "DefaultPageSlug": "home"
  }
}
```

- `BaseUrl`: Builder API origin
- `DefaultPageSlug`: slug used when request path is `/`

## Run locally

```powershell
dotnet run --project api/Builder.Runtime.Mvc/Builder.Runtime.Mvc.csproj --urls http://127.0.0.1:5090
```

Then open:

- `http://127.0.0.1:5090/`
- `http://127.0.0.1:5090/runtime-filter-smoke?cat=phone`

