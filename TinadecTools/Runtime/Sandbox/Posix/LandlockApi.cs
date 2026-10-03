using System.Runtime.InteropServices;

namespace TinadecTools.Runtime.Sandbox.Posix;

/// <summary>
/// Landlock filesystem confinement, applied to the calling process before it execve's the
/// commanded binary. Values are taken from <c>include/uapi/linux/landlock.h</c>.
///
/// <para>
/// <b>Which rights are handled, and why that is the whole security story.</b> A right that
/// is NOT in <see cref="HandledAccessFs"/> is simply not confined by Landlock. This backend
/// confines everything that can change what is on disk — write, remove, create
/// (dir/reg/symlink), rename across directories, truncate — and deliberately leaves
/// execute, read-file, read-dir and the device/socket/fifo makers unconfined. That matches
/// what the Windows backend actually guarantees: the sandbox account is granted write ACLs
/// inside the workspace and can already read the system volume. Turning read confinement on
/// would break ordinary commands (a compiler that reads its own toolchain, a test runner
/// that reads /proc) without adding a guarantee the product claims today.
/// </para>
/// </summary>
internal static class LandlockApi
{
    // Bit values from include/uapi/linux/landlock.h. Rights that this backend does NOT
    // confine (execute, read-file, read-dir, make-char/sock/fifo/block, ioctl-dev) are
    // omitted on purpose — see HandledAccessFs.
    private const ulong ACCESS_WRITE_FILE = 1UL << 1;
    private const ulong ACCESS_REMOVE_DIR = 1UL << 4;
    private const ulong ACCESS_REMOVE_FILE = 1UL << 5;
    private const ulong ACCESS_MAKE_DIR = 1UL << 7;
    private const ulong ACCESS_MAKE_REG = 1UL << 8;
    private const ulong ACCESS_MAKE_SYM = 1UL << 12;
    private const ulong ACCESS_REFER = 1UL << 13;    // ABI v2
    private const ulong ACCESS_TRUNCATE = 1UL << 14; // ABI v4

    private const int RULE_PATH_BENEATH = 1;
    private const int CREATE_RULESET_VERSION = 1;
    private const int O_PATH = 0x200000;
    private const int O_CLOEXEC = 0x80000;
    private const int O_RDONLY = 0;

    /// <summary>The write-side rights this backend confines.</summary>
    internal static ulong HandledAccessFs(int abiVersion)
    {
        ulong access = ACCESS_WRITE_FILE | ACCESS_REMOVE_DIR | ACCESS_REMOVE_FILE
            | ACCESS_MAKE_DIR | ACCESS_MAKE_REG | ACCESS_MAKE_SYM;
        if (abiVersion >= 2) access |= ACCESS_REFER;
        if (abiVersion >= 4) access |= ACCESS_TRUNCATE;
        return access;
    }

    /// <summary>Returns the kernel's Landlock ABI version, or 0 when Landlock is unavailable
    /// (pre-5.13 kernel, or the LSM disabled at boot).</summary>
    internal static int QueryAbiVersion()
    {
        var result = PosixSysCalls.LandlockCreateRuleset(nint.Zero, 0, CREATE_RULESET_VERSION);
        if (result < 0)
        {
            Marshal.GetLastPInvokeError(); // drain errno; the caller reports availability, not the code
            return 0;
        }
        return result;
    }

    /// <summary>
    /// Creates a ruleset that handles the confined rights, adds one rule per writable path,
    /// and restricts this process. Must be called before execve, in the launcher child.
    /// </summary>
    internal static bool TryConstrain(IEnumerable<string> writablePaths, out string? error)
    {
        error = null;
        var abi = QueryAbiVersion();
        if (abi == 0)
        {
            error = "landlock is unavailable on this kernel";
            return false;
        }

        var handled = HandledAccessFs(abi);

        // The caller only declares the first field (v1 layout); the kernel treats the rest as
        // absent, which is what makes this call work on newer kernels without a v4 struct.
        var rulesetAttr = new RulesetAttr { HandledAccessFs = handled };
        var rulesetSize = Marshal.SizeOf<RulesetAttr>();
        var attrPtr = Marshal.AllocHGlobal(rulesetSize);
        var rulePtr = Marshal.AllocHGlobal(Marshal.SizeOf<PathBeneathAttr>());
        try
        {
            Marshal.StructureToPtr(rulesetAttr, attrPtr, fDeleteOld: false);
            // Only the first 8 bytes are meaningful for a v1-compatible request.
            var rulesetFd = PosixSysCalls.LandlockCreateRuleset(attrPtr, sizeof(ulong), 0);
            if (rulesetFd < 0)
            {
                error = $"landlock_create_ruleset failed ({PosixSysCalls.LastErrorString()})";
                return false;
            }

            try
            {
                foreach (var path in writablePaths)
                {
                    if (!TryAddPathRule(rulesetFd, path, handled, rulePtr, out var pathError))
                    {
                        error = pathError;
                        return false;
                    }
                }

                if (PosixSysCalls.Prctl(PosixSysCalls.PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0)
                {
                    error = $"prctl(PR_SET_NO_NEW_PRIVS) failed ({PosixSysCalls.LastErrorString()})";
                    return false;
                }

                if (PosixSysCalls.LandlockRestrictSelf(rulesetFd, 0) != 0)
                {
                    error = $"landlock_restrict_self failed ({PosixSysCalls.LastErrorString()})";
                    return false;
                }
            }
            finally
            {
                CloseFd(rulesetFd);
            }

            return true;
        }
        finally
        {
            Marshal.FreeHGlobal(attrPtr);
            Marshal.FreeHGlobal(rulePtr);
        }
    }

    private static bool TryAddPathRule(int rulesetFd, string path, ulong access, nint rulePtr, out string? error)
    {
        error = null;
        var fd = Open(Path.TrimEndingDirectorySeparator(path), O_PATH | O_CLOEXEC | O_RDONLY);
        if (fd < 0)
        {
            // A grant that cannot be opened is not a reason to run the command unconstrained.
            error = $"cannot open granted write path '{path}' ({LastError()})";
            return false;
        }

        try
        {
            var rule = new PathBeneathAttr { AllowedAccess = access, ParentFd = fd };
            Marshal.StructureToPtr(rule, rulePtr, fDeleteOld: false);
            if (PosixSysCalls.LandlockAddRule(rulesetFd, RULE_PATH_BENEATH, rulePtr, 0) != 0)
            {
                error = $"landlock_add_rule failed for '{path}' ({PosixSysCalls.LastErrorString()})";
                return false;
            }
            return true;
        }
        finally
        {
            CloseFd(fd);
        }
    }

    [DllImport("libc", EntryPoint = "open")]
    private static extern int Open(string path, int flags);

    [DllImport("libc", EntryPoint = "close")]
    private static extern int CloseFd(int fd);

    private static string LastError()
    {
        var errno = Marshal.GetLastPInvokeError();
        return errno == 0 ? "unknown" : $"errno {errno}";
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct RulesetAttr
    {
        public ulong HandledAccessFs;
    }

    /// <summary>Mirrors the kernel's <c>__attribute__((packed))</c> layout: 8 + 4 bytes, no
    /// trailing alignment. A padded copy here would make the kernel read a wrong parent_fd.</summary>
    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    private struct PathBeneathAttr
    {
        public ulong AllowedAccess;
        public int ParentFd;
    }
}
