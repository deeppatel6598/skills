# skills

A curated collection of Claude Code **skills**, assembled from three upstream
repositories and packaged as **three installable plugins** under one marketplace.
Each source is kept in its own folder with its original license preserved.

```
skills/
├── .claude-plugin/marketplace.json   # registers the 3 plugins
├── superpowers/    # plugin —  14 skills  (foundational agent workflow skills)
│   ├── .claude-plugin/plugin.json
│   └── skills/<14 skill dirs>
├── claude-mem/     # plugin —  16 skills  (memory project skills)
│   ├── .claude-plugin/plugin.json
│   └── skills/<16 skill dirs>
└── ecc/            # plugin — 221 skills  (engineering / agent library, curated)
    ├── .claude-plugin/plugin.json
    └── skills/<221 skill dirs>
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

## Installing

This repo is a Claude Code **plugin marketplace** with three plugins. Add the
marketplace once, then install whichever groups you want:

```text
/plugin marketplace add deeppatel6598/skills
/plugin install superpowers@deeppatel6598-skills
/plugin install ecc@deeppatel6598-skills
/plugin install claude-mem@deeppatel6598-skills
```

Install only the groups you need — `ecc` alone is 221 skills, and every
installed skill's `name`+`description` consumes context, so installing all three
at once is heavy. A skill activates automatically based on its `description` when
its trigger conditions are met.

### Manual alternative (single skill)

You can also copy one skill folder straight into your skills directory:

```bash
git clone https://github.com/deeppatel6598/skills
cp -R skills/ecc/skills/python-testing ~/.claude/skills/      # all projects
# or into a project:  cp -R skills/ecc/skills/python-testing <project>/.claude/skills/
```
