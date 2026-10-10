using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using TinadecCore.Abstractions.Ports;

namespace TinadecCore.AspNetCore;

/// <summary>A failed row keeps its cause without turning unrelated workspaces into failures.</summary>
internal sealed record StorageScopeRowError(
    string Code, string Message, ErrorClassification.Classification Classification,
    string TraceId, IReadOnlyList<ConfigurationDiagnostic> Diagnostics)
{
    internal static bool CanRepresent(Exception error) => error is not (
        OperationCanceledException or OutOfMemoryException or StackOverflowException or AccessViolationException);

    internal static StorageScopeRowError From(HttpContext context, Exception error)
    {
        var (code, message, status) = error switch
        {
            ConfigurationDocumentException document => (document.Code, document.Message,
                document.Code == "workspace_authorization_required" ? 403 : document.Code.Contains("conflict", StringComparison.Ordinal) ? 412 : 400),
            KeyNotFoundException => ("storage_scope_not_found", error.Message, 404),
            DirectoryNotFoundException => ("storage_scope_unavailable", error.Message, 409),
            FileNotFoundException => ("configuration_missing", error.Message, 409),
            InvalidDataException or FormatException or Tomlyn.TomlException => ("configuration_invalid", error.Message, 400),
            UnauthorizedAccessException => ("storage_access_denied", error.Message, 403),
            ArgumentException => ("invalid_storage_request", error.Message, 400),
            DbUpdateConcurrencyException => ("storage_database_conflict", "The workspace database changed concurrently. Reload and try again.", 409),
            // A driver or EF failure is not evidence that the source directory disappeared.
            // Keep driver and SQL details in the journal, not in a list response.
            DbException or DbUpdateException => ("storage_database_error", "The workspace database could not be read. See the diagnostic trace for details.", 500),
            TimeoutException => ("storage_timeout", "The workspace storage operation timed out.", 503),
            IOException => ("storage_io_error", error.Message, 409),
            InvalidOperationException => ("storage_conflict", error.Message, 409),
            _ => ("internal_error", "An unexpected error occurred while reading this workspace.", 500)
        };
        if (status >= 500)
            context.RequestServices.GetService<ServerFailureJournal>()?.Record(context, error, status, code);
        return new(code, message, ErrorClassification.Classify(code, status), context.TraceIdentifier,
            error is ConfigurationDocumentException configuration ? configuration.Diagnostics : []);
    }
}
