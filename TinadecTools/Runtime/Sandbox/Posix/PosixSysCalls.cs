using System.Runtime.InteropServices;

namespace TinadecTools.Runtime.Sandbox.Posix;

/// <summary>
/// The handful of libc calls the POSIX sandbox needs. Everything here is a plain syscall
/// wrapper — no external dependency, because the packaged runtime ships on distros where
/// nothing beyond libc is guaranteed.
/// </summary>
internal static class PosixSysCalls
{
    internal const int SIGTERM = 15;
    internal const int SIGKILL = 9;

    internal const int PR_SET_PDEATHSIG = 1;
    internal const int PR_SET_NO_NEW_PRIVS = 38;

    // asm-generic/unistd.h assigns landlock 444/445/446 and both shipped ABIs (x86-64 and
    // aarch64) use those same numbers, so no per-arch table is needed.
    private const int SYS_landlock_create_ruleset = 444;
    private const int SYS_landlock_add_rule = 445;
    private const int SYS_landlock_restrict_self = 446;

    private const string Libc = "libc";

    [DllImport(Libc, EntryPoint = "syscall")]
    private static extern nint Syscall3(nint number, nint a1, nint a2, nint a3);

    [DllImport(Libc, EntryPoint = "syscall")]
    private static extern nint Syscall4(nint number, nint a1, nint a2, nint a3, nint a4);

    [DllImport(Libc, EntryPoint = "setpgid")]
    internal static extern int SetPgid(int pid, int pgid);

    [DllImport(Libc, EntryPoint = "getpgid")]
    internal static extern int GetPgid(int pid);

    [DllImport(Libc, EntryPoint = "kill")]
    internal static extern int Kill(int pid, int sig);

    [DllImport(Libc, EntryPoint = "prctl")]
    internal static extern int Prctl(int option, int arg2, int arg3, int arg4, int arg5);

    /// <summary>
    /// execve never returns on success; the process image is replaced. A non-zero return
    /// means it failed and <see cref="Marshal.GetLastPInvokeError"/> holds the errno.
    /// The arrays must be null-terminated, which the caller does by ending them with a
    /// null element (the marshaller writes a NULL pointer for it).
    /// </summary>
    [DllImport(Libc, EntryPoint = "execve", SetLastError = true)]
    internal static extern int Execve(string path, string[] argv, string[] envp);

    /// <summary>landlock_create_ruleset(attrs, size, flags); with attrs NULL and size 0 and
    /// flags=LANDLOCK_CREATE_RULESET_VERSION this returns the ABI version instead.</summary>
    internal static int LandlockCreateRuleset(nint attrs, int size, int flags)
        => (int)Syscall3(SYS_landlock_create_ruleset, attrs, size, flags);

    /// <summary>landlock_add_rule(ruleset_fd, rule_type, rule_attr, flags).</summary>
    internal static int LandlockAddRule(int rulesetFd, int ruleType, nint ruleAttr, int flags)
        => (int)Syscall4(SYS_landlock_add_rule, rulesetFd, ruleType, ruleAttr, flags);

    /// <summary>landlock_restrict_self(ruleset_fd, flags).</summary>
    internal static int LandlockRestrictSelf(int rulesetFd, int flags)
        => (int)Syscall3(SYS_landlock_restrict_self, rulesetFd, 0, flags);

    /// <summary>The errno the last failing P/Invoke left behind, phrased for a tool result.</summary>
    internal static string LastErrorString()
    {
        var errno = Marshal.GetLastPInvokeError();
        return errno == 0 ? "no errno recorded" : $"errno {errno}";
    }
}
