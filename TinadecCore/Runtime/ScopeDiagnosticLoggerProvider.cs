using System.Text;
using Microsoft.Extensions.Logging;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Persistence;
using Tomlyn;
using Tomlyn.Model;

namespace TinadecCore.Runtime;

/// <summary>Bounded diagnostic side channel. Run facts remain in data and are never rotated.</summary>
public sealed class ScopeDiagnosticLoggerProvider : ILoggerProvider
{
    private readonly IScopeStorageLocations _scope;
    private readonly string _path;
    private readonly object _gate = new();
    private long _rotation = 10L * 1024 * 1024, _capacity = 200L * 1024 * 1024;
    public ScopeDiagnosticLoggerProvider(IScopeStorageLocations scope)
    {
        _scope = scope;
        _path = Path.Combine(scope.Logs, "core.log");
        var config = Path.Combine(scope.Config, "logging.toml");
        ScopeConfigurationInitialization.Ensure(scope, "logging", () => "version = 1\n[logging]\nrotation_bytes = 10485760\ntotal_bytes = 209715200\n");
        var model = TomlSerializer.Deserialize<TomlTable>(File.ReadAllText(config))!;
        if (StorageScopeInitializer.Value(model, "logging") is TomlTable logging)
        {
            _rotation = Convert.ToInt64(StorageScopeInitializer.Value(logging, "rotation_bytes") ?? _rotation);
            _capacity = Convert.ToInt64(StorageScopeInitializer.Value(logging, "total_bytes") ?? _capacity);
            if (_rotation < 4096 || _capacity < _rotation) throw new InvalidDataException("logging.toml requires total_bytes >= rotation_bytes >= 4096.");
        }
    }
    public ILogger CreateLogger(string categoryName) => new Logger(this, categoryName);
    public void Dispose() { }
    private void Write(string category, LogLevel level, string text)
    {
        lock (_gate)
        {
            try
            {
                StorageScopePaths.RejectLinks(_scope.Root, _path);
                Directory.CreateDirectory(_scope.Logs);
                var line = Encoding.UTF8.GetBytes($"{DateTimeOffset.UtcNow:O} {level} {category}: {text}\n");
                if (line.Length > _rotation / 2) line = line.AsSpan(0, (int)Math.Min(_rotation / 2, int.MaxValue)).ToArray();
                if (File.Exists(_path) && new FileInfo(_path).Length + line.Length > _rotation)
                    File.Move(_path, _path + "." + DateTimeOffset.UtcNow.UtcTicks + "-" + Guid.NewGuid().ToString("N"));
                using (var stream = new FileStream(_path, FileMode.Append, FileAccess.Write, FileShare.ReadWrite | FileShare.Delete)) stream.Write(line);
                var files = StorageMaintenanceService.OwnedFiles(_scope.Root, _scope.Logs, CancellationToken.None);
                var total = files.Sum(x => x.Length);
                foreach (var file in files.Where(x => IsRotatedFile(x.Name)).OrderBy(x => x.LastWriteTimeUtc))
                {
                    if (total <= _capacity) break;
                    var size = file.Length; File.Delete(file.FullName); total -= size;
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidOperationException) { /* logging cannot fail an operation */ }
        }
    }
    internal static bool IsRotatedFile(string name) => System.Text.RegularExpressions.Regex.IsMatch(name,
        @"(?:\.log\.\d+(?:-[a-fA-F0-9]{32})?|\.\d+-\d+\.log)$", System.Text.RegularExpressions.RegexOptions.CultureInvariant);
    private sealed class Logger(ScopeDiagnosticLoggerProvider owner, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Information;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        { if (IsEnabled(logLevel)) owner.Write(category, logLevel, formatter(state, exception) + (exception is null ? "" : "\n" + exception)); }
    }
}
