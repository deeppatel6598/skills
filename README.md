# skills

A curated collection of Claude Code / agent **skills**, assembled from three
upstream repositories. Each source is kept in its own folder with its original
structure and license preserved.

```
skills/
├── superpowers/   # 14 skills  — foundational agent workflow skills
├── claude-mem/    # 16 skills  — memory plugin skills
└── ecc/           # 221 skills — broad engineering / agent skill library (curated)
```

**251 skills total.**

Every skill is a directory containing a `SKILL.md` (with `name` + `description`
frontmatter) and any supporting `references/`, `agents/`, or scripts.

## Sources

| Folder | Upstream | What it is |
|--------|----------|------------|
| `superpowers/` | `superpowers` | Jesse Vincent's "Superpowers" — core workflow skills: brainstorming, TDD, systematic debugging, writing/executing plans, code review, git worktrees, verification. |
| `claude-mem/` | `claude-mem` | Skills shipped with the claude-mem memory plugin: memory search, timeline/standup/digest reports, codebase learning, planning. |
| `ecc/` | `ECC` | A large engineering + agent skill library spanning languages, frameworks, testing, frontend, devops, agent harnesses, research, and content. |

Licenses are retained per folder (`<folder>/LICENSE`). All credit for the skills
belongs to their original authors.

## Curation

The `ecc/` folder was curated for signal: the upstream `.agents/skills/` mirror
was de-duplicated against the canonical `skills/`, one superseded skill was
dropped, and ~40 hyper-specific industry verticals were removed. See
[`CURATION.md`](CURATION.md) for the complete list and how to restore any of them.

`superpowers/` and `claude-mem/` are included in full (only byte-identical
duplicates were dropped).

## Using a skill

These are standard Claude Code skills. To use one, point your skills directory at
it — e.g. copy a skill folder into `~/.claude/skills/`:

```bash
cp -R ecc/python-testing ~/.claude/skills/
```

or reference this repo from a plugin's `skills` source. The skill activates based
on its `description` frontmatter when its trigger conditions are met.
