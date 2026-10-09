using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace TinadecCore.Persistence;

/// <summary>Model caches cannot alias two independently mounted PostgreSQL scopes.</summary>
public sealed class ScopeModelCacheKeyFactory : IModelCacheKeyFactory
{
    public object Create(DbContext context, bool designTime)
    {
        // Database services can request the model themselves. Read the configured
        // options here so the first PostgreSQL model does not recursively build itself.
        var options = context.GetService<IDbContextOptions>();
        var relational = options.Extensions.OfType<RelationalOptionsExtension>().Single();
        var connection = relational.ConnectionString ?? relational.Connection?.ConnectionString ?? "";
        var connectionKey = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(connection)));
        return (context.GetType(), relational.GetType(), connectionKey, relational.MigrationsHistoryTableSchema, designTime);
    }
}
