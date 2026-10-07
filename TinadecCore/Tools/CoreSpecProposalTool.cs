using System.Text.Json;
using TinadecCore.Abstractions.Ports;
using TinadecCore.Contracts.Dtos;

namespace TinadecCore.Tools;

/// <summary>A document confirmation, deliberately distinct from permission to modify files.</summary>
internal static class CoreSpecProposalTool
{
    internal static string? Validate(JsonElement? parameters)
    {
        if (parameters is not { ValueKind: JsonValueKind.Object } args
            || args.EnumerateObject().Any(property => property.Name is not ("stage" or "document"))
            || !args.TryGetProperty("stage", out var stage) || stage.ValueKind != JsonValueKind.String
            || stage.GetString() is not ("requirements" or "design" or "tasks")
            || !args.TryGetProperty("document", out var document) || document.ValueKind != JsonValueKind.String)
            return "A specification proposal contains a supported stage and its complete document.";
        return ApprovalEvidenceProjector.SpecificationArguments(stage.GetString()!, document.GetString()!) is not null ? null
            : "The entire document must fit the review: at most 3000 characters, and at most 3584 characters for its serialized stage/document JSON.";
    }

    internal static ToolManifestEntryDto ManifestEntry() => new()
    {
        Id = CoreVirtualToolPolicy.SpecProposeToolId,
        Description = "Submit the complete requirements, design, or tasks specification for the user's confirmation, in that order. Keep each document within 3000 characters so the review displays the entire content. The call waits for a human decision, including in full-access mode. After approval the immutable document is recorded in the run. Do not start implementation until all three documents are approved. Rejected proposals can be revised and submitted again.",
        InputSchema = JsonDocument.Parse("""
            {"type":"object","properties":{"stage":{"type":"string","enum":["requirements","design","tasks"]},"document":{"type":"string","maxLength":3000,"description":"Complete Markdown document, at most 3000 characters. The full stage/document JSON must fit 3584 review characters; oversized content is refused, never truncated."}},"required":["stage","document"],"additionalProperties":false}
            """).RootElement.Clone(),
        RequiresApproval = true,
        MutatesWorkspace = false,
        Risk = "low",
        RetrySafety = "safe",
        ConfirmationFields = [],
    };
}
