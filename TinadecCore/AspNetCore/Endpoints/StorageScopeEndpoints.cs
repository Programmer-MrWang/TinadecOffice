using TinadecCore.Abstractions.Ports;
using TinadecCore.Runtime;

namespace TinadecCore.AspNetCore.Endpoints;

public static class StorageScopeEndpoints
{
    public static IEndpointRouteBuilder MapStorageScopeEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/storage/scopes", async (IStorageScopeRegistry registry, CancellationToken ct) =>
        {
            var list = new List<object>();
            foreach (var scope in registry.List()) list.Add(await ToDtoAsync(scope, registry, ct).ConfigureAwait(false));
            return Results.Ok(list);
        });
        app.MapPost("/api/v1/storage/scopes/open", async (OpenScopeRequest request, IStorageScopeRegistry registry, CancellationToken ct) =>
            await HandleAsync(async () => Results.Ok(await ToDtoAsync(await registry.OpenAsync(new(request.ProjectPath,
                request.Name, request.Backend, request.StorageRoot, request.PostgresConnectionReference), ct).ConfigureAwait(false), registry, ct).ConfigureAwait(false))));
        app.MapGet("/api/v1/storage/scopes/{storageId}/diagnostics", async (string storageId, IStorageScopeRegistry registry, CancellationToken ct) =>
            await HandleAsync(async () =>
            {
                await using var lease = await registry.AcquireAsync(storageId, ct).ConfigureAwait(false);
                var configuration = await lease.Services.GetRequiredService<IConfigurationProjectionCoordinator>().CompileAsync(ct).ConfigureAwait(false);
                return Results.Ok(new { storage_id = storageId, scope = await ToDtoAsync(lease.Descriptor, registry, ct).ConfigureAwait(false),
                    diagnostics = lease.Descriptor.External ? new[] { new ConfigurationDiagnostic("external_storage", "This project uses an external storage root.", "warning") } : [],
                    configuration = new { content_hash = configuration.ContentHash, documents = configuration.Documents } });
            }));
        app.MapGet("/api/v1/storage/scopes/{storageId}/stats", async (string storageId, IStorageScopeRegistry registry, StorageMaintenanceService maintenance, CancellationToken ct) =>
            await HandleAsync(async () => { await using var lease = await registry.AcquireAsync(storageId, ct).ConfigureAwait(false); return Results.Ok(await maintenance.StatisticsAsync(lease.Descriptor, ct).ConfigureAwait(false)); }));
        app.MapPost("/api/v1/storage/scopes/{storageId}/cleanup-preview", async (string storageId, CleanupRequest request, StorageMaintenanceService maintenance, CancellationToken ct) =>
            await HandleAsync(async () => Results.Ok(await maintenance.PreviewAsync(storageId, request.Category, ct).ConfigureAwait(false))));
        app.MapPost("/api/v1/storage/scopes/{storageId}/cleanup", async (string storageId, CleanupApplyRequest request, StorageMaintenanceService maintenance, CancellationToken ct) =>
            await HandleAsync(async () => Results.Ok(await maintenance.ApplyAsync(storageId, request.PreviewId, ct).ConfigureAwait(false))));
        app.MapPost("/api/v1/storage/scopes/{storageId}/content-preview", async (string storageId, ContentCollectionService collection, CancellationToken ct) =>
            await HandleAsync(async () => Results.Ok(await collection.PreviewAsync(storageId, ct).ConfigureAwait(false))));
        app.MapPost("/api/v1/storage/scopes/{storageId}/content-collect", async (string storageId, CleanupApplyRequest request, ContentCollectionService collection, CancellationToken ct) =>
            await HandleAsync(async () => Results.Ok(await collection.ApplyAsync(storageId, request.PreviewId, ct).ConfigureAwait(false))));
        app.MapPost("/api/v1/storage/scopes/{storageId}/storage-delete-preview", async (string storageId, StorageMaintenanceService maintenance, CancellationToken ct) =>
            await HandleAsync(async () => Results.Ok(await maintenance.PreviewDeleteAsync(storageId, ct).ConfigureAwait(false))));
        app.MapPost("/api/v1/storage/scopes/{storageId}/storage-delete", async (string storageId, CleanupApplyRequest request, StorageMaintenanceService maintenance, CancellationToken ct) =>
            await HandleAsync(async () => Results.Ok(await maintenance.DeleteStorageAsync(storageId, request.PreviewId, ct).ConfigureAwait(false))));
        app.MapPost("/api/v1/storage/scopes/{storageId}/close", async (string storageId, IStorageScopeRegistry registry, CancellationToken ct) =>
            await HandleAsync(async () => { await registry.CloseAsync(storageId, ct).ConfigureAwait(false); return Results.NoContent(); }));
        app.MapDelete("/api/v1/storage/scopes/{storageId}", async (string storageId, IStorageScopeRegistry registry, CancellationToken ct) =>
            await HandleAsync(async () => { await registry.UnregisterAsync(storageId, ct).ConfigureAwait(false); return Results.NoContent(); }));
        app.MapPost("/api/v1/storage/scopes/{storageId}/configure", async (string storageId, ConfigureScopeRequest request, IStorageScopeRegistry registry, CancellationToken ct) =>
            await HandleAsync(async () => {
                var scope = await registry.ConfigureAsync(storageId, request.Backend, request.StorageRoot, request.PostgresConnectionReference, ct).ConfigureAwait(false);
                var dto = System.Text.Json.JsonSerializer.SerializeToNode(await ToDtoAsync(scope, registry, ct).ConfigureAwait(false))!;
                if (storageId == "user") { dto["restart_required"] = true; dto["requested_storage_root"] = request.StorageRoot ?? scope.Root; }
                return Results.Ok(dto);
            }));
        app.MapPost("/api/v1/storage/scopes/{storageId}/write-policy", async (string storageId, StorageWritePolicyRequest request, HttpContext http, IStorageScopeRegistry registry, CancellationToken ct) =>
            await HandleAsync(async () => {
                var expected = Environment.GetEnvironmentVariable("TINADEC_HOST_CONTROL_TOKEN");
                var supplied = http.Request.Headers["X-Tinadec-Host-Control"].ToString();
                if (string.IsNullOrEmpty(expected) || !System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                    System.Text.Encoding.UTF8.GetBytes(expected), System.Text.Encoding.UTF8.GetBytes(supplied)))
                    return Results.Problem(statusCode: 403, title: "host_authorization_required", extensions: new Dictionary<string, object?> { ["code"] = "host_authorization_required" });
                await registry.SetWritePolicyAsync(storageId, request.AllowStorageWrite, ct).ConfigureAwait(false);
                return Results.Ok(new { storage_id = storageId, allow_storage_write = request.AllowStorageWrite }); }));
        app.MapPost("/api/v1/storage/scopes/{storageId}/export", async (string storageId, StorageMaintenanceService maintenance, CancellationToken ct) =>
            await HandleAsync(async () => { var file = await maintenance.ExportAsync(storageId, ct).ConfigureAwait(false);
                return Results.File(new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, FileOptions.Asynchronous | FileOptions.DeleteOnClose),
                    "application/zip", "tinadec-" + storageId + ".zip"); }));

        app.MapGet("/api/v1/configuration/documents", (IScopeConfigurationDocuments documents) => Results.Ok(documents.DocumentIds));
        app.MapGet("/api/v1/configuration/documents/{id}", async (string id, HttpResponse response, IScopeConfigurationDocuments documents, CancellationToken ct) =>
            await HandleAsync(async () => { var document = await documents.ReadAsync(id, ct).ConfigureAwait(false); response.Headers.ETag = '"' + document.ContentHash + '"'; return Results.Ok(DocumentDto(document)); }));
        app.MapPost("/api/v1/configuration/documents/{id}/validate", async (string id, ConfigurationTextRequest request, IScopeConfigurationDocuments documents, CancellationToken ct) =>
            await HandleAsync(async () => { var diagnostics = await documents.ValidateAsync(id, request.Text, ct).ConfigureAwait(false); return Results.Ok(new { valid = !diagnostics.Any(x => x.Severity == "error"), diagnostics }); }));
        app.MapPut("/api/v1/configuration/documents/{id}", async (string id, ConfigurationTextRequest request, HttpContext http,
            IScopeConfigurationDocuments documents, IConfigurationProjectionCoordinator coordinator, CancellationToken ct) =>
            await HandleAsync(async () =>
            {
                var expected = http.Request.Headers.IfMatch.ToString();
                if (expected.Length == 0) return Results.Problem(statusCode: 428, title: "precondition_required", extensions: new Dictionary<string, object?> { ["code"] = "precondition_required" });
                var document = await documents.SaveIfMatchAsync(id, request.Text, expected.Trim('"'), ct).ConfigureAwait(false);
                await coordinator.ReconcileAsync(ct).ConfigureAwait(false);
                http.Response.Headers.ETag = '"' + document.ContentHash + '"';
                return Results.Ok(DocumentDto(document));
            }));
        return app;
    }

    internal static Task<object> ToDtoAsync(StorageScopeDescriptor scope, IStorageScopeRegistry registry, CancellationToken ct)
    {
        return Task.FromResult<object>(new { storage_id = scope.StorageId, scope_kind = scope.ScopeKind, project_id = scope.ProjectId, project_root = scope.ProjectRoot,
            storage_root = scope.Root, backend = scope.Backend, external = scope.External, postgres_connection_reference = scope.PostgresConnectionReference,
            allow_storage_write = registry.GetWritePolicy(scope.StorageId),
            paths = new { config = scope.Config, skills = scope.Skills, packages = scope.Packages, data = scope.Data, state = scope.State,
                logs = scope.Logs, cache = scope.Cache, temp = scope.Temp, worktrees = scope.Worktrees } });
    }

    private static object DocumentDto(ScopeConfigurationDocument d) => new { document_id = d.Id, path = d.Path, text = d.Text,
        content_hash = d.ContentHash, diagnostics = d.Diagnostics, version = d.Version };
    private static async Task<IResult> HandleAsync(Func<Task<IResult>> action)
    {
        try { return await action().ConfigureAwait(false); }
        catch (ConfigurationDocumentException ex) { return Results.Problem(statusCode: ex.Code.Contains("conflict", StringComparison.Ordinal) ? 412 : 400,
            title: ex.Code, detail: ex.Message, extensions: new Dictionary<string, object?> { ["code"] = ex.Code, ["diagnostics"] = ex.Diagnostics }); }
        catch (KeyNotFoundException ex) { return Results.Problem(statusCode: 404, title: "storage_scope_not_found", detail: ex.Message); }
        catch (ArgumentException ex) { return Results.Problem(statusCode: 400, title: "invalid_storage_request", detail: ex.Message); }
        catch (Exception ex) when (ex is InvalidOperationException or IOException or UnauthorizedAccessException or FormatException or Tomlyn.TomlException)
        { return Results.Problem(statusCode: 409, title: "storage_conflict", detail: ex.Message); }
    }

    public sealed record OpenScopeRequest(string ProjectPath, string? Name = null, string? Backend = null, string? StorageRoot = null, string? PostgresConnectionReference = null);
    public sealed record ConfigureScopeRequest(string Backend, string? StorageRoot = null, string? PostgresConnectionReference = null);
    public sealed record CleanupRequest(string Category);
    public sealed record CleanupApplyRequest(string PreviewId);
    public sealed record StorageWritePolicyRequest(bool AllowStorageWrite);
    public sealed record ConfigurationTextRequest(string Text);
}
