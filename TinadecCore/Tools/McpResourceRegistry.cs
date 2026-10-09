using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Contracts.Dtos;
using TinadecCore.Persistence;

namespace TinadecCore.Tools;

/// <summary>Managed MCP resources projected from the scope mcp.toml configuration.</summary>
public sealed class McpResourceRegistry(IDbContextFactory<ToolsSettingsDbContext> factory, ITenantContextAccessor tenant,
    ISecretStore secrets, ISessionLocator sessions) : IMcpResourceRegistry
{
    private const string Mask = "********";
    private readonly SemaphoreSlim _importGate = new(1, 1);
    public async Task<McpResourceCatalogSnapshot> CaptureAsync(Guid? projectId, CancellationToken cancellationToken = default)
    {
        await EnsureImportedAsync(projectId, cancellationToken);
        var rows = await RowsAsync(projectId, cancellationToken);
        return new(rows.Select(ToDto).ToArray(), rows.Select(ToSnapshot).ToArray());
    }
    public async Task<IReadOnlyList<McpResourceDto>> ListAsync(Guid? projectId, CancellationToken cancellationToken = default)
    {
        await EnsureImportedAsync(projectId, cancellationToken);
        return (await RowsAsync(projectId, cancellationToken)).Select(ToDto).ToArray();
    }
    public async Task<McpResourceDto?> GetAsync(Guid resourceId, CancellationToken cancellationToken = default)
    {
        await using var db = await factory.CreateDbContextAsync(cancellationToken);
        var actor = tenant.Current;
        var row = await db.McpResources.AsNoTracking().SingleOrDefaultAsync(x => x.Id == resourceId && x.TenantId == actor.TenantId && x.WorkspaceId == actor.WorkspaceId && x.DeletedAt == null, cancellationToken);
        return row is null ? null : ToDto(row);
    }
    public async Task<McpResourceDto> SaveAsync(Guid? resourceId, McpResourceWriteDto input, long expectedRevision, CancellationToken cancellationToken = default)
    {
        await ValidateProjectAsync(input.ProjectId, cancellationToken);
        ValidateInput(input);
        await using var db = await factory.CreateDbContextAsync(cancellationToken);
        var actor = tenant.Current;
        var scope = Scope(input.ProjectId);
        var row = resourceId is null ? null : await db.McpResources.SingleOrDefaultAsync(x => x.Id == resourceId && x.TenantId == actor.TenantId && x.WorkspaceId == actor.WorkspaceId && x.DeletedAt == null, cancellationToken);
        if (resourceId is not null && row is null) throw new ToolSettingsException("mcp_resource_not_found", "MCP resource not found.", 404);
        if ((row?.Revision ?? 0) != expectedRevision) throw new ToolSettingsException("revision_conflict", "MCP resource changed since it was read.", 412);
        if (row is not null && row.ProjectId != input.ProjectId) throw new ToolSettingsException("invalid_mcp_scope", "Resource scope is immutable. Create a resource in the other scope.");
        if (await db.McpResources.AnyAsync(x => x.TenantId == actor.TenantId && x.WorkspaceId == actor.WorkspaceId && x.ScopeKey == scope && x.ServerId == input.Id && x.Id != (resourceId ?? Guid.Empty) && x.DeletedAt == null, cancellationToken)) throw new ToolSettingsException("mcp_id_conflict", "A server with this id already exists in this scope.", 409);
        var references = row is null ? new Dictionary<string, string>() : ParseReferences(row.SecretReferencesJson);
        if (input.Env is not null)
        {
            var next = new Dictionary<string, string>();
            foreach (var pair in input.Env)
            {
                if (string.IsNullOrWhiteSpace(pair.Key) || pair.Key.Length > 128 || pair.Key.Contains('=') || pair.Key.Contains('\0') || pair.Value?.Length > 32768) throw new ToolSettingsException("invalid_mcp_environment", "Invalid environment name or value.");
                if (pair.Value is null) continue;
                if (pair.Value == Mask)
                {
                    if (!references.TryGetValue(pair.Key, out var existing)) throw new ToolSettingsException("missing_mcp_secret", "A masked environment value needs an existing secret.");
                    next[pair.Key] = existing;
                }
                else next[pair.Key] = await secrets.PutAsync("mcp-" + Guid.NewGuid().ToString("N"), pair.Value, cancellationToken);
            }
            references = next;
        }
        // Deleted rows keep old versioned secret references, while their identity is reusable.
        var deleted = await db.McpResources.Where(x => x.TenantId == actor.TenantId && x.WorkspaceId == actor.WorkspaceId && x.ScopeKey == scope && x.ServerId == input.Id && x.DeletedAt != null).ToListAsync(cancellationToken);
        foreach (var old in deleted) old.ServerId = "deleted-" + old.Id.ToString("N");
        if (row is null) { row = new() { Id = Guid.NewGuid(), TenantId = actor.TenantId, WorkspaceId = actor.WorkspaceId, ProjectId = input.ProjectId, ScopeKey = scope }; db.McpResources.Add(row); }
        row.ServerId = input.Id; row.Name = string.IsNullOrWhiteSpace(input.Name) ? input.Id : input.Name; row.Command = input.Command;
        row.Enabled = input.Enabled; row.ArgsJson = JsonSerializer.Serialize(input.Args); row.SecretReferencesJson = JsonSerializer.Serialize(references); row.Cwd = input.Cwd;
        row.Revision++; row.UpdatedAt = DateTimeOffset.UtcNow; row.UpdatedByPrincipalId = actor.PrincipalId;
        row.ConfigurationHash = ToolSettingsSchema.Hash(JsonSerializer.SerializeToElement(new { row.Id, row.ServerId, row.Name, row.Command, row.ArgsJson, row.SecretReferencesJson, row.Cwd, row.Enabled, row.Revision }));
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { throw new ToolSettingsException("revision_conflict", "MCP resources changed concurrently. Reload before saving.", 412); }
        return ToDto(row);
    }
    public async Task DeleteAsync(Guid resourceId, long expectedRevision, CancellationToken cancellationToken = default)
    {
        await using var db = await factory.CreateDbContextAsync(cancellationToken);
        var actor = tenant.Current;
        var row = await db.McpResources.SingleOrDefaultAsync(x => x.Id == resourceId && x.TenantId == actor.TenantId && x.WorkspaceId == actor.WorkspaceId && x.DeletedAt == null, cancellationToken) ?? throw new ToolSettingsException("mcp_resource_not_found", "MCP resource not found.", 404);
        if (row.Revision != expectedRevision) throw new ToolSettingsException("revision_conflict", "MCP resource changed since it was read.", 412);
        row.Revision++; row.DeletedAt = row.UpdatedAt = DateTimeOffset.UtcNow;
        try { await db.SaveChangesAsync(cancellationToken); } catch (DbUpdateConcurrencyException) { throw new ToolSettingsException("revision_conflict", "MCP resource changed concurrently.", 412); }
    }
    public async Task<IReadOnlyList<ToolMcpServerSnapshotDto>> ResolveAsync(Guid? projectId, IReadOnlyList<Guid>? resourceIds, CancellationToken cancellationToken = default)
    {
        await EnsureImportedAsync(projectId, cancellationToken);
        var rows = await RowsAsync(projectId, cancellationToken);
        var selected = rows.Where(x => resourceIds is null || resourceIds.Contains(x.Id));
        var effective = (resourceIds is null ? selected.GroupBy(x => x.ServerId, StringComparer.OrdinalIgnoreCase).Select(g => g.OrderByDescending(x => x.ProjectId is not null).First()) : selected).Where(x => x.Enabled).ToArray();
        if (resourceIds is not null && resourceIds.Any(id => rows.All(x => x.Id != id))) throw new ToolSettingsException("mcp_binding_not_found", "An MCP binding is outside this project or no longer exists.");
        return effective.Select(ToSnapshot).ToArray();
    }
    public Task EnsureImportedAsync(Guid? projectId, CancellationToken cancellationToken = default) =>
        ValidateProjectAsync(projectId, cancellationToken);
    private async Task<IReadOnlyList<McpResourceRecord>> RowsAsync(Guid? projectId, CancellationToken ct)
    {
        await ValidateProjectAsync(projectId, ct);
        var actor = tenant.Current;
        await using var db = await factory.CreateDbContextAsync(ct);
        return await db.McpResources.AsNoTracking().Where(x => x.TenantId == actor.TenantId && x.WorkspaceId == actor.WorkspaceId && x.DeletedAt == null && (x.ProjectId == null || x.ProjectId == projectId)).OrderBy(x => x.Name).ToListAsync(ct);
    }
    private async Task ValidateProjectAsync(Guid? projectId, CancellationToken ct)
    {
        if (projectId is null) return;
        var actor = tenant.Current;
        var project = await sessions.FindProjectAsync(projectId.Value, ct);
        if (project is null || project.TenantId != actor.TenantId || project.WorkspaceId != actor.WorkspaceId) throw new ToolSettingsException("project_not_found", "Project not found.", 404);
    }
    private static string Scope(Guid? id) => id is null ? "shared" : "project:" + id.Value.ToString("N");
    private static void ValidateInput(McpResourceWriteDto input)
    {
        if (string.IsNullOrWhiteSpace(input.Id) || input.Id.Length > 128 || input.Id.Any(c => !(char.IsLetterOrDigit(c) || c is '_' or '-' or '.')) || string.IsNullOrWhiteSpace(input.Command) || input.Command.Length > 2048 || input.Name is null || input.Name.Length > 256 || input.Args is null || input.Args.Count > 256 || input.Args.Any(x => x is null || x.Length > 8192) || input.Cwd?.Length > 2048 || input.Env?.Count > 128) throw new ToolSettingsException("invalid_mcp_resource", "Invalid MCP server identity, command, arguments or environment.");
        if (input.Env is not null && input.Env.Any(x => string.IsNullOrWhiteSpace(x.Key) || x.Key.Length > 128 || x.Key.Contains('=') || x.Key.Contains('\0') || x.Value?.Length > 32768)) throw new ToolSettingsException("invalid_mcp_environment", "Invalid MCP environment name or value.");
    }
    private static Dictionary<string,string> ParseReferences(string json) => JsonSerializer.Deserialize<Dictionary<string,string>>(json) ?? [];
    private static ToolMcpServerSnapshotDto ToSnapshot(McpResourceRecord row) => new() { ResourceId = row.Id, Id = row.ServerId, Name = row.Name, Command = row.Command, Args = JsonSerializer.Deserialize<string[]>(row.ArgsJson) ?? [], SecretReferences = ParseReferences(row.SecretReferencesJson), Cwd = row.Cwd, Revision = row.Revision, ConfigurationHash = row.ConfigurationHash };
    private static McpResourceDto ToDto(McpResourceRecord row) => new() { ResourceId = row.Id, ProjectId = row.ProjectId, Id = row.ServerId, Name = row.Name, Enabled = row.Enabled, Command = row.Command, Args = JsonSerializer.Deserialize<string[]>(row.ArgsJson) ?? [], Env = ParseReferences(row.SecretReferencesJson).ToDictionary(x => x.Key, _ => (string?)Mask), Cwd = row.Cwd, Revision = row.Revision, ConfigurationHash = row.ConfigurationHash, UpdatedAt = row.UpdatedAt, ImportSource = row.ImportSource };
}
