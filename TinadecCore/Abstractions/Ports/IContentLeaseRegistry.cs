namespace TinadecCore.Abstractions.Ports;

/// <summary>Scope-local active content I/O. Maintenance must not collect while readers or writers hold leases.</summary>
public interface IContentLeaseRegistry
{
    int Count { get; }
    IDisposable Acquire();
    IDisposable AcquireMaintenance();
}
