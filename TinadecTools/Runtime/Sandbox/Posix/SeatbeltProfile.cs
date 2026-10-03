using System.Text;

namespace TinadecTools.Runtime.Sandbox.Posix;

/// <summary>
/// Builds the seatbelt profile passed to <c>/usr/bin/sandbox-exec</c> on macOS.
///
/// The shape is the standard "permissive base, write restricted" idiom: allow everything,
/// then deny writes, then re-allow writes under each granted path. Reads and execute stay
/// allowed for the same reason Landlock leaves them unhandled — confining them would break
/// ordinary toolchains without adding a guarantee this product claims.
///
/// Honest boundary: <c>sandbox-exec</c> is not a documented public Apple API, and profiles
/// like this one are validated by CI on a macOS runner, not by an API contract.
/// </summary>
internal static class SeatbeltProfile
{
    internal static string Build(IReadOnlyList<string> writeTargets)
    {
        var sb = new StringBuilder();
        sb.Append("(version 1)\n");
        sb.Append("(allow default)\n");
        sb.Append("(deny file-write*)\n");

        if (writeTargets.Count == 0)
            return sb.ToString();

        sb.Append("(allow file-write*\n");
        foreach (var path in writeTargets)
        {
            var clause = IsDirectory(path) ? "subpath" : "literal";
            sb.Append("  (").Append(clause).Append(' ').Append(Quote(path)).Append(")\n");
        }
        sb.Append(")\n");
        return sb.ToString();
    }

    private static bool IsDirectory(string path)
    {
        try
        {
            return Directory.Exists(path);
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException)
        {
            // Unreadable is treated as a file: the narrower clause grants less, so an odd
            // path cannot silently widen itself to a whole subtree.
            return false;
        }
    }

    /// <summary>
    /// SBPL string escaping. An unescaped quote or backslash in a workspace path would end
    /// the literal early and let the rest of the path be read as profile syntax.
    /// </summary>
    private static string Quote(string value)
    {
        var sb = new StringBuilder(value.Length + 2);
        sb.Append('"');
        foreach (var c in value)
        {
            if (c is '"' or '\\' or '\n' or '\r' or '\t')
                sb.Append('\\');
            sb.Append(c switch
            {
                '\n' => 'n',
                '\r' => 'r',
                '\t' => 't',
                _ => c
            });
        }
        sb.Append('"');
        return sb.ToString();
    }
}
