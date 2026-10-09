using TinadecCore.Abstractions.Ports;

namespace TinadecCore.Persistence;

public sealed class ContentLeaseRegistry : IContentLeaseRegistry
{
    private int _count;
    private readonly object _gate = new();
    private bool _maintenance;
    public int Count => Volatile.Read(ref _count);
    public IDisposable Acquire()
    {
        lock (_gate)
        {
            if (_maintenance) throw new InvalidOperationException("Content storage is undergoing maintenance.");
            _count++; return new Lease(this);
        }
    }
    public IDisposable AcquireMaintenance()
    {
        lock (_gate)
        {
            if (_maintenance || _count != 0) throw new InvalidOperationException("Content streams still hold storage leases.");
            _maintenance = true; return new MaintenanceLease(this);
        }
    }
    private sealed class Lease(ContentLeaseRegistry owner) : IDisposable
    {
        private ContentLeaseRegistry? _owner = owner;
        public void Dispose() { if (Interlocked.Exchange(ref _owner, null) is { } current) lock (current._gate) current._count--; }
    }
    private sealed class MaintenanceLease(ContentLeaseRegistry owner) : IDisposable
    {
        private ContentLeaseRegistry? _owner = owner;
        public void Dispose()
        {
            if (Interlocked.Exchange(ref _owner, null) is { } current) lock (current._gate) current._maintenance = false;
        }
    }
}
