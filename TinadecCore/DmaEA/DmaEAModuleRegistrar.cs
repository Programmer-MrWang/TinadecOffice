using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TinadecCore.Abstractions;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Persistence;

namespace TinadecCore.DmaEA;

/// <summary>
/// DmaEA module registrar. Registers the dual-layer agent orchestrator.
/// </summary>
public sealed class DmaEAModuleRegistrar : IModuleRegistrar
{
    public string ModuleId => "dma_ea";

    public void Register(ITinadecCoreBuilder builder)
    {
        Maf18RuntimeAdapter.EnsureCompatible();
        builder.Services.AddDbContextFactory<AgentControlDbContext>((sp, options) => options.UseTinadecDatabase(sp));
        builder.Services.AddSingleton<IStorageMigrationParticipant, DbContextMigrationParticipant<AgentControlDbContext>>();
        builder.Services.AddSingleton<AgentRuntimeConfigurationStore>();
        builder.Services.AddSingleton<IAgentRuntimeConfiguration>(sp => sp.GetRequiredService<AgentRuntimeConfigurationStore>());
        builder.Services.AddSingleton<IAgentRuntimeConfigurationResolver, AgentRuntimeConfigurationResolver>();
        builder.Services.AddSingleton<IRuntimeContextSettings, RuntimeContextSettingsAdapter>();
        builder.Services.AddSingleton<IAgentChatClientFactory>(sp => new AgentChatClientFactory(
            sp.GetRequiredService<IChatResolver>(),
            sp.GetRequiredService<CliRuntime.IOpencodeServeProcessManager>(),
            sp.GetRequiredService<CliRuntime.Acp.IAcpSessionHost>(),
            sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<AgentChatClientFactory>>()));
        builder.Services.AddSingleton<ITinaChatIntentInterpreter, TinaChatIntentInterpreter>();
        // Standing organization members take their turns with the model plumbing that lives here; the
        // communication module resolves the runner lazily, so neither module constructs the other.
        builder.Services.AddSingleton<ITinaChatMemberTurnRunner>(sp => new TinaChatMemberTurnRunner(
            sp.GetRequiredService<ILifecycleManager>(),
            sp.GetRequiredService<IAgentChatClientFactory>(),
            sp,
            sp.GetService<Microsoft.Extensions.Logging.ILogger<TinaChatMemberTurnRunner>>(),
            sp.GetService<Microsoft.Extensions.Configuration.IConfiguration>()?.GetValue<int?>("TinadecTinaChat:MemberTurnRounds") ?? 6));
        builder.Services.AddSingleton<IGovernanceTopicSink, GovernanceTopicSink>();
        builder.Services.AddSingleton<IApprovalGateJudge, ApprovalGateJudge>();
        builder.Services.AddSingleton<CliRuntime.OpencodeServeProcessManager>();
        builder.Services.AddSingleton<CliRuntime.IOpencodeServeProcessManager>(sp => sp.GetRequiredService<CliRuntime.OpencodeServeProcessManager>());
        // ACP sessions are hosted per provider instance and must die with the host, so the port is
        // the concrete singleton: the same concrete-plus-port shape the opencode serve host uses. The
        // interaction router is a factory because a router's pending approvals belong to one session,
        // and Round 2 swaps what that factory returns without rewiring anything.
        builder.Services.AddSingleton(sp => CliRuntime.Acp.AcpSessionOptions.From(sp.GetService<IConfiguration>()));
        builder.Services.AddSingleton<CliRuntime.Acp.IAcpInteractionRouterFactory, CliRuntime.Acp.RefusingAcpInteractionRouterFactory>();
        builder.Services.AddSingleton<CliRuntime.Acp.AcpSessionHost>();
        builder.Services.AddSingleton<CliRuntime.Acp.IAcpSessionHost>(sp => sp.GetRequiredService<CliRuntime.Acp.AcpSessionHost>());
        // The control plane proves a harness with a handshake. It goes through this port rather than
        // the session host because the host's request type carries the spawn shape — argv and working
        // directory — and those belong to the ACP layer, not to whichever caller wants a probe.
        builder.Services.AddSingleton<CliRuntime.IAcpHarnessProber, CliRuntime.AcpHarnessProber>();
        // The catalog is a compiled table of vendor facts and carries no machine state, so the tokens
        // it stores ({UserProfile}, {LocalAppData}) are expanded here and nowhere else.
        builder.Services.AddSingleton<IHarnessBinaryResolver, CliRuntime.HarnessBinaryResolver>();
        builder.Services.AddSingleton<AgentInstanceService>();
        builder.Services.AddSingleton<IAgentInstanceService>(sp => sp.GetRequiredService<AgentInstanceService>());
        builder.Services.AddSingleton<IAgentToolAuthorization>(sp => sp.GetRequiredService<AgentInstanceService>());
        builder.Services.AddSingleton<IOperationalTriggerEvaluator, OperationalTriggerEvaluator>();
        builder.Services.AddSingleton<TinadecCore.Abstractions.Ports.IOrchestrationDirectiveValidator, Orchestration.OrchestrationDirectiveValidator>();
        builder.Services.AddSingleton<IRunReplayService, RunReplayService>();
        // Hard insert (todo D2): process-local, like the in-flight tool registry.
        builder.Services.AddSingleton<IRunInterrupts, RunInterruptRegistry>();
        builder.Services.AddSingleton<FullDuplexRunEngine>();
        builder.Services.AddSingleton<IFullDuplexRunEngine>(sp => sp.GetRequiredService<FullDuplexRunEngine>());
        builder.Services.AddHostedService(sp => sp.GetRequiredService<FullDuplexRunEngine>());
        builder.Services.AddSingleton<IFullDuplexRunCoordinator, FullDuplexRunCoordinator>();
        builder.RegisterModule(new ModuleDescriptor
        {
            ModuleId = ModuleId,
            Version = "0.1.0",
            Dependencies = ["abstractions", "persistence", "lifecycle", "models", "memory", "context", "prompts", "loop_guard", "tools"],
            Capabilities = ["dual_layer_orchestration", "task_dispatch", "collaboration", "scheduling", "result_aggregation", "operational_trigger_chain", "standing_member_turns", "governance_topic_sink", "approval_gate_judge"],
            Language = "C#",
            MafPrimitives = ["agent", "workflow"],
            RegistrationStatus = ModuleRegistrationStatus.Registered
        });
    }
}
