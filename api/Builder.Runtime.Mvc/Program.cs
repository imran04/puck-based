using Builder.Runtime.Mvc.Models;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<BuilderApiOptions>(
    builder.Configuration.GetSection(BuilderApiOptions.SectionName));
builder.Services.AddHttpClient("builder-runtime", (serviceProvider, client) =>
{
    var options = serviceProvider.GetRequiredService<IOptions<BuilderApiOptions>>().Value;
    var baseUrl = string.IsNullOrWhiteSpace(options.BaseUrl)
        ? "http://127.0.0.1:5056"
        : options.BaseUrl.TrimEnd('/');

    client.BaseAddress = new Uri(baseUrl, UriKind.Absolute);
});
builder.Services.AddControllersWithViews();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseAuthorization();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "runtime-page",
    pattern: "{*slug}",
    defaults: new { controller = "PageRuntime", action = "Render" })
    .WithStaticAssets();


app.Run();
