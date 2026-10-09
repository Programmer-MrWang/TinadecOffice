import { describe, expect, it } from 'vitest'
import { skillNameFromDocument, validateSkillPackagePaths } from './skillPackage'

describe('skill package import helpers', () => {
  it('uses the SKILL.md frontmatter name instead of a directory name', () => {
    expect(skillNameFromDocument("---\nname: 'release-helper'\ndescription: x\n---\n# Release")).toBe('release-helper')
    expect(skillNameFromDocument('---\nname: release-helper\n---\n')).toBe('release-helper')
  })

  it('rejects traversal, absolute, duplicate and empty package paths', () => {
    expect(() => validateSkillPackagePaths(['SKILL.md', '../secret'])).toThrow()
    expect(() => validateSkillPackagePaths(['SKILL.md', '/absolute'])).toThrow()
    expect(() => validateSkillPackagePaths(['SKILL.md', 'References/A', 'references/a'])).toThrow()
  })
})
