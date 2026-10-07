using System.Text.Json;
using TinadecCore.Abstractions.Ports;
using TinadecCore.DmaEA;

namespace TinadecCore.AgentFramework.Tests;

public sealed class SpaceCompositionTests
{
    [Fact]
    public void SpecificationReviewProjectsTheEntireDocument_AndRejectsOversizeProposals()
    {
        var text = "# Requirements\n" + new string('规', 2000) + "\nTHE_END";
        var json = JsonSerializer.Serialize(new { stage = "requirements", document = text });
        var projection = ApprovalEvidenceProjector.Project("spec_propose", json);
        using var args = JsonDocument.Parse(projection.Arguments);
        Assert.Equal(text, args.RootElement.GetProperty("document").GetString());
        var stored = ApprovalEvidenceProjector.Encode(projection);
        Assert.True(stored.Length <= ApprovalEvidenceProjector.MaximumDigestLength);
        Assert.True(ApprovalEvidenceProjector.TryDecode(stored, out var restored));
        using var restoredArgs = JsonDocument.Parse(restored.Arguments);
        Assert.Equal(text, restoredArgs.RootElement.GetProperty("document").GetString());
        Assert.Null(ApprovalEvidenceProjector.SpecificationArguments("requirements", new string('x', 3001)));
        Assert.Null(ApprovalEvidenceProjector.SpecificationArguments("requirements", new string('"', 3000)));
    }
    private static FrozenRunConfigurationV1 Configuration(SpaceRunOptions options) => new(
        FrozenRunConfigurationV1.CurrentSchemaVersion, "baseline", 1, Guid.NewGuid(), "space", "ask",
        new(2, 16, 4), new(2, 2, true), new(true, 2), new(65536, 128, true),
        new(true, 8, [], []), new("test", true, true, 60, 0), [], [], [])
    {
        SpaceOptions = options,
        ToolManifest =
        [
            new("read_file", "read", JsonSerializer.SerializeToElement(new { }), "low", false, false, "safe", []),
            new("write_file", "write", JsonSerializer.SerializeToElement(new { }), "medium", true, true, "unsafe", []),
        ],
    };

    [Fact]
    public void PlanGate_ReadsAndConversationStayOpen_WritesWaitForActualPlan()
    {
        var config = Configuration(new(PlanFirst: true));
        var checkpoint = new FullDuplexCheckpointV1();
        var task = new DurableTaskNode();
        Assert.Null(FullDuplexRunEngine.SpaceToolRefusal(config, checkpoint, task, new() { ToolId = "read_file" }));
        Assert.Contains("plan_update", FullDuplexRunEngine.SpaceToolRefusal(config, checkpoint, task, new() { ToolId = "write_file" }));
        task.Plan = [new("Change the verified file", "pending")];
        Assert.Null(FullDuplexRunEngine.SpaceToolRefusal(config, checkpoint, task, new() { ToolId = "write_file" }));
        Assert.Null(FullDuplexRunEngine.SpaceToolRefusal(Configuration(new()), checkpoint, new(), new() { ToolId = "write_file" }));
    }

    [Fact]
    public void ModelCannotSpoofProvisioningUsingTheReservedCallId()
    {
        var config = Configuration(new(PlanFirst: true, SpecEnabled: true, Worktree: true));
        var call = new WorkerToolTurn { CallId = "core-space-worktree", ToolId = "write_file" };
        Assert.NotNull(FullDuplexRunEngine.SpaceToolRefusal(config, new(), new() { IsSpacePreparation = true }, call));
        call.IsSpaceWorktreeProvisioning = true;
        Assert.NotNull(FullDuplexRunEngine.SpaceToolRefusal(config, new(), new() { IsSpacePreparation = true }, call));
        call.ToolId = "git_worktree_create";
        Assert.Null(FullDuplexRunEngine.SpaceToolRefusal(config, new(), new() { IsSpacePreparation = true }, call));
    }

    [Fact]
    public void SpecEnforcesOrderedDocumentReviewAndBlocksImplementation()
    {
        var config = Configuration(new(SpecEnabled: true, MultiAgent: true));
        var checkpoint = new FullDuplexCheckpointV1();
        var task = new DurableTaskNode();
        WorkerToolTurn Proposal(string stage, string document) => new()
        { ToolId = "spec_propose", ArgumentsJson = JsonSerializer.Serialize(new { stage, document }) };
        Assert.NotNull(FullDuplexRunEngine.SpaceToolRefusal(config, checkpoint, task, Proposal("tasks", "- [ ] Write tests")));
        Assert.Null(FullDuplexRunEngine.SpaceToolRefusal(config, checkpoint, task, Proposal("requirements", "A requirement")));
        Assert.NotNull(FullDuplexRunEngine.SpaceToolRefusal(config, checkpoint, task, new() { ToolId = "write_file" }));
        Assert.NotNull(FullDuplexRunEngine.SpaceToolRefusal(config, checkpoint, task, new() { ToolId = "task_dispatch" }));
        foreach (var stage in new[] { "requirements", "design", "tasks" })
            checkpoint.SpaceSpecDocuments.Add(new(stage, stage, "hash", checkpoint.SpaceSpecDocuments.Count + 1, "execution"));
        Assert.Null(FullDuplexRunEngine.SpaceToolRefusal(config, checkpoint, task, new() { ToolId = "write_file" }));
        Assert.True(FullDuplexRunEngine.SpacePreparationReady(config, checkpoint));
    }

    [Fact]
    public void CollaborationOffNarrowsBothToolsAndSpawnAuthority()
    {
        RuntimeAgentDefinition root = new("meeting", "operation", "conversation", "on_demand",
            ["user.respond", "agent.create_temporary"], true, "full")
        { AllowedTools = ["read_file", "task_dispatch", "task_wait", "tina_chat_execute_intent"] };
        var narrowed = Assert.Single(SpaceCompositionPolicy.Narrow([root], new()));
        Assert.Equal(["read_file"], narrowed.AllowedTools);
        Assert.Equal(["user.respond"], narrowed.Capabilities);
        Assert.Empty(narrowed.AllowedDispatchTargets!);
    }
}
