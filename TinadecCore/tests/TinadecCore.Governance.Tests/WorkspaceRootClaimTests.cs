using TinadecCore.Abstractions.Ports;

namespace TinadecCore.Governance.Tests;

public sealed class WorkspaceRootClaimTests
{
    [Fact]
    public async Task TypedWorkspaceRootSurvivesScopeAndConcreteNormalization()
    {
        await using var harness = await GovernanceHarness.CreateAsync();
        const string resource = "workspace-root://root";
        var claim = new CapabilityClaim("resource.access", "read", resource);
        var subject = Guid.NewGuid();
        harness.Context.Boundaries = [new("workspace-root", [new("allow", "resource.access", "read", resource)])];

        // Grant normalization accepts a scope claim; permission requests normalize a concrete claim.
        var grant = await harness.Service.GrantCapabilityAsync(new(
            subject, null, claim, null, null, harness.Time.GetUtcNow().AddHours(1)));
        Assert.Equal(resource, grant.Claim.Resource);
        var resolution = await harness.Service.RequestPermissionAsync(Request(subject, claim));
        Assert.Equal(resource, resolution.Request.Claim.Resource);
        Assert.Equal(PermissionRequestStatuses.Granted, resolution.Request.Status);
        Assert.NotNull(resolution.Lease);
        Assert.Equal(resource, resolution.Lease.Claim.Resource);
    }

    [Theory]
    [InlineData("path://.")]
    [InlineData("path://../X")]
    public async Task PathTraversalStaysRejectedForScopeAndConcreteClaims(string resource)
    {
        await using var harness = await GovernanceHarness.CreateAsync();
        var subject = Guid.NewGuid();
        var claim = new CapabilityClaim("resource.access", "read", resource);
        var scope = await Assert.ThrowsAsync<ArgumentException>(() => harness.Service.GrantCapabilityAsync(new(
            subject, null, claim, null, null, harness.Time.GetUtcNow().AddHours(1))));
        var concrete = await Assert.ThrowsAsync<ArgumentException>(() => harness.Service.RequestPermissionAsync(Request(subject, claim)));
        Assert.Contains("traversal", scope.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("traversal", concrete.Message, StringComparison.OrdinalIgnoreCase);
    }

    private static PermissionRequestCommand Request(Guid subject, CapabilityClaim claim) => new(
        subject, null, null, claim, null, null, TimeSpan.FromMinutes(30), 1, "low", 0,
        "Read the exact admitted workspace root.", "typed-root:" + Guid.NewGuid().ToString("N"));
}
