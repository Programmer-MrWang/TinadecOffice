namespace TinadecCore.Abstractions.Ports;

/// <summary>
/// One channel a harness can be driven over: the argv that selects it and the wire protocol Core
/// then speaks there. Argv entries are templates — <see cref="HarnessCatalog.PromptPlaceholder"/>
/// and <see cref="HarnessCatalog.PortPlaceholder"/> are substituted at spawn time and are never
/// stored in provider configuration.
/// </summary>
public sealed record HarnessChannelSpec(
    string Channel,
    string Protocol,
    IReadOnlyList<string> Argv,
    IReadOnlyList<string> MandatoryArgs);

/// <summary>
/// A harness that also exposes a long-lived local HTTP server instead of a stdio session. This is
/// not a fourth channel: it is reached over HTTP, so readiness is a URL probe rather than a
/// handshake. <c>opencode serve</c> is the one Core has always been able to reach.
/// </summary>
public sealed record HarnessHttpSpec(
    string Protocol,
    IReadOnlyList<string> Argv,
    int DefaultPort);

/// <summary>
/// How to ask a harness for its version. <see cref="NeverUse"/> lists argv that must not be probed
/// even though they look harmless — a probe that shells out to a vendor command with side effects
/// turns a discovery call into a network request or a hang.
/// </summary>
public sealed record HarnessVersionProbe(
    IReadOnlyList<string> Argv,
    int TimeoutMs,
    bool TolerateNonZeroExit,
    IReadOnlyList<string> NeverUse);

/// <summary>
/// Everything TinadecCore knows about one external coding agent: how to find its binary, which
/// channels it offers, what argv selects each channel, and the vendor behaviour a caller cannot
/// discover by probing.
/// </summary>
/// <param name="EnvOverrides">
/// Environment variable names that pin the executable explicitly, checked before any search path.
/// </param>
/// <param name="ExtraSearchRoots">
/// Directories searched <em>before</em> <c>PATH</c>, so a vendor's own bundled binary wins over a
/// possibly stale global copy. Entries may use the <c>{ProgramFiles}</c>, <c>{LocalAppData}</c>,
/// <c>{AppData}</c> and <c>{UserProfile}</c> tokens; they expand at resolution time, not here, so
/// tests can substitute the roots.
/// </param>
/// <param name="EnvVars">
/// Environment variable names the harness itself reads. Names only — Core never reads, logs, or
/// persists a value from any of them. An empty list means "not verified against this harness",
/// never "this harness needs no credentials".
/// </param>
/// <param name="ConfigHome">
/// The harness's own configuration directory, or <c>null</c> when it has not been verified on a
/// supported host. Recorded so discovery can show it, not so Core can read the directory.
/// </param>
public sealed record HarnessSpec(
    string Id,
    string DisplayName,
    string Vendor,
    string DocsUrl,
    IReadOnlyList<string> BinaryNames,
    IReadOnlyList<string> EnvOverrides,
    IReadOnlyList<string> ExtraSearchRoots,
    IReadOnlyList<HarnessChannelSpec> Channels,
    HarnessHttpSpec? HttpServer,
    IReadOnlyList<string> EnvVars,
    string? ConfigHome,
    HarnessVersionProbe VersionProbe,
    IReadOnlyList<string> KnownCaveats)
{
    /// <summary>
    /// Protocol to assume when a stored provider carries neither an explicit <c>protocol</c> nor a
    /// <c>channel</c>. Prefers the HTTP server shape because that is the one path predating the
    /// channel vocabulary; otherwise the first declared channel is the vendor's primary one.
    /// </summary>
    public string DefaultProtocol => HttpServer?.Protocol ?? Channels[0].Protocol;

    public HarnessChannelSpec? Channel(string? channel)
    {
        var normalized = AgentChannels.Normalize(channel);
        return normalized is null ? null : Channels.FirstOrDefault(candidate => candidate.Channel == normalized);
    }
}

/// <summary>
/// Static registry of the external coding agents TinadecOffice can drive. It lives in
/// <c>Abstractions/Ports</c> as a compiled table — the same shape as
/// <see cref="WorkspaceToolCatalog"/> and <see cref="CoreVirtualToolPolicy"/> — because it carries
/// executable behaviour (exact argv per channel, bundled-root fallbacks, forced non-interactive
/// flags, probe tolerances) that has to be unit-testable and compile-checked. A TOML or JSON
/// resource would need its own validator, hot-reload store and test surface, and a DB table would
/// make vendor facts per-workspace state that drifts; neither is what this is.
/// </summary>
public static class HarnessCatalog
{
    /// <summary>Substituted with the prompt text at spawn time on the <see cref="AgentChannels.Cli"/> channel.</summary>
    public const string PromptPlaceholder = "{prompt}";

    /// <summary>Substituted with the chosen port at spawn time for the local HTTP server shape.</summary>
    public const string PortPlaceholder = "{port}";

    private static readonly string[] NoArgs = [];

    public static IReadOnlyList<HarnessSpec> All { get; } =
    [
        new(
            Id: "opencode",
            DisplayName: "OpenCode",
            Vendor: "SST",
            DocsUrl: "https://opencode.ai/docs",
            BinaryNames: ["opencode"],
            EnvOverrides: ["TINADEC_OPENCODE_EXECUTABLE"],
            ExtraSearchRoots: NoArgs,
            Channels:
            [
                new(AgentChannels.Acp, ChatProtocols.Acp, ["acp"], NoArgs),
                new(AgentChannels.Cli, ChatProtocols.HeadlessCli, ["run", PromptPlaceholder], NoArgs),
                new(AgentChannels.Tui, ChatProtocols.Tui, NoArgs, NoArgs)
            ],
            // The one harness-shaped path that worked before the channel vocabulary existed. Kept as
            // the default protocol so pre-existing opencode providers keep resolving opencode-serve.
            HttpServer: new(ChatProtocols.OpencodeServe, ["serve", "--port", PortPlaceholder], 4096),
            EnvVars: NoArgs,
            ConfigHome: null,
            VersionProbe: new(["--version"], 15_000, TolerateNonZeroExit: false, NeverUse: NoArgs),
            KnownCaveats: NoArgs),

        new(
            Id: "cursor",
            DisplayName: "Cursor",
            Vendor: "Anysphere",
            DocsUrl: "https://cursor.com/docs/cli/installation",
            BinaryNames: ["cursor-agent"],
            EnvOverrides: ["TINADEC_CURSOR_EXECUTABLE"],
            ExtraSearchRoots: ["{LocalAppData}/cursor-agent", "{UserProfile}/.local/bin"],
            Channels: [new(AgentChannels.Acp, ChatProtocols.Acp, ["acp"], NoArgs)],
            HttpServer: null,
            EnvVars: NoArgs,
            ConfigHome: null,
            VersionProbe: new(["--version"], 15_000, TolerateNonZeroExit: false, NeverUse: NoArgs),
            KnownCaveats:
            [
                "ACP 入口是子命令 `cursor-agent acp`，不是往任意 CLI 上追加端口 flag。",
                "Windows 上 npm 全局的 cursor-agent 是 .cmd shim，真实入口是 versions/<版本>/node.exe + index.js 的间接调用。",
                "未在开发机上验证过实机回合：该 harness 未安装，此行的 argv 来自上游已验证适配表。"
            ]),

        new(
            Id: "codebuddy",
            DisplayName: "CodeBuddy",
            Vendor: "Tencent",
            DocsUrl: "https://www.codebuddy.ai/docs/cli/overview",
            BinaryNames: ["codebuddy"],
            EnvOverrides: ["TINADEC_CODEBUDDY_EXECUTABLE"],
            // WorkBuddy ships its own CLI; the global npm copy can be older, so the bundled root
            // is searched first. Verified present on this host.
            ExtraSearchRoots:
            [
                "{ProgramFiles}/WorkBuddy/resources/app.asar.unpacked/cli/bin",
                "{LocalAppData}/Programs/WorkBuddy/resources/app.asar.unpacked/cli/bin"
            ],
            Channels:
            [
                new(AgentChannels.Acp, ChatProtocols.Acp, ["--acp"], NoArgs),
                new(AgentChannels.Cli, ChatProtocols.HeadlessCli,
                    ["-p", PromptPlaceholder, "--output-format", "stream-json", "--input-format", "stream-json"],
                    ["-y"]),
                new(AgentChannels.Tui, ChatProtocols.Tui, NoArgs, NoArgs)
            ],
            HttpServer: null,
            EnvVars: NoArgs,
            ConfigHome: null,
            VersionProbe: new(["--version"], 15_000, TolerateNonZeroExit: true, NeverUse: ["--help"]),
            KnownCaveats:
            [
                "`--help` 会先向 galileotelemetry.tencent.com POST 遥测再打印帮助；版本探针必须用 `--version`，并且容忍断网时的非零退出。",
                "非交互（`-p`）必须带 `-y`，否则停在权限提示上直到超时。",
                "它不在 PATH 上：权威二进制随 WorkBuddy 桌面端一起安装。"
            ]),

        new(
            Id: "dsh",
            DisplayName: "DeepSeek Harness",
            Vendor: "DeepSeek",
            DocsUrl: "https://github.com/deepseek-ai/deepseek-harness",
            BinaryNames: ["dsh"],
            EnvOverrides: ["TINADEC_DSH_EXECUTABLE"],
            ExtraSearchRoots: NoArgs,
            Channels:
            [
                new(AgentChannels.Acp, ChatProtocols.Acp, ["--profile", "acp"], NoArgs),
                new(AgentChannels.Cli, ChatProtocols.HeadlessCli, ["--profile", "headless", "--json", PromptPlaceholder], NoArgs),
                new(AgentChannels.Tui, ChatProtocols.Tui, ["tui"], NoArgs)
            ],
            HttpServer: null,
            EnvVars: ["DSH_HOME", "DEEPSEEK_API_KEY"],
            ConfigHome: null,
            VersionProbe: new(["--version"], 15_000, TolerateNonZeroExit: false, NeverUse: NoArgs),
            KnownCaveats:
            [
                "已观测到它在最后一个 session/update 之前就返回 prompt 回执（工具与 MCP 回合附近）；" +
                "回合必须经过排空窗口才算结束，否则回复非确定性地被截断。"
            ]),

        new(
            Id: "kimi-code",
            DisplayName: "Kimi Code",
            Vendor: "Moonshot AI",
            DocsUrl: "https://moonshotai.github.io/kimi-code/",
            BinaryNames: ["kimi"],
            EnvOverrides: ["TINADEC_KIMI_EXECUTABLE"],
            ExtraSearchRoots: ["{UserProfile}/.kimi-code/bin"],
            Channels:
            [
                new(AgentChannels.Acp, ChatProtocols.Acp, ["acp"], NoArgs),
                new(AgentChannels.Cli, ChatProtocols.HeadlessCli, ["-p", PromptPlaceholder, "--output-format", "stream-json"], NoArgs),
                new(AgentChannels.Tui, ChatProtocols.Tui, NoArgs, NoArgs)
            ],
            HttpServer: null,
            EnvVars: NoArgs,
            ConfigHome: "{UserProfile}/.kimi-code",
            VersionProbe: new(["--version"], 15_000, TolerateNonZeroExit: false, NeverUse: NoArgs),
            KnownCaveats:
            [
                "它自己会派子智能体：带 _meta['codebuddy.ai/parentToolCallId'] 的 session/update 绝不能拼进父回合的答案。",
                "ACP 能力面（fork、usage）的已验证记录来自 0.26.0；后续版本必须在连接时重新探测，不能照抄能力位。"
            ]),

        new(
            Id: "claude-code",
            DisplayName: "Claude Code",
            Vendor: "Anthropic",
            DocsUrl: "https://docs.anthropic.com/en/docs/claude-code",
            BinaryNames: ["claude"],
            EnvOverrides: ["TINADEC_CLAUDE_EXECUTABLE"],
            ExtraSearchRoots: NoArgs,
            // No acp channel: deliberate. `claude --help` on this host mentions ACP zero times, so
            // the previous claude-cli -> acp mapping could only ever fail to connect.
            Channels:
            [
                new(AgentChannels.Cli, ChatProtocols.HeadlessCli,
                    ["-p", PromptPlaceholder, "--output-format", "stream-json", "--input-format", "stream-json"], NoArgs),
                new(AgentChannels.Tui, ChatProtocols.Tui, NoArgs, NoArgs)
            ],
            HttpServer: null,
            EnvVars: NoArgs,
            ConfigHome: "{UserProfile}/.claude",
            VersionProbe: new(["--version"], 15_000, TolerateNonZeroExit: false, NeverUse: NoArgs),
            KnownCaveats:
            [
                "双向 stream-json 的 Agent SDK 会话是厂商原生协议，属于第二批；本轮只声明它确实可跑的一次性 headless 渠道。"
            ]),

        new(
            Id: "codex",
            DisplayName: "Codex CLI",
            Vendor: "OpenAI",
            DocsUrl: "https://developers.openai.com/codex/cli",
            BinaryNames: ["codex"],
            EnvOverrides: ["TINADEC_CODEX_EXECUTABLE"],
            ExtraSearchRoots: NoArgs,
            Channels:
            [
                new(AgentChannels.Cli, ChatProtocols.HeadlessCli, ["exec", "--json", PromptPlaceholder], NoArgs),
                new(AgentChannels.Tui, ChatProtocols.Tui, NoArgs, NoArgs)
            ],
            HttpServer: null,
            EnvVars: NoArgs,
            ConfigHome: "{UserProfile}/.codex",
            VersionProbe: new(["--version"], 15_000, TolerateNonZeroExit: false, NeverUse: NoArgs),
            KnownCaveats:
            [
                "原生协议是 `codex app-server`（stdio JSON-RPC），不是 ACP；`codex exec` 另支持 --output-schema FILE 与 -o FILE。第二批接入。"
            ]),

        new(
            Id: "zcode",
            DisplayName: "ZCode",
            Vendor: "Z.ai",
            DocsUrl: "https://zcode.z.ai/",
            BinaryNames: ["zcode"],
            EnvOverrides: ["TINADEC_ZCODE_EXECUTABLE"],
            ExtraSearchRoots: NoArgs,
            Channels:
            [
                new(AgentChannels.Cli, ChatProtocols.HeadlessCli, ["-p", PromptPlaceholder, "--json", "--mode", "build"], NoArgs),
                new(AgentChannels.Tui, ChatProtocols.Tui, ["tui"], NoArgs)
            ],
            HttpServer: null,
            EnvVars: NoArgs,
            ConfigHome: null,
            VersionProbe: new(["--version"], 15_000, TolerateNonZeroExit: false, NeverUse: NoArgs),
            KnownCaveats:
            [
                "不提供 ACP：`zcode app-server --stdio` 是厂商私有协议，帧里没有 \"jsonrpc\" 键，需要 JSON-RPC 连接层支持省略该字段的模式。第二批接入。",
                "--mode 的取值有 build|edit|yolo；目录钉在 build，yolo 会绕过权限提示，不属于受治理的默认。"
            ])
    ];

    /// <summary>Finds a harness by catalog id. Deliberately does not alias the pre-channel driver
    /// strings (<c>claude-cli</c>, <c>codex-cli</c>, <c>cursor-acp</c>): an alias table would keep
    /// the fabricated driver-implies-protocol coupling alive, and those rows could never connect
    /// anyway. They render in the model center as an unrecognized harness needing manual editing.</summary>
    public static HarnessSpec? Find(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        var needle = id.Trim();
        return All.FirstOrDefault(spec => string.Equals(spec.Id, needle, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Protocol for a (harness, channel) pair. Returns <c>null</c> when the driver is not a catalog
    /// harness, and also when the harness does not declare the requested channel — a channel is a
    /// routing decision, so a typo'd <c>acp</c> must not silently resolve to a headless one-shot.
    /// A missing channel falls back to the harness's primary protocol, which is what pre-channel
    /// stored rows mean.
    /// </summary>
    public static string? ProtocolFor(string? driver, string? channel)
    {
        var spec = Find(driver);
        if (spec is null) return null;
        if (string.IsNullOrWhiteSpace(channel)) return spec.DefaultProtocol;
        return spec.Channel(channel)?.Protocol;
    }

    /// <summary>
    /// The single resolution order for a provider's wire protocol: the explicitly configured value
    /// wins, then the harness catalog's (harness, channel) pair, then the HTTP API driver map.
    /// Every read path that needs a protocol calls this instead of restating the chain, because a
    /// consumer that drops the catalog step silently falls back to <c>openai-chat</c> for a harness.
    /// </summary>
    public static string ResolveProtocol(string? configuredProtocol, string? driver, string? channel) =>
        ChatProtocols.Normalize(configuredProtocol ?? ProtocolFor(driver, channel) ?? ChatProtocols.InferFromDriver(driver));

    /// <summary>
    /// The argv that opens one channel of one harness. Callers must not fall back to stored
    /// <c>launch_args</c>: passing a free-text argument string to a process safely needs a shell
    /// parser, and a driver the catalog does not know has no verified invocation for this channel —
    /// guessing one turns a typo into spawning an unrelated command with the user's prompt appended.
    /// </summary>
    public static IReadOnlyList<string> ChannelArgv(string? driver, string channel) =>
        Find(driver)?.Channel(channel)?.Argv
        ?? throw new InvalidOperationException(
            $"Harness '{driver}' has no '{channel}' channel in the catalog, so Core will not guess the argv that starts one.");
}
