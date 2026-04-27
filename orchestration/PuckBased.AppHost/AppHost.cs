using Aspire.Hosting.JavaScript;

var builder = DistributedApplication.CreateBuilder(args);

// Builder API (source of truth for pages/forms/data/auth)
var builderApi = builder.AddProject<Projects.Builder_Api>("builder-api")
    .WithExternalHttpEndpoints();

// Runtime MVC host (xyz.com/{slug}-style renderer in production)
builder.AddProject<Projects.Builder_Runtime_Mvc>("runtime-mvc")
    .WithReference(builderApi)
    .WithEnvironment("BuilderApi__BaseUrl", builderApi.GetEndpoint("http"))
    .WaitFor(builderApi)
    .WithExternalHttpEndpoints();

// Next.js admin studio (Puck editor + admin surfaces)
builder.AddJavaScriptApp(
        name: "studio-admin",
        appDirectory: "../..",
        runScriptName: "dev")
    .WithHttpEndpoint(port: 3000, targetPort: 3000, name: "http", isProxied: false)
    .WithEnvironment("HOSTNAME", "0.0.0.0")
    .WithEnvironment("PORT", "3000")
    .WithEnvironment("BUILDER_API_URL", builderApi.GetEndpoint("http"))
    .WaitFor(builderApi);

builder.Build().Run();
