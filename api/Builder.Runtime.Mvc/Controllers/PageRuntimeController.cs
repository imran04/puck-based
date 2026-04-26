using System.Net.Http.Headers;
using Builder.Runtime.Mvc.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Builder.Runtime.Mvc.Controllers;

public sealed class PageRuntimeController : Controller
{
    private readonly HttpClient _builderApi;
    private readonly BuilderApiOptions _options;

    public PageRuntimeController(
        IHttpClientFactory httpClientFactory,
        IOptions<BuilderApiOptions> options)
    {
        _builderApi = httpClientFactory.CreateClient("builder-runtime");
        _options = options.Value;
    }

    [AcceptVerbs("GET", "POST")]
    public async Task<IActionResult> Render(string? slug, CancellationToken cancellationToken)
    {
        var normalizedSlug = NormalizeSlug(slug, _options.DefaultPageSlug);
        if (string.IsNullOrWhiteSpace(normalizedSlug))
        {
            return BadRequest(new { error = "Page slug is required." });
        }

        var requestPath = BuildRenderPath(normalizedSlug, Request.QueryString.Value);
        using var upstreamRequest = new HttpRequestMessage(new HttpMethod(Request.Method), requestPath);
        upstreamRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/html"));

        if (HttpMethods.IsPost(Request.Method))
        {
            await AttachBodyAsync(upstreamRequest, Request, cancellationToken);
        }

        using var upstreamResponse = await _builderApi.SendAsync(
            upstreamRequest,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);
        var payload = await upstreamResponse.Content.ReadAsStringAsync(cancellationToken);
        var contentType = upstreamResponse.Content.Headers.ContentType?.ToString() ?? "text/plain; charset=utf-8";

        return new ContentResult
        {
            StatusCode = (int)upstreamResponse.StatusCode,
            Content = payload,
            ContentType = contentType,
        };
    }

    private static string NormalizeSlug(string? rawSlug, string defaultSlug)
    {
        var slug = (rawSlug ?? "").Trim().Trim('/');
        if (string.IsNullOrWhiteSpace(slug))
            slug = defaultSlug.Trim().Trim('/');
        return slug;
    }

    private static string BuildRenderPath(string slug, string? rawQueryString)
    {
        var encodedSlug = Uri.EscapeDataString(slug);
        var query = string.IsNullOrWhiteSpace(rawQueryString) ? "" : rawQueryString;
        return $"/api/pages/{encodedSlug}/render{query}";
    }

    private static async Task AttachBodyAsync(
        HttpRequestMessage upstreamRequest,
        HttpRequest request,
        CancellationToken cancellationToken)
    {
        if (request.ContentLength is null or <= 0)
            return;

        var buffer = new MemoryStream();
        await request.Body.CopyToAsync(buffer, cancellationToken);
        buffer.Position = 0;

        upstreamRequest.Content = new StreamContent(buffer);
        if (!string.IsNullOrWhiteSpace(request.ContentType))
        {
            upstreamRequest.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(request.ContentType);
        }
    }
}

