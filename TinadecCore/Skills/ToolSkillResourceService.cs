using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Contracts.Dtos;
using TinadecCore.Persistence;

namespace TinadecCore.Skills;

/// <summary>Project files and immutable Core-owned packages exposed through one validated catalog.</summary>
public sealed class ToolSkillResourceService(
    IDbContextFactory<IntegrationDbContext> database,
    ITenantContextAccessor tenants,
    ISessionLocator sessions,
    StoragePaths storage,
    IServiceProvider services,
    IToolProvider provider) : IToolSkillResourceService, IToolSkillCatalog
{
    public async Task<ToolSkillListDto> ListAsync(Guid? projectId, CancellationToken cancellationToken = default)
    {
        var scope = tenants.Current;
        var project = await Project(projectId, cancellationToken);
        await using var db = await database.CreateDbContextAsync(cancellationToken);
        var rows = await db.SharedSkills.AsNoTracking().Where(x => x.TenantId == scope.TenantId
            && x.WorkspaceId == scope.WorkspaceId && x.DeletedAt == null).ToArrayAsync(cancellationToken);
        var found = rows.Select(Shared).ToList();
        if (project is not null)
            found.AddRange(WorkspaceSkillDiscovery.Discover(project.RootPath).Select(x => ProjectDto(project, x)));
        var projectNames = found.Where(x => x.Scope == "project").Select(x => x.Name).ToHashSet(StringComparer.Ordinal);
        found = found.Select(x => x.Scope == "shared" && projectNames.Contains(x.Name)
            ? x with { Reason = x.Reason ?? "shadowed by a project skill with the same name for inherited bindings" } : x).ToList();
        return new(found.OrderBy(x => x.Name, StringComparer.Ordinal).ThenBy(x => x.Scope).ToArray(),
            found.Where(x => !x.Valid).Select(x => $"{x.Path}: {x.Reason}").ToArray());
    }

    public async Task<ToolSkillResourceDto?> GetAsync(Guid resourceId, Guid? projectId, CancellationToken cancellationToken = default)
    {
        var resource = (await ListAsync(projectId, cancellationToken)).Skills.FirstOrDefault(x => x.ResourceId == resourceId);
        if (resource is null) return null;
        if (!resource.Valid && resource.ContentHash.Length == 0) return resource;
        var root = resource.Scope == "project" ? (await Project(projectId, cancellationToken))!.RootPath : Path.GetDirectoryName(resource.Path)!;
        var entry = WorkspaceSkillDiscovery.Read(root, resource.Path);
        if (entry.Content is null) return resource with { Valid = false, Reason = entry.Reason };
        var hash = resource.Scope == "project" ? await FileHash(root, resource.Path, cancellationToken) : entry.ContentHash;
        var packageRoot = Path.GetDirectoryName(resource.Path)!;
        var packageFiles = PackageFiles(packageRoot);
        var packageHash = ActualPackageHash(packageRoot);
        if (resource.Scope == "shared" && !string.Equals(packageHash, resource.ContentHash, StringComparison.Ordinal))
            return resource with { Valid = false, Availability = "invalid", Reason = "Skill package bytes changed outside Core; reinstall the reviewed package.", Content = entry.Content, FileHash = hash, PackageHash = packageHash, PackageFiles = packageFiles };
        return resource with { Content = entry.Content, FileHash = hash, PackageHash = packageHash, PackageFiles = packageFiles };
    }

    public async Task<ToolSkillFileDto?> GetFileAsync(Guid resourceId, Guid? projectId, string relativePath, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
            throw new ToolSettingsException("invalid_skill_asset", "A relative package path is required.");
        var resource = await GetAsync(resourceId, projectId, cancellationToken);
        if (resource is null) return null;
        var packageRoot = Path.GetDirectoryName(resource.Path)!;
        ValidateAsset(relativePath, allowSkillFile: true);
        var path = Path.GetFullPath(Path.Combine(packageRoot, relativePath.Replace('/', Path.DirectorySeparatorChar)));
        if (!WorkspaceSkillDiscovery.IsContained(packageRoot, path))
            throw new ToolSettingsException("skill_path_escape", "The requested package file is outside the skill root.");
        if (!File.Exists(path)) return null;
        var bytes = await File.ReadAllBytesAsync(path, cancellationToken);
        var hash = Convert.ToHexStringLower(SHA256.HashData(bytes));
        string? content = null;
        try { content = new UTF8Encoding(false, true).GetString(bytes); } catch (DecoderFallbackException) { }
        return new ToolSkillFileDto { Path = relativePath.Replace('\\', '/'), ContentHash = hash, SizeBytes = bytes.LongLength, Content = content, Base64 = Convert.ToBase64String(bytes) };
    }

    public async Task<IReadOnlyList<ToolSkillSnapshotDto>> ResolveAsync(Guid? projectId, IReadOnlyList<Guid>? resourceIds, CancellationToken cancellationToken = default)
    {
        var catalog = (await ListAsync(projectId, cancellationToken)).Skills;
        IEnumerable<ToolSkillResourceDto> selected;
        if (resourceIds is not null)
        {
            var exact = new List<ToolSkillResourceDto>();
            foreach (var id in resourceIds)
            {
                var resource = catalog.FirstOrDefault(x => x.ResourceId == id);
                if (resource is null || !resource.Valid)
                    throw new ToolSettingsException("invalid_skill_binding", $"Skill {id} is missing, invalid or outside the selected project.");
                if (resource.Enabled) exact.Add(resource);
            }
            selected = exact;
        }
        else
        {
            var projectNames = catalog.Where(x => x.Scope == "project").Select(x => x.Name).ToHashSet(StringComparer.Ordinal);
            selected = catalog.Where(x => x.Valid && x.Enabled && (x.Scope == "project" || !projectNames.Contains(x.Name)));
        }
        return selected.Select(x => new ToolSkillSnapshotDto
        {
            ResourceId = x.ResourceId, Name = x.Name, Description = x.Description,
            RootPath = Path.GetDirectoryName(x.Path)!, SkillPath = x.Path, Revision = x.Revision, ContentHash = x.ContentHash,
        }).ToArray();
    }

    public async Task<ToolSkillCatalogSnapshot> CaptureAsync(Guid? projectId, CancellationToken cancellationToken = default)
    {
        var resources = (await ListAsync(projectId, cancellationToken)).Skills;
        var snapshots = new List<ToolSkillSnapshotDto>();
        foreach (var resource in resources.Where(x => x.Valid))
        {
            var root = Path.GetDirectoryName(resource.Path)!;
            var hash = resource.ContentHash;
            if (resource.Scope == "project")
            {
                var capture = await ProjectSkillPackageCapture.CaptureAsync(storage, tenants.Current.TenantId,
                    tenants.Current.WorkspaceId, resource.Name, root, resource.ContentHash, cancellationToken);
                root = capture.RootPath;
                hash = capture.ContentHash;
            }
            snapshots.Add(new ToolSkillSnapshotDto
            {
                ResourceId = resource.ResourceId, Name = resource.Name, Description = resource.Description,
                RootPath = root, SkillPath = Path.Combine(root, "SKILL.md"), Revision = resource.Revision, ContentHash = hash,
            });
        }
        return new ToolSkillCatalogSnapshot(resources, snapshots);
    }

    /// <summary>
    /// The settings surface never writes a Skill directly. A shared package is queued as a governed
    /// <c>skill_resource_update</c> action and only lands when a human approves it; a project package
    /// is delegated to the existing governed project-file action. The receipt carries the frozen
    /// file manifest and package hash so the reviewer can see exactly what will be written.
    /// </summary>
    public async Task<ToolSkillResourceDto> RequestSaveAsync(Guid? resourceId, Guid? projectId, ToolSkillWriteDto input, long expectedRevision, CancellationToken cancellationToken = default)
    {
        projectId ??= input.ProjectId;
        var existing = resourceId is { } id ? await GetAsync(id, projectId, cancellationToken) : null;
        if (resourceId is not null && existing is null) throw new ToolSettingsException("skill_not_found", "Skill resource not found.", 404);
        if ((existing?.Revision ?? 0) != expectedRevision) throw Conflict();
        var isProject = existing?.Scope == "project" || existing is null && input.Scope == "project";
        if (isProject || existing?.Scope == "project") return await SaveAsync(resourceId, projectId, input, expectedRevision, cancellationToken);
        if (existing is null && input.Scope != "shared") throw new ToolSettingsException("invalid_scope", "Scope must be shared or project.");
        if (existing is null)
        {
            var scope = tenants.Current;
            await using var lookup = await database.CreateDbContextAsync(cancellationToken);
            if (await lookup.SharedSkills.AnyAsync(x => x.TenantId == scope.TenantId && x.WorkspaceId == scope.WorkspaceId
                && x.Name == input.Name && x.DeletedAt == null, cancellationToken))
                throw new ToolSettingsException("duplicate_skill", "A shared skill already has this name.", 409);
        }

        var name = existing?.Name ?? input.Name ?? "";
        if (!WorkspaceSkillPolicy.ValidateName(name, out var reason)) throw new ToolSettingsException("invalid_skill", reason);
        var content = input.Content ?? existing?.Content ?? throw new ToolSettingsException("invalid_skill", "Skill content is required.");
        if (input.Enabled is { } flagged) content = WorkspaceSkillDiscovery.SetEnabled(content, flagged);
        var parse = WorkspaceSkillDiscovery.SetEnabled(content, true);
        if (Encoding.UTF8.GetByteCount(content) > WorkspaceSkillPolicy.MaxFileBytes
            || !WorkspaceSkillPolicy.TryRead(parse, name, WorkspaceSkillPolicy.RelativePathFor(name), out var skill, out reason))
            throw new ToolSettingsException("invalid_skill", reason.Length == 0 ? "Skill document exceeds the hard size limit." : reason);
        if (existing is not null && input.Files is not null && !input.ReplaceFiles)
            throw new ToolSettingsException("skill_assets_replace_confirmation", "Replacing a package's assets requires replace_files=true.", 428);

        var files = new SortedDictionary<string, byte[]>(StringComparer.Ordinal) { ["SKILL.md"] = Encoding.UTF8.GetBytes(content) };
        if (existing is not null && input.Files is null)
            foreach (var file in SafePackagePaths(Path.GetDirectoryName(existing.Path)!))
            {
                if (!WorkspaceSkillDiscovery.IsContained(Path.GetDirectoryName(existing.Path)!, file)) throw new ToolSettingsException("skill_path_escape", "Existing asset escapes the package.");
                var relative = Path.GetRelativePath(Path.GetDirectoryName(existing.Path)!, file).Replace('\\', '/');
                if (relative != "SKILL.md") files.Add(relative, await File.ReadAllBytesAsync(file, cancellationToken));
            }
        if (input.Files is not null)
        {
            var normalizedAssets = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "SKILL.md" };
            foreach (var (relative, base64) in input.Files)
            {
                ValidateAsset(relative);
                if (!normalizedAssets.Add(relative)) throw new ToolSettingsException("invalid_skill_asset", "Asset paths must be unique ignoring case.");
                try { files.Add(relative, Convert.FromBase64String(base64)); }
                catch (Exception ex) when (ex is FormatException or ArgumentException) { throw new ToolSettingsException("invalid_skill_asset", "Asset must have a unique safe relative path and base64 content."); }
            }
        }
        if (files.Count > 256 || files.Sum(x => (long)x.Value.Length) > 16 * 1024 * 1024)
            throw new ToolSettingsException("skill_package_budget", "Skill packages are limited to 256 files and 16 MiB.");
        var hash = PackageDigest(files);
        var resourceIdForReview = existing?.ResourceId ?? input.ReservedResourceId ?? Guid.NewGuid();
        var parameters = new
        {
            action = "save", resource_id = resourceIdForReview, expected_revision = expectedRevision,
            expected_package_hash = existing?.PackageHash, scope = "shared", name, content,
            files = files.Where(x => x.Key != "SKILL.md").ToDictionary(x => x.Key, x => Convert.ToBase64String(x.Value)),
            replace_files = true, expected_package_digest = hash,
            source = input.Source, version = input.Version, commit = input.Commit,
        };
        var action = await services.GetRequiredService<IUserToolActionService>().CreateAsync(new UserToolActionRequest(
            Guid.Empty, "skill_resource_update", JsonSerializer.Serialize(parameters, new JsonSerializerOptions { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull }),
            IdempotencyKey: $"skill-request:{resourceIdForReview:N}:{expectedRevision}:{hash}"), cancellationToken);
        return new ToolSkillResourceDto
        {
            ResourceId = resourceIdForReview, Scope = "shared", Name = name, Description = skill!.Description,
            Enabled = input.Enabled ?? true, Valid = false, Reason = "pending governed approval",
            Revision = expectedRevision, ContentHash = hash, PackageHash = hash, Availability = "pending",
            Source = NormalizeSource(input.Source), Version = input.Version, Commit = input.Commit,
            PackageFiles = files.Select(x => new ToolSkillPackageFileDto
            {
                Path = x.Key, ContentHash = Convert.ToHexStringLower(SHA256.HashData(x.Value)), SizeBytes = x.Value.LongLength,
            }).ToArray(),
            Content = content, UserActionId = action.Id, ActionStatus = action.Status,
        };
    }

    internal static string PackageDigest(SortedDictionary<string, byte[]> files)
    {
        using var digest = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        foreach (var (relative, bytes) in files) { digest.AppendData(Encoding.UTF8.GetBytes(relative + "\0" + bytes.Length + "\0")); digest.AppendData(bytes); }
        return Convert.ToHexStringLower(digest.GetHashAndReset());
    }

    public async Task<ToolSkillResourceDto> SaveAsync(Guid? resourceId, Guid? projectId, ToolSkillWriteDto input, long expectedRevision, CancellationToken cancellationToken = default)
    {
        projectId ??= input.ProjectId;
        var existing = resourceId is { } id ? await GetAsync(id, projectId, cancellationToken) : null;
        if (resourceId is not null && existing is null) throw new ToolSettingsException("skill_not_found", "Skill resource not found.", 404);
        if ((existing?.Revision ?? 0) != expectedRevision) throw Conflict();
        var name = existing?.Name ?? input.Name ?? "";
        if (!WorkspaceSkillPolicy.ValidateName(name, out var reason)) throw new ToolSettingsException("invalid_skill", reason);
        var content = input.Content ?? existing?.Content ?? throw new ToolSettingsException("invalid_skill", "Skill content is required.");
        if (input.Enabled is { } enabled) content = WorkspaceSkillDiscovery.SetEnabled(content, enabled);
        var parse = WorkspaceSkillDiscovery.SetEnabled(content, true);
        if (Encoding.UTF8.GetByteCount(content) > WorkspaceSkillPolicy.MaxFileBytes
            || !WorkspaceSkillPolicy.TryRead(parse, name, WorkspaceSkillPolicy.RelativePathFor(name), out var skill, out reason))
            throw new ToolSettingsException("invalid_skill", reason.Length == 0 ? "Skill document exceeds the hard size limit." : reason);
        var isProject = existing?.Scope == "project" || existing is null && input.Scope == "project";
        if (existing is null && input.Scope is not ("shared" or "project")) throw new ToolSettingsException("invalid_scope", "Scope must be shared or project.");
        if (isProject)
        {
            var project = await Project(projectId, cancellationToken) ?? throw new ToolSettingsException("project_required", "Project skills require a project.");
            if (existing is not null && input.Files is not null && !input.ReplaceFiles)
                throw new ToolSettingsException("skill_assets_replace_confirmation", "Replacing a package's assets requires replace_files=true.", 428);
            var path = existing?.Path ?? WorkspaceSkillPolicy.AbsolutePathFor(project.RootPath, name);
            if (!WorkspaceSkillDiscovery.IsContained(project.RootPath, path)) throw new ToolSettingsException("skill_path_escape", "Skill path or parent link escapes the project.");
            if (existing is not null && (string.IsNullOrWhiteSpace(input.ExpectedFileHash) || input.ExpectedFileHash != existing.FileHash))
                throw new ToolSettingsException("skill_hash_conflict", "The reviewed file hash is required and must match the current skill.", 412);
            var assets = new Dictionary<string,string>(StringComparer.Ordinal);
            if (input.Files is null && existing is not null)
                foreach (var file in SafePackagePaths(Path.GetDirectoryName(path)!))
                {
                    var relativePath = Path.GetRelativePath(Path.GetDirectoryName(path)!, file).Replace('\\','/');
                    if (relativePath != "SKILL.md") assets[relativePath] = Convert.ToBase64String(await File.ReadAllBytesAsync(file, cancellationToken));
                }
            if (input.Files is not null)
            {
                var normalizedAssets = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var (relativePath, encoded) in input.Files) { ValidateAsset(relativePath); if (!normalizedAssets.Add(relativePath)) throw new ToolSettingsException("invalid_skill_asset", "Asset paths must be unique ignoring case."); assets[relativePath] = encoded; }
            }
            var hashes = new Dictionary<string,string?> { ["SKILL.md"] = existing?.FileHash };
            foreach (var relativePath in assets.Keys) hashes[relativePath] = await FileHash(project.RootPath, Path.Combine(Path.GetDirectoryName(path)!, relativePath.Replace('/', Path.DirectorySeparatorChar)), cancellationToken);
            if (existing is not null && input.Files is not null) foreach(var file in SafePackagePaths(Path.GetDirectoryName(path)!))
            {
                var relativePath = Path.GetRelativePath(Path.GetDirectoryName(path)!,file).Replace('\\','/');
                if (!hashes.ContainsKey(relativePath)) hashes[relativePath] = await FileHash(project.RootPath,file,cancellationToken);
            }
            var parameters = new { name, content, files = assets, expected_file_hashes = hashes, package_root = Path.GetDirectoryName(path) };
            var action = await services.GetRequiredService<IUserToolActionService>().CreateAsync(new(project.ProjectId, "skill_project_package", JsonSerializer.Serialize(parameters)), cancellationToken);
            var result = action.Status == UserToolActionStatuses.Completed
                ? await GetAsync(ProjectId(project, Path.GetRelativePath(project.RootPath, path).Replace('\\', '/')), project.ProjectId, cancellationToken)
                : existing;
            return (result ?? new ToolSkillResourceDto { ResourceId = ProjectId(project, Path.GetRelativePath(project.RootPath, path).Replace('\\', '/')),
                Scope = "project", ProjectId = project.ProjectId, Name = name, Path = path, Description = skill!.Description, Reason = "pending governed file action" })
                with { UserActionId = action.Id, ActionStatus = action.Status };
        }

        var scope = tenants.Current;
        await using var db = await database.CreateDbContextAsync(cancellationToken);
        var row = resourceId is { } sharedId ? await db.SharedSkills.SingleOrDefaultAsync(x => x.Id == sharedId && x.TenantId == scope.TenantId
            && x.WorkspaceId == scope.WorkspaceId && x.DeletedAt == null, cancellationToken) : null;
        if (row?.Revision != expectedRevision && resourceId is not null) throw Conflict();
        if (row is null && await db.SharedSkills.AnyAsync(x => x.TenantId == scope.TenantId && x.WorkspaceId == scope.WorkspaceId
            && x.Name == name && x.DeletedAt == null, cancellationToken)) throw new ToolSettingsException("duplicate_skill", "A shared skill already has this name.", 409);
        var files = new SortedDictionary<string, byte[]>(StringComparer.Ordinal) { ["SKILL.md"] = Encoding.UTF8.GetBytes(content) };
        if (existing is not null && input.Files is not null && !input.ReplaceFiles)
            throw new ToolSettingsException("skill_assets_replace_confirmation", "Replacing a package's assets requires replace_files=true.", 428);
        if (existing is not null && input.Files is null)
        {
            var oldRoot = Path.GetDirectoryName(existing.Path)!;
            foreach (var file in Directory.EnumerateFiles(oldRoot, "*", SearchOption.AllDirectories))
            {
                if (!WorkspaceSkillDiscovery.IsContained(oldRoot, file)) throw new ToolSettingsException("skill_path_escape", "Existing asset escapes the package.");
                var relative = Path.GetRelativePath(oldRoot, file).Replace('\\', '/');
                if (relative != "SKILL.md") files.Add(relative, await File.ReadAllBytesAsync(file, cancellationToken));
            }
        }
        if (input.Files is not null)
        {
            var normalizedAssets = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "SKILL.md" };
            foreach (var (relative, base64) in input.Files)
            {
                ValidateAsset(relative);
                if (!normalizedAssets.Add(relative)) throw new ToolSettingsException("invalid_skill_asset", "Asset paths must be unique ignoring case.");
                try { files.Add(relative, Convert.FromBase64String(base64)); }
                catch (Exception ex) when (ex is FormatException or ArgumentException) { throw new ToolSettingsException("invalid_skill_asset", "Asset must have a unique safe relative path and base64 content."); }
            }
        }
        if (files.Count > 256 || files.Sum(x => (long)x.Value.Length) > 16 * 1024 * 1024)
            throw new ToolSettingsException("skill_package_budget", "Skill packages are limited to 256 files and 16 MiB.");
        var hash = PackageDigest(files);
        if (input.ExpectedPackageDigest is { Length: > 0 } reviewed && !string.Equals(reviewed, hash, StringComparison.Ordinal))
            throw new ToolSettingsException("skill_hash_conflict", "The reviewed package digest no longer matches the bytes being written.", 412);
        var reference = storage.ContentReference(scope.TenantId, scope.WorkspaceId, "skills", hash) + "/" + name;
        var destination = storage.ResolveContentReference(reference);
        if (!Directory.Exists(destination))
        {
            var temp = storage.ContentTemporary(scope.TenantId, scope.WorkspaceId, "skills");
            Directory.CreateDirectory(temp);
            try
            {
                foreach (var (relative, bytes) in files)
                {
                    var path = Path.Combine(temp, relative.Replace('/', Path.DirectorySeparatorChar));
                    Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                    await File.WriteAllBytesAsync(path, bytes, cancellationToken);
                }
                Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
                try { Directory.Move(temp, destination); }
                catch (IOException) when (Directory.Exists(destination)) { Directory.Delete(temp, true); }
            }
            catch { if (Directory.Exists(temp)) Directory.Delete(temp, true); throw; }
        }
        if (row is null) { row = new() { Id = input.ReservedResourceId ?? Guid.NewGuid(), TenantId = scope.TenantId, WorkspaceId = scope.WorkspaceId, Name = name }; db.SharedSkills.Add(row); }
        row.Description = skill!.Description; row.Enabled = WorkspaceSkillPolicy.TryRead(content, name, "SKILL.md", out _, out _);
        row.Source = input.Source == "manual" && existing is not null ? existing.Source : NormalizeSource(input.Source);
        row.Version = input.Version is null ? existing?.Version : NormalizeMetadata(input.Version, 128);
        row.Commit = input.Commit is null ? existing?.Commit : NormalizeMetadata(input.Commit, 64);
        row.Revision = expectedRevision + 1; row.ContentHash = hash; row.PackageReference = reference; row.UpdatedAt = DateTimeOffset.UtcNow;
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { throw Conflict(); }
        return Shared(row) with { Content = content, PackageFiles = PackageFiles(destination) };
    }

    public async Task DeleteAsync(Guid resourceId, Guid? projectId, long expectedRevision, CancellationToken cancellationToken = default)
    {
        var resource = await GetAsync(resourceId, projectId, cancellationToken) ?? throw new ToolSettingsException("skill_not_found", "Skill resource not found.", 404);
        if (resource.Revision != expectedRevision) throw Conflict();
        if (resource.Scope == "project") throw new ToolSettingsException("project_skill_delete_requires_file_tools", "Remove project skills with governed project file tools, or disable the skill here.");
        var scope = tenants.Current;
        await using var db = await database.CreateDbContextAsync(cancellationToken);
        var row = await db.SharedSkills.SingleAsync(x => x.Id == resourceId && x.TenantId == scope.TenantId && x.WorkspaceId == scope.WorkspaceId, cancellationToken);
        if (row.Revision != expectedRevision) throw Conflict();
        row.DeletedAt = DateTimeOffset.UtcNow; row.Enabled = false; row.Revision++;
        try { await db.SaveChangesAsync(cancellationToken); } catch (DbUpdateConcurrencyException) { throw Conflict(); }
    }

    public async Task<ToolSkillResourceDto> RequestDeleteAsync(Guid resourceId, Guid? projectId, long expectedRevision, CancellationToken cancellationToken = default)
    {
        var resource = await GetAsync(resourceId, projectId, cancellationToken) ?? throw new ToolSettingsException("skill_not_found", "Skill resource not found.", 404);
        if (resource.Revision != expectedRevision) throw Conflict();
        if (resource.Scope == "project")
        {
            var project = await Project(projectId, cancellationToken) ?? throw new ToolSettingsException("project_required", "A project is required.");
            var hashes = new Dictionary<string,string?>();
            foreach (var file in SafePackagePaths(Path.GetDirectoryName(resource.Path)!))
                hashes[Path.GetRelativePath(Path.GetDirectoryName(resource.Path)!, file).Replace('\\','/')] = await FileHash(project.RootPath, file, cancellationToken);
            if (hashes.Any(x => string.IsNullOrWhiteSpace(x.Value))) throw new ToolSettingsException("skill_hash_conflict", "All package files must be readable before deletion.", 412);
            var projectAction = await services.GetRequiredService<IUserToolActionService>().CreateAsync(new(project.ProjectId, "skill_project_package", JsonSerializer.Serialize(new { action = "delete", name = resource.Name, content = "", files = new Dictionary<string,string>(), expected_file_hashes = hashes, package_root = Path.GetDirectoryName(resource.Path) })), cancellationToken);
            return resource with { UserActionId = projectAction.Id, ActionStatus = projectAction.Status };
        }
        var action = await services.GetRequiredService<IUserToolActionService>().CreateAsync(new UserToolActionRequest(Guid.Empty, "skill_resource_update", JsonSerializer.Serialize(new {
            action = "delete", resource_id = resourceId, expected_revision = expectedRevision, expected_package_hash = resource.PackageHash,
            scope = "shared", name = resource.Name, content = "",
        })), cancellationToken);
        return resource with { UserActionId = action.Id, ActionStatus = action.Status };
    }

    private ToolSkillResourceDto Shared(SharedSkillResourceRecord row)
    {
        var root = storage.ResolveContentReference(row.PackageReference);
        var entry = WorkspaceSkillDiscovery.Read(root, Path.Combine(root, "SKILL.md"));
        var packageFiles = PackageFiles(root);
        var actualHash = Directory.Exists(root) ? ActualPackageHash(root) : "";
        var integrity = actualHash == row.ContentHash;
        return new() { ResourceId = row.Id, Scope = "shared", Name = row.Name, Description = row.Description,
            Enabled = row.Enabled && entry.Enabled, Valid = entry.Valid && integrity, Reason = !integrity ? "Skill package bytes changed outside Core; reinstall the reviewed package." : entry.Valid ? row.Enabled ? entry.Reason : "disabled in Core" : entry.Reason,
            Path = entry.FullPath, Revision = row.Revision, ContentHash = row.ContentHash, PackageHash = row.ContentHash,
            PackageReference = row.PackageReference, Source = row.Source, Version = row.Version, Commit = row.Commit,
            Availability = entry.Valid && integrity ? row.Enabled ? "available" : "disabled" : "invalid", PackageFiles = packageFiles };
    }

    private static ToolSkillResourceDto ProjectDto(ProjectReference project, WorkspaceSkillDiscovery.Entry entry)
    {
        var packageRoot = Path.GetDirectoryName(entry.FullPath)!;
        var packageFiles = entry.Valid ? PackageFiles(packageRoot) : [];
        var packageHash = entry.Valid ? ActualPackageHash(packageRoot) : entry.ContentHash;
        return new()
        {
            ResourceId = ProjectId(project, entry.RelativePath), ProjectId = project.ProjectId, Scope = "project", Name = entry.Name,
            Description = entry.Description, Enabled = entry.Enabled, Valid = entry.Valid, Reason = entry.Reason,
            Path = entry.FullPath, ContentHash = entry.ContentHash, Revision = Revision(packageHash), PackageHash = packageHash, PackageFiles = packageFiles,
            Availability = !entry.Valid ? "invalid" : entry.Enabled ? "available" : "disabled", Source = "project",
        };
    }
    private static Guid ProjectId(ProjectReference project, string relative) => new(SHA256.HashData(Encoding.UTF8.GetBytes(
        $"skill:{project.TenantId:N}:{project.WorkspaceId:N}:{project.ProjectId:N}:{relative}"))[..16]);
    // Revisions cross JSON/JavaScript: retain exact integer representation in Desktop If-Match.
    private static long Revision(string hash) => hash.Length == 0 ? 0 : BinaryPrimitives.ReadInt64BigEndian(Convert.FromHexString(hash)[..8]) & ((1L << 53) - 1);
    private static ToolSettingsException Conflict() => new("revision_conflict", "Skill changed since it was loaded. Reload before saving.", 412);
    private async Task<ProjectReference?> Project(Guid? id, CancellationToken ct)
    {
        if (id is null) return null;
        var project = await sessions.FindProjectAsync(id.Value, ct);
        var scope = tenants.Current;
        if (project is null || project.TenantId != scope.TenantId || project.WorkspaceId != scope.WorkspaceId)
            throw new ToolSettingsException("project_not_found", "Project is not visible in this workspace.", 404);
        return project;
    }
    private async Task<string?> FileHash(string root, string path, CancellationToken ct)
    {
        var response = await provider.CallAsync(root, new ToolWireRequestDto { ToolId = "read_file", SessionId = "skill-settings",
            Params = JsonSerializer.SerializeToElement(new { filepath = path }) }, TimeSpan.FromSeconds(30), ct);
        return response.IsSuccess && response.Result is { } result && result.TryGetProperty("file_hash", out var hash) ? hash.GetString() : null;
    }
    private static IReadOnlyList<ToolSkillPackageFileDto> PackageFiles(string root)
    {
        if (!Directory.Exists(root)) return [];
        var files = new List<ToolSkillPackageFileDto>();
        long total = 0;
        foreach (var file in SafePackagePaths(root))
        {
            if (!WorkspaceSkillDiscovery.IsContained(root, file)) throw new ToolSettingsException("skill_path_escape", "A Skill package file leaves its root.");
            total += new FileInfo(file).Length;
            if (files.Count >= 256 || total > 16 * 1024 * 1024) throw new ToolSettingsException("skill_package_budget", "Skill packages are limited to 256 files and 16 MiB.");
            var bytes = File.ReadAllBytes(file);
            files.Add(new ToolSkillPackageFileDto
            {
                Path = Path.GetRelativePath(root, file).Replace('\\', '/'),
                ContentHash = Convert.ToHexStringLower(SHA256.HashData(bytes)),
                SizeBytes = bytes.LongLength,
            });
        }
        return files.OrderBy(x => x.Path, StringComparer.Ordinal).ToArray();
    }

    private static string ActualPackageHash(string root)
    {
        using var digest = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        foreach (var path in SafePackagePaths(root).OrderBy(x => Path.GetRelativePath(root,x).Replace('\\','/'), StringComparer.Ordinal))
        {
            var relative = Path.GetRelativePath(root,path).Replace('\\','/'); var bytes = File.ReadAllBytes(path);
            digest.AppendData(Encoding.UTF8.GetBytes(relative + "\0" + bytes.Length + "\0")); digest.AppendData(bytes);
        }
        return Convert.ToHexStringLower(digest.GetHashAndReset());
    }

    private static IEnumerable<string> SafePackagePaths(string root)
    {
        var pending = new Stack<string>(); pending.Push(root);
        while (pending.Count > 0)
        {
            var directory = pending.Pop();
            if (!WorkspaceSkillDiscovery.IsContained(root, directory) || new DirectoryInfo(directory).LinkTarget is not null)
                throw new ToolSettingsException("skill_path_escape", "Skill package directory links are not accepted.");
            foreach (var child in Directory.EnumerateDirectories(directory)) pending.Push(child);
            foreach (var file in Directory.EnumerateFiles(directory))
            {
                if (new FileInfo(file).LinkTarget is not null) throw new ToolSettingsException("skill_path_escape", "Skill package file links are not accepted.");
                yield return file;
            }
        }
    }

    private static string NormalizeSource(string? value) => string.IsNullOrWhiteSpace(value) ? "manual" : value.Trim()[..Math.Min(value.Trim().Length, 128)];
    private static string? NormalizeMetadata(string? value, int max) => string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(value.Trim().Length, max)];

    private static void ValidateAsset(string path, bool allowSkillFile = false)
    {
        if (string.IsNullOrWhiteSpace(path) || (!allowSkillFile && path == "SKILL.md") || path.Contains('\\') || path.Contains(':') || Path.IsPathRooted(path)
            || path.Any(char.IsControl) || path.Split('/').Any(x => x is "" or "." or "..")
            || path.Split('/').Any(x => x.Equals("CON", StringComparison.OrdinalIgnoreCase) || x.Equals("PRN", StringComparison.OrdinalIgnoreCase) || x.Equals("AUX", StringComparison.OrdinalIgnoreCase) || x.Equals("NUL", StringComparison.OrdinalIgnoreCase)))
            throw new ToolSettingsException("invalid_skill_asset", "Asset paths must stay relative to the skill package and cannot contain reserved names.");
    }
}

