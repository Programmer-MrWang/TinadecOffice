using System.Text;
using System.Text.Json;

namespace TinadecTools.Runtime.Sandbox.Posix;

/// <summary>
/// The child half of the Linux sandbox: a fresh process image of this same binary that
/// installs its own confinement and then replaces itself with the commanded program.
///
/// The order is the whole point. <c>setpgid</c> and <c>PR_SET_PDEATHSIG</c> make the process
/// group killable and un-orphanable, Landlock then restricts writes for this process and
/// everything it execs, and only at the very end does <c>execve</c> hand control to the
/// command. There is no window in which the user's command runs unconstrained, and no
/// allocation of the tool host's registry/pipe machinery happens in this process first.
/// </summary>
internal static class LinuxSandboxLauncher
{
    internal const string ModeArg = "--sandbox-exec-posix";

    /// <summary>Recognises this binary's own sandbox-launcher mode. The caller gates it on
    /// Linux; keeping the platform test out of here makes the argument shape assertable on
    /// any host.</summary>
    internal static bool IsMode(string[] args)
        => args.Length > 1 && args[0] == ModeArg;

    /// <summary>Returns the process exit code. On success this never returns: execve replaced
    /// the image.</summary>
    internal static int Run(string[] args)
    {
        // stdout/stderr/stdin stay as they are: the parent redirected them, and after execve
        // the command inherits the same descriptors, which is how its output reaches Core.
        var childPid = Environment.ProcessId;

        // Own process group first, so the parent's kill(-pgid) can never reach the tool host.
        PosixSysCalls.SetPgid(0, 0);
        // If the host dies without terminating us, the kernel does.
        PosixSysCalls.Prctl(PosixSysCalls.PR_SET_PDEATHSIG, PosixSysCalls.SIGKILL, 0, 0, 0);

        LinuxSandboxPayload? payload;
        try
        {
            payload = JsonSerializer.Deserialize(
                Convert.FromBase64String(args[1]),
                SandboxJsonContext.Default.LinuxSandboxPayload);
        }
        catch (Exception ex) when (ex is FormatException or ArgumentException or JsonException)
        {
            return Fail($"the sandbox launch request could not be read: {ex.Message}");
        }

        if (payload is null || string.IsNullOrWhiteSpace(payload.Executable))
            return Fail("the sandbox launch request carried no executable.");

        // The confinement belongs to this pid; a launcher that could not set its own group
        // would let the parent's kill reach the tool host instead, so refuse to continue.
        if (PosixSysCalls.GetPgid(childPid) != childPid)
            return Fail("setpgid failed; refusing to run a command the supervisor cannot safely terminate.");

        if (!LandlockApi.TryConstrain(payload.WritePaths, out var landlockError))
        {
            // Degrading to "no confinement" would be a silent security downgrade, so the
            // caller gets a real error. Availability is reported separately by the backend
            // (sandbox_status) rather than decided here.
            return Fail(landlockError ?? "landlock confinement could not be installed.");
        }

        var argv = new string[payload.Arguments.Count + 2];
        argv[0] = payload.Executable;
        payload.Arguments.CopyTo(argv, 1);
        argv[^1] = null!; // NULL terminator; the marshaller writes a zero pointer for it.

        var envp = new string[payload.Environment.Count + 1];
        var index = 0;
        foreach (var (key, value) in payload.Environment)
            envp[index++] = $"{key}={value}";
        envp[^1] = null!;

        if (PosixSysCalls.Execve(payload.Executable, argv, envp) != 0)
        {
            return Fail($"execve '{payload.Executable}' failed ({PosixSysCalls.LastErrorString()}).");
        }

        return Fail("execve returned, which should not be possible.");
    }

    private static int Fail(string message)
    {
        // Exit 126 is the shell's own "found but not executable" convention, which is what a
        // user of command_run will recognise; stderr is captured by the parent verbatim.
        Console.Error.WriteLine($"tinadec-sandbox: {message}");
        return 126;
    }
}
