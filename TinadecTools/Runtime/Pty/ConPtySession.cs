using System.Collections;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

namespace TinadecTools.Runtime.Pty;

/// <summary>What to start, and how big the screen should be. A PTY needs the size at creation.</summary>
internal sealed record PtyStartRequest(
    string Executable,
    IReadOnlyList<string> ArgumentList,
    string WorkingDirectory,
    IReadOnlyDictionary<string, string?>? Environment,
    int Columns = 120,
    int Rows = 30);

/// <summary>
/// A child process attached to a real terminal: one byte stream out (already rendered, including the
/// control sequences a full-screen program paints) and one in (keystrokes, not lines).
/// </summary>
/// <remarks>
/// This exists because pipes are a different thing wearing the same clothes. Over pipes a TUI paints
/// nothing useful, echoes nothing, sees no width, and a program that asks the console for a key press
/// waits forever on input that never looks like a line. The product promise behind the <c>tui</c>
/// channel is that TinadecOffice can watch and drive such a program, so the byte stream — not a
/// decoded string — is the contract, and callers must not turn it back into text on the way through.
/// </remarks>
internal interface IPtySession : IDisposable
{
    /// <summary>
    /// What the terminal rendered, as bytes, control sequences intact — that is the point of this type.
    /// The encoding of those bytes is the console's output codepage, not a fixed UTF-8: <c>mode con</c>
    /// reported codepage 936 for a pseudoconsole on this zh-CN host. A viewer therefore needs the
    /// codepage the child is using (or the child needs to be started with a UTF-8 codepage, which is a
    /// measurement E5 has to make rather than an assumption made here).
    /// </summary>
    Stream Output { get; }

    Stream Input { get; }

    /// <summary>Process id of the child, so a caller can tell a live session from a reused number.</summary>
    int ProcessId { get; }

    int ExitCode { get; }

    bool HasExited { get; }

    void Resize(int columns, int rows);

    /// <summary>True when the process exited within the timeout; never throws on a timeout.</summary>
    bool WaitForExit(TimeSpan timeout);

    /// <summary>Terminates the child. Deliberately not silent on failure: a surviving PTY holds a screen.</summary>
    void Kill();
}

internal static class PtyBackend
{
    /// <summary>
    /// ConPTY is Windows-only for now. POSIX needs <c>openpty</c> plus a fork that immediately execs,
    /// which is a different implementation rather than a flag — so the absence is stated, and no caller
    /// gets an unhosted shell pretending to be a terminal.
    /// </summary>
    public static bool IsSupported => OperatingSystem.IsWindows();

    public static IPtySession Start(PtyStartRequest request)
    {
        if (!OperatingSystem.IsWindows())
        {
            throw new PlatformNotSupportedException(
                "No PTY backend for this platform yet: this build only implements ConPTY (Windows). Refusing to fall back to pipes, because a pipe is not a terminal.");
        }

        return ConPtySession.Start(request);
    }
}

/// <summary>
/// A child process on a Windows pseudo-terminal: <see cref="CreatePseudoConsole"/> bridges a pair of
/// anonymous pipes to a console the child believes it owns, and the pseudoconsole handle is injected
/// into <c>CreateProcess</c> through a <c>STARTUPINFOEX</c> attribute list.
/// </summary>
internal sealed class ConPtySession : IPtySession
{
    private const uint ExtremePresent = 0x0008_0000; // EXTENDED_STARTUPINFO_PRESENT
    private const uint UnicodeEnvironment = 0x0000_0400;
    private const uint UseStdHandles = 0x0000_0100; // STARTF_USESTDHANDLES
    private const ulong AttributePseudoConsole = 0x0002_0016; // PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE
    private const uint WaitObject0 = 0x0000_0000;

    private readonly SafeHandle _process;
    private readonly IntPtr _pseudoConsole;
    private readonly FileStream _output;
    private readonly FileStream _input;
    private readonly int _processId;
    private int _disposed;

    private ConPtySession(SafeHandle process, IntPtr pseudoConsole, FileStream output, FileStream input, int processId)
    {
        _process = process;
        _pseudoConsole = pseudoConsole;
        _output = output;
        _input = input;
        _processId = processId;
    }

    public Stream Output => _output;

    public Stream Input => _input;

    public int ProcessId => _processId;

    /// <summary>
    /// Asked of the process handle rather than compared against <c>GetExitCodeProcess</c>, because that
    /// API reports "still running" as exit code 259 — a program that legitimately exits 259 would read
    /// as alive forever, and the child here is a shell whose exit codes are the caller's business.
    /// </summary>
    public bool HasExited => WaitForSingleObject(_process, 0u) == WaitObject0;

    public int ExitCode
    {
        get
        {
            if (!GetExitCodeProcess(_process, out var code))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "reading the PTY child's exit code failed");
            }

            return (int)code;
        }
    }

    public bool WaitForExit(TimeSpan timeout)
        => WaitForSingleObject(_process, (uint)Math.Clamp(timeout.TotalMilliseconds, 0d, uint.MaxValue - 1d)) == 0;

    public void Resize(int columns, int rows)
    {
        // COORD is two shorts; a width that does not fit would ask ConPTY for a negative screen.
        if (columns is < 1 or > short.MaxValue || rows is < 1 or > short.MaxValue)
        {
            throw new ArgumentOutOfRangeException(nameof(columns), $"a {columns}x{rows} PTY does not fit the terminal coordinate type");
        }

        var result = ResizePseudoConsole(_pseudoConsole, new COORD((short)columns, (short)rows));
        if (result != 0)
        {
            throw new Win32Exception(unchecked((int)result), $"ResizePseudoConsole({columns}x{rows}) failed");
        }
    }

    public void Kill()
    {
        if (!TerminateProcess(_process, 1))
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "TerminateProcess on the PTY child failed");
        }
    }

    public static ConPtySession Start(PtyStartRequest request)
    {
        if (request.Columns < 2 || request.Rows < 2)
        {
            throw new ArgumentOutOfRangeException(nameof(request), "a PTY smaller than 2x2 cannot hold a prompt");
        }

        // The pseudoconsole reads the child's keystrokes from the read end of one pipe and writes what
        // the child paints into the write end of the other; we keep the opposite ends to hand to a caller.
        if (!CreatePipe(out var consoleIn, out var clientWrite, IntPtr.Zero, 0) || !CreatePipe(out var clientRead, out var consoleOut, IntPtr.Zero, 0))
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "creating the PTY pipes failed");
        }

        var attributeList = IntPtr.Zero;
        var environmentBlock = IntPtr.Zero;
        var commandLine = IntPtr.Zero;
        IntPtr pseudoConsole = IntPtr.Zero;
        var handedOff = false;
        var scratchHandles = new List<IntPtr> { consoleIn, clientWrite, clientRead, consoleOut };
        try
        {
            var created = CreatePseudoConsole(new COORD((short)request.Columns, (short)request.Rows), consoleIn, consoleOut, 0, out pseudoConsole);
            if (created != 0)
            {
                throw new Win32Exception(unchecked((int)created), "CreatePseudoConsole failed");
            }

            var size = IntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref size);
            if (size == IntPtr.Zero)
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "sizing the process attribute list failed");
            }

            attributeList = Marshal.AllocHGlobal(size);
            if (!InitializeProcThreadAttributeList(attributeList, 1, 0, ref size))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "InitializeProcThreadAttributeList failed");
            }

            // The attribute value is the console handle itself, read as <c>cbSize</c> bytes — not the
            // address of a variable holding it. Measured with a pointer to a slot, the stream carried zero
            // bytes: CreateProcess reported success, the child ran, and nothing about the missing console
            // was said anywhere.
            if (!UpdateProcThreadAttribute(attributeList, 0, AttributePseudoConsole, pseudoConsole, (IntPtr)IntPtr.Size, IntPtr.Zero, IntPtr.Zero))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "attaching the pseudoconsole to the startup info failed");
            }

            commandLine = Marshal.StringToHGlobalUni(Win32CommandLine.Build(request.Executable, request.ArgumentList));
            if (request.Environment is { } environment)
            {
                environmentBlock = Marshal.StringToHGlobalUni(BuildEnvironmentBlock(environment));
            }

            var startupInfo = new STARTUPINFOEX
            {
                cb = (uint)Marshal.SizeOf<STARTUPINFOEX>(),
                // Saying "the standard handles are the ones below" and then giving three nulls is what
                // keeps a PTY child off the host's own handles. Without it the child inherits the
                // parent's std handles, which for a tool host means a JSON protocol pipe: the program
                // would believe it has no terminal, and its output would land on the wire. Measured here
                // as [Console]::IsOutputRedirected == true and Console.WindowWidth throwing IOException
                // while `mode con` reported the pseudoconsole's size — a console the child could open,
                // but was not standing on.
                dwFlags = UseStdHandles,
                lpAttributeList = attributeList
            };

            if (!CreateProcess(IntPtr.Zero, commandLine, IntPtr.Zero, IntPtr.Zero, false, ExtremePresent | UnicodeEnvironment, environmentBlock, request.WorkingDirectory, ref startupInfo, out var processInformation))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), $"starting '{request.Executable}' on the PTY failed");
            }

            CloseHandle(processInformation.hThread);
            var process = new SafeProcessHandle(processInformation.hProcess, true);
            // Synchronous streams: an anonymous pipe cannot be opened for overlapped I/O, so .NET refuses
            // <c>isAsync: true</c> on these handles. A reader therefore parks until the child writes,
            // which is what a terminal host does with a pty anywhere, and Dispose ending the child is what
            // releases a parked reader — see the order in <see cref="Dispose"/>.
            var output = new FileStream(new SafeFileHandle(clientRead, true), FileAccess.Read, 4096);
            var input = new FileStream(new SafeFileHandle(clientWrite, true), FileAccess.Write, 4096);

            var session = new ConPtySession(process, pseudoConsole, output, input, processInformation.dwProcessId);
            handedOff = true;

            // The pseudoconsole took these two ends at CreatePseudoConsole and the child is now attached,
            // so our copies have no further use. Closing them is what lets the caller's stream learn that
            // the channel is gone. Ordered after the hand-off so the finally cannot close them twice.
            CloseHandle(consoleIn);
            CloseHandle(consoleOut);
            return session;
        }
        finally
        {
            if (attributeList != IntPtr.Zero)
            {
                DeleteProcThreadAttributeList(attributeList);
                Marshal.FreeHGlobal(attributeList);
            }
            if (environmentBlock != IntPtr.Zero)
            {
                Marshal.FreeHGlobal(environmentBlock);
            }
            if (commandLine != IntPtr.Zero)
            {
                Marshal.FreeHGlobal(commandLine);
            }
            // Everything here is scratch: once the session exists, the four pipe ends belong to it (two as
            // the caller's streams, two as the console's own), and closing them would close the screen.
            if (!handedOff)
            {
                foreach (var handle in scratchHandles)
                {
                    CloseHandle(handle);
                }

                // The session owns the pseudoconsole once the child is running; closing it here would
                // tear the screen out from under a process that just started.
                if (pseudoConsole != IntPtr.Zero)
                {
                    ClosePseudoConsole(pseudoConsole);
                }
            }
        }
    }

    /// <summary>
    /// The overrides are merged onto a copy of this process's environment. That is not convenience:
    /// <c>CreateProcess</c> treats <c>lpEnvironment</c> as the child's complete environment, so a block
    /// holding only the two variables a caller named would start a TUI with no <c>PATH</c> and no
    /// <c>SYSTEMROOT</c> — a child that fails for a reason the caller cannot see in its own arguments.
    /// A null override removes the variable, matching how the harness env contract is already described.
    /// </summary>
    private static string BuildEnvironmentBlock(IReadOnlyDictionary<string, string?> overrides)
    {
        var merged = new SortedDictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (DictionaryEntry entry in Environment.GetEnvironmentVariables())
        {
            // Hidden "=C:" style entries carry the current directory per drive. They sort by their text
            // after the '=', not as if the '=' were a character, so an ordinal sort would put them wrong.
            if (entry.Key is string name && !name.StartsWith('=') && entry.Value is string value)
            {
                merged[name] = value;
            }
        }

        foreach (var (name, value) in overrides)
        {
            merged[name] = value;
        }

        var builder = new System.Text.StringBuilder();
        foreach (var (name, value) in merged)
        {
            if (value is null)
            {
                continue;
            }

            builder.Append(name).Append('=').Append(value).Append('\0');
        }
        builder.Append('\0');
        return builder.ToString();
    }

    /// <summary>
    /// Closes the screen, the streams and the child.
    /// </summary>
    public void Dispose()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0)
        {
            return;
        }

        // A PTY child that outlives its session is a window nobody can close, so termination is part of
        // disposal here even though Kill() is the call a caller uses when it wants to be told about it.
        if (!HasExited)
        {
            TerminateProcess(_process, 1);
        }

        _input.Dispose();
        _output.Dispose();
        ClosePseudoConsole(_pseudoConsole);
        _process.Dispose();
    }

    private static void CloseHandle(IntPtr handle)
    {
        if (handle != IntPtr.Zero)
        {
            CloseHandlePrivate(handle);
        }
    }

    private sealed class SafeProcessHandle : SafeHandle
    {
        public SafeProcessHandle(IntPtr handle, bool ownsHandle) : base(handle, ownsHandle)
        {
        }

        public override bool IsInvalid => handle == IntPtr.Zero;

        protected override bool ReleaseHandle() => CloseHandlePrivate(handle);
    }

    [StructLayout(LayoutKind.Sequential)]
    private readonly struct COORD
    {
        public readonly short X;
        public readonly short Y;

        public COORD(short x, short y)
        {
            X = x;
            Y = y;
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct STARTUPINFOEX
    {
        public uint cb;
        public IntPtr lpReserved;
        public IntPtr lpDesktop;
        public IntPtr lpTitle;
        public uint dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
        public ushort wShowWindow, cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
        public IntPtr lpAttributeList;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION
    {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    [DllImport("kernel32", SetLastError = true)]
    private static extern bool CreatePipe(out IntPtr readHandle, out IntPtr writeHandle, IntPtr securityAttributes, int size);

    [DllImport("kernel32", EntryPoint = "CloseHandle", SetLastError = true)]
    private static extern bool CloseHandlePrivate(IntPtr handle);

    [DllImport("kernel32", SetLastError = true)]
    private static extern uint WaitForSingleObject(SafeHandle handle, uint milliseconds);

    [DllImport("kernel32", SetLastError = true)]
    private static extern bool GetExitCodeProcess(SafeHandle handle, out uint exitCode);

    [DllImport("kernel32", SetLastError = true)]
    private static extern bool TerminateProcess(SafeHandle handle, uint exitCode);

    [DllImport("kernel32", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CreateProcess(
        IntPtr applicationName,
        IntPtr commandLine,
        IntPtr processAttributes,
        IntPtr threadAttributes,
        bool inheritHandles,
        uint creationFlags,
        IntPtr environment,
        string workingDirectory,
        ref STARTUPINFOEX startupInfo,
        out PROCESS_INFORMATION processInformation);

    [DllImport("kernel32")]
    private static extern uint CreatePseudoConsole(COORD size, IntPtr input, IntPtr output, uint flags, out IntPtr pseudoConsole);

    [DllImport("kernel32")]
    private static extern uint ResizePseudoConsole(IntPtr pseudoConsole, COORD size);

    [DllImport("kernel32")]
    private static extern void ClosePseudoConsole(IntPtr pseudoConsole);

    [DllImport("kernel32", SetLastError = true)]
    private static extern bool InitializeProcThreadAttributeList(IntPtr attributeList, int attributeCount, int flags, ref IntPtr sizeInBytes);

    [DllImport("kernel32", SetLastError = true)]
    private static extern bool UpdateProcThreadAttribute(IntPtr attributeList, uint flags, ulong attribute, IntPtr value, IntPtr size, IntPtr previousValue, IntPtr previousSize);

    [DllImport("kernel32")]
    private static extern void DeleteProcThreadAttributeList(IntPtr attributeList);
}
