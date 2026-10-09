# Skills resources

`ToolSkillResourceService` owns the shared and project catalog exposed at `/api/v1/tools/skills`. It implements both `IToolSkillResourceService` for Desktop management and `IToolSkillCatalog` for run admission. Shared resources are scoped to the active Core tenant and workspace; project resources have deterministic IDs derived from that scope, the persistent project ID and the relative skill path.

The catalog and Context module use `WorkspaceSkillDiscovery` and `WorkspaceSkillPolicy`. Invalid, unreadable, disabled and shadowed resources keep diagnostic metadata. Inherited selection prefers a same-name project resource. Explicit resource lists select exact IDs and refuse missing, invalid, disabled or invisible IDs; an empty list provides no skills.

Shared skill packages are immutable content-addressed directories below Core `StoragePaths`; updates create a new package and retain old versions for admitted runs. Only the individual selected package root receives a read grant. Asset imports require safe relative paths and base64 bytes and enforce package budgets. Managed project changes use `IUserToolActionService` and `write_file` with the reviewed file hash; project assets and removal use governed project file tools. Shared imports and edits are queued as a `skill_resource_update` action and land only after human approval, carrying an `expected_package_digest` that is re-checked at write time; a refused approval is terminal and leaves no package directory.

All resource updates require revisions. Project content revisions fit the exact JavaScript integer range; provider file hashes remain the write precondition. Shared rows have optimistic concurrency and a unique live name per tenant/workspace. SQLite and PostgreSQL migrations are in the corresponding storage migration assemblies.

`MarketInstallService` uses the managed MCP resource registry whenever it is registered. Its reviewed proposal contains no credential values; the Core-only `mcp_resource_update` action applies a version precondition through the existing approval state machine. Legacy embedded hosts without the registry retain the file-config adapter.
