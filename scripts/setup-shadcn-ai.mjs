import { setupAiWorkspace } from './setup-ai-workspace.mjs';

// The shared skill is checked in once; native discovery paths are local links.
// Fresh clones can initialize offline without fetching duplicate skill copies.
const result=setupAiWorkspace();
console.log(`[shadcn-ai] shared skills ready; ${result.bridges} local output/discovery paths linked`);
