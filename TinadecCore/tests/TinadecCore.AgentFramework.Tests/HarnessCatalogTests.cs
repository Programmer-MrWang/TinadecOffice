using TinadecCore.Abstractions.Ports;

namespace TinadecCore.AgentFramework.Tests;

/// <summary>
/// Pins the channel vocabulary and the harness catalog against the specific fabrications that made
/// the ACP channel unconnectable: driver names that implied a channel, a protocol inferred from a
/// driver string, and an invented port flag handed to binaries that never mentioned one.
/// </summary>
public sealed class HarnessCatalogTests
{
    private static readonly string[] KnownProtocols =
    [
        ChatProtocols.OpenAiChat,
        ChatProtocols.OpenAiResponses,
        ChatProtocols.AnthropicMessages,
        ChatProtocols.Acp,
        ChatProtocols.OpencodeServe,
        ChatProtocols.HeadlessCli,
        ChatProtocols.Tui
    ];

    [Fact]
    public void Catalog_ContainsEveryMeasuredHarness()
    {
        Assert.Equal(
            ["claude-code", "codebuddy", "codex", "cursor", "dsh", "kimi-code", "opencode", "zcode"],
            HarnessCatalog.All.Select(spec => spec.Id).OrderBy(id => id, StringComparer.Ordinal).ToArray());
    }

    [Fact]
    public void Catalog_EveryChannelIsKnownAndEveryProtocolIsDeclared()
    {
        foreach (var spec in HarnessCatalog.All)
        {
            Assert.NotEmpty(spec.Channels);
            Assert.NotNull(spec.Id);
            Assert.NotEmpty(spec.BinaryNames);
            Assert.StartsWith("https://", spec.DocsUrl, StringComparison.Ordinal);
            foreach (var channel in spec.Channels)
            {
                Assert.Contains(channel.Channel, AgentChannels.All);
                Assert.Contains(channel.Protocol, KnownProtocols);
            }

            if (spec.HttpServer is { } http) Assert.Contains(http.Protocol, KnownProtocols);
            if (spec.HttpServer is null) Assert.Contains(spec.DefaultProtocol, KnownProtocols);

            // A protocol may not appear twice on one harness: it would make the (harness, channel)
            // lookup ambiguous, which is the exact coupling this vocabulary removes.
            Assert.Equal(spec.Channels.Select(channel => channel.Protocol).Distinct().Count(), spec.Channels.Count);
        }
    }

    /// <summary>
    /// The guard that makes the replacement irreversible. <c>claude --help</c> and
    /// <c>codex --help</c> on this host mention ACP zero times, and ZCode's own CLI ships an
    /// app-server rather than an ACP endpoint. Re-advertising acp for any of them re-creates the
    /// fabrication this batch deleted.
    /// </summary>
    [Theory]
    [InlineData("claude-code")]
    [InlineData("codex")]
    [InlineData("zcode")]
    public void HarnessesWithoutAnAcpEndpoint_DeclareNoAcpChannel(string id)
    {
        var spec = HarnessCatalog.Find(id);
        Assert.NotNull(spec);
        Assert.DoesNotContain(AgentChannels.Acp, spec.Channels.Select(channel => channel.Channel));
        Assert.Null(spec.Channel(AgentChannels.Acp));
        Assert.NotEqual(ChatProtocols.Acp, HarnessCatalog.ProtocolFor(id, null));
    }

    [Theory]
    [InlineData("opencode")]
    [InlineData("cursor")]
    [InlineData("codebuddy")]
    [InlineData("dsh")]
    [InlineData("kimi-code")]
    public void AcpNativeHarnesses_ResolveAcpForTheirChannel(string id)
        => Assert.Equal(ChatProtocols.Acp, HarnessCatalog.ProtocolFor(id, AgentChannels.Acp));

    /// <summary>Cursor's real ACP entry point is the <c>acp</c> subcommand, not a port flag.</summary>
    [Fact]
    public void Cursor_AcpChannelUsesTheSubcommandRatherThanAnInjectedPort()
    {
        var channel = HarnessCatalog.Find("cursor")!.Channel(AgentChannels.Acp);
        Assert.NotNull(channel);
        Assert.Equal(["acp"], channel.Argv);
        Assert.Empty(channel.MandatoryArgs);
    }

    /// <summary>
    /// CodeBuddy's non-interactive run stops on a permission prompt unless <c>-y</c> is present, so
    /// a probe without it reads as an environment problem rather than a missing flag. The flag is
    /// per-channel: injecting it into <c>codebuddy --acp</c> would be unverified behavior.
    /// </summary>
    [Fact]
    public void Codebuddy_HeadlessChannelCarriesTheNonInteractiveFlag()
    {
        var spec = HarnessCatalog.Find("codebuddy")!;
        Assert.Equal(["--acp"], spec.Channel(AgentChannels.Acp)!.Argv);
        Assert.Empty(spec.Channel(AgentChannels.Acp)!.MandatoryArgs);
        Assert.Equal(["-y"], spec.Channel(AgentChannels.Cli)!.MandatoryArgs);
        Assert.Contains(HarnessCatalog.PromptPlaceholder, spec.Channel(AgentChannels.Cli)!.Argv);
    }

    /// <summary>
    /// CodeBuddy's <c>--help</c> POSTs telemetry to galileotelemetry.tencent.com before printing, so
    /// it hangs or fails offline. A version probe that shells out to it turns discovery into a
    /// network request; the tolerance covers the offline non-zero exit.
    /// </summary>
    [Fact]
    public void Codebuddy_VersionProbeRefusesTheTelemetryBearingHelpFlag()
    {
        var probe = HarnessCatalog.Find("codebuddy")!.VersionProbe;
        Assert.Contains("--help", probe.NeverUse);
        Assert.DoesNotContain("--help", probe.Argv);
        Assert.True(probe.TolerateNonZeroExit);
    }

    [Fact]
    public void BundledBinaries_AreSearchedBeforePathForTheHarnessesThatShipOutsideIt()
    {
        // Verified on this host: codebuddy lives under WorkBuddy's unpacked resources, kimi under
        // ~/.kimi-code/bin, and neither is on PATH. A stale global npm copy must not win.
        foreach (var id in new[] { "codebuddy", "kimi-code", "cursor" })
        {
            Assert.NotEmpty(HarnessCatalog.Find(id)!.ExtraSearchRoots);
        }

        Assert.Contains("{ProgramFiles}", HarnessCatalog.Find("codebuddy")!.ExtraSearchRoots.Single(root => root.Contains("ProgramFiles", StringComparison.Ordinal)));
        // Tokens, not expanded paths: expansion happens at resolution time so tests can substitute roots.
        foreach (var spec in HarnessCatalog.All)
        {
            foreach (var root in spec.ExtraSearchRoots)
            {
                Assert.DoesNotContain(@"C:\", root, StringComparison.OrdinalIgnoreCase);
                Assert.DoesNotContain("/home/", root, StringComparison.Ordinal);
            }
        }
    }

    /// <summary>
    /// <c>opencode</c> is the one path that worked before this vocabulary existed, so a stored row
    /// naming that driver must keep resolving to the HTTP server protocol with no channel recorded.
    /// </summary>
    [Fact]
    public void LegacyOpencodeRow_WithoutChannel_StillResolvesTheHttpServerProtocol()
        => Assert.Equal(ChatProtocols.OpencodeServe, HarnessCatalog.ResolveProtocol(null, "opencode", null));

    [Fact]
    public void ResolveProtocol_ConfiguredValueAlwaysWins()
    {
        Assert.Equal(ChatProtocols.AnthropicMessages, HarnessCatalog.ResolveProtocol("anthropic-messages", "opencode", "acp"));
        Assert.Equal(ChatProtocols.Acp, HarnessCatalog.ResolveProtocol(null, "opencode", AgentChannels.Acp));
    }

    [Fact]
    public void ResolveProtocol_HttpApiDrivers_StillComeFromTheDriverMap()
    {
        Assert.Equal(ChatProtocols.AnthropicMessages, HarnessCatalog.ResolveProtocol(null, "anthropic", null));
        Assert.Equal(ChatProtocols.AnthropicMessages, HarnessCatalog.ResolveProtocol(null, "claude", null));
        Assert.Equal(ChatProtocols.OpenAiResponses, HarnessCatalog.ResolveProtocol(null, "openai-responses", null));
        Assert.Equal(ChatProtocols.OpenAiChat, HarnessCatalog.ResolveProtocol(null, "openai", null));
    }

    /// <summary>
    /// The driver half of the old inference mapped all three CLI drivers to acp. They are not catalog
    /// ids, so the only honest answer left is the default — and the model center shows such a row as
    /// an unrecognized harness rather than pretending the connect would work.
    /// </summary>
    [Theory]
    [InlineData("claude-cli")]
    [InlineData("codex-cli")]
    [InlineData("cursor-acp")]
    public void ObsoleteChannelBearingDrivers_InventNoProtocol(string driver)
    {
        Assert.Null(HarnessCatalog.Find(driver));
        Assert.NotEqual(ChatProtocols.Acp, HarnessCatalog.ResolveProtocol(null, driver, null));
        Assert.Equal(ChatProtocols.OpenAiChat, HarnessCatalog.ResolveProtocol(null, driver, null));
    }

    [Fact]
    public void InferFromDriver_NoLongerMapsAnyHarnessDriver()
    {
        foreach (var spec in HarnessCatalog.All)
        {
            Assert.Equal(ChatProtocols.OpenAiChat, ChatProtocols.InferFromDriver(spec.Id));
        }
    }

    /// <summary>
    /// A channel decides how Core spawns and talks to a process, so an unknown value must not
    /// silently become a default the way an unknown protocol becomes openai-chat.
    /// </summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("grpc")]
    [InlineData("acpp")]
    [InlineData("stdio")]
    public void AgentChannels_UnknownValuesNormalizeToNullRatherThanAGuess(string? channel)
        => Assert.Null(AgentChannels.Normalize(channel));

    [Fact]
    public void AgentChannels_AreCaseAndWhitespaceTolerant()
    {
        Assert.Equal(AgentChannels.Acp, AgentChannels.Normalize(" ACP "));
        Assert.Equal(AgentChannels.Cli, AgentChannels.Normalize("CLI"));
        Assert.Equal(AgentChannels.Tui, AgentChannels.Normalize("tui"));
        Assert.Equal(3, AgentChannels.All.Count);
    }

    [Fact]
    public void UnsupportedChannel_ResolvesNoProtocolRatherThanTheHarnessDefault()
    {
        // zcode has no acp channel. Asking for one must not fall back to headless-cli: that would
        // silently run a different shape than the caller requested.
        Assert.Null(HarnessCatalog.ProtocolFor("zcode", AgentChannels.Acp));
        Assert.Null(HarnessCatalog.ProtocolFor("opencode", "acpp"));
        Assert.Null(HarnessCatalog.ProtocolFor(null, AgentChannels.Acp));
    }

    [Fact]
    public void EveryHarness_VendorsItsOwnCredentialAndConfigFactsOrSaysItDoesNot()
    {
        foreach (var spec in HarnessCatalog.All)
        {
            // EnvVars names only: Core never reads, logs, or persists a value from any of them, so
            // an unverified harness records an empty list instead of a guessed variable name.
            Assert.All(spec.EnvVars, name => Assert.Matches("^[A-Z][A-Z0-9_]*$", name));
            Assert.All(spec.BinaryNames, name => Assert.DoesNotContain('/', name));
            Assert.False(string.IsNullOrWhiteSpace(spec.Vendor));
            Assert.False(string.IsNullOrWhiteSpace(spec.DisplayName));
        }
    }

    /// <summary>
    /// A harness whose channel list carries a caveat-worthy vendor behaviour must record it in the
    /// catalog, because discovery is the only place a user can read it before a connect fails.
    /// </summary>
    [Theory]
    [InlineData("codebuddy")]
    [InlineData("dsh")]
    [InlineData("kimi-code")]
    [InlineData("cursor")]
    [InlineData("zcode")]
    public void HarnessesWithMeasuredVendorQuirks_CarryThemAsCaveats(string id)
        => Assert.NotEmpty(HarnessCatalog.Find(id)!.KnownCaveats);

    /// <summary>
    /// The fabricated port-flag injection was the lie's engine: it appended a port flag to binaries
    /// that never mentioned one, then polled an HTTP URL for twenty seconds. This scan pins the exact
    /// files per source tree that still carry it, so every later batch that empties one has to edit
    /// this list, and a new occurrence fails immediately. Trees absent from a Core-only checkout are
    /// skipped rather than asserted, which is why each expectation is checked against the tree it
    /// belongs to instead of one global list.
    /// <para>
    /// Prose history in AGENTS.md is excluded: those are dated change-log entries, and the repo
    /// convention is to append a new entry rather than rewrite what was recorded.
    /// </para>
    /// </summary>
    [Fact]
    public void FabricatedAcpPortFlag_ExistsOnlyInTheFilesScheduledToDeleteIt()
    {
        var root = FindRepositoryRoot();
        var problems = new List<string>();

        // Core is empty of it: the fabricated flag lived in the CLI process host, which is now the
        // opencode serve host and decides its port before spawning. Any new occurrence here is a
        // regression, not a scheduled deletion.
        AssertCodeFiles(root, "TinadecCore", problems, []);

        // Both trees are empty of it now: Core's process host stopped injecting a port flag, and the
        // desktop template table that offered it as cursor's placeholder is the catalog-driven harness
        // table in this same commit. A new occurrence anywhere is a regression, not a scheduled deletion.
        AssertCodeFiles(root, Path.Combine("apps", "desktop", "src"), problems, []);

        AssertCodeFiles(root, "TinadecGateway", problems, []);
        AssertCodeFiles(root, "docs", problems, []);

        // True with a message rather than Empty: a truncated collection dump hides which tree still
        // carries the flag, and this failure is meant to be read by whoever shrinks the baseline.
        Assert.True(problems.Count == 0, string.Join(Environment.NewLine, problems));
    }

    private static void AssertCodeFiles(string root, string relativeDirectory, List<string> problems, string[] expected)
    {
        var baseDirectory = Path.Combine(root, relativeDirectory);
        if (!Directory.Exists(baseDirectory)) return;

        // Split so this file cannot match its own scan: the guard's job is to find the literal in
        // production source, and a scanner that finds itself produces a baseline nobody can read.
        var patterns = new[] { "--acp" + "-port", "(?" + ":acp-)?port" };
        var found = Directory
            .EnumerateFiles(baseDirectory, "*", SearchOption.AllDirectories)
            .Where(path => !IsGeneratedOrProse(path))
            .Where(path => patterns.Any(pattern => File.ReadAllText(path).Contains(pattern, StringComparison.Ordinal)))
            .Select(path => Path.GetRelativePath(root, path).Replace('\\', '/'))
            .OrderBy(path => path, StringComparer.Ordinal)
            .ToArray();

        var anticipated = expected.OrderBy(path => path, StringComparer.Ordinal).ToArray();
        if (!anticipated.SequenceEqual(found, StringComparer.Ordinal))
        {
            problems.Add($"{relativeDirectory}: expected [{string.Join(", ", anticipated)}], found [{string.Join(", ", found)}]");
        }
    }

    private static bool IsGeneratedOrProse(string path)
    {
        var name = Path.GetFileName(path);
        if (string.Equals(name, "AGENTS.md", StringComparison.OrdinalIgnoreCase)) return true;
        foreach (var segment in path.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar))
        {
            if (segment is "bin" or "obj" or "node_modules" or ".git" or ".runtime-cache" or "TestResults") return true;
        }

        return false;
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "TinadecCore"))) return directory.FullName;
            directory = directory.Parent;
        }

        throw new InvalidOperationException(
            "Could not locate the TinadecOffice repository root from " + AppContext.BaseDirectory +
            "; the harness-catalog source scan needs it to read the checked-out trees.");
    }
}
