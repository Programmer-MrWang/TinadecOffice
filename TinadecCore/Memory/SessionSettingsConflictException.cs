namespace TinadecCore.Memory;

public sealed class SessionSettingsConflictException(long? currentRevision = null)
    : Exception("Session settings changed. Refresh the session and retry your changes.")
{
    public long? CurrentRevision { get; } = currentRevision;
}
