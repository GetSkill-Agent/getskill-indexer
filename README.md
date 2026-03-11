# getskill-indexer

Automated indexing system that aggregates Claude Code skills from 10+ scattered sources into a unified, searchable registry.

```
Sources (10+)          Pipeline              Output
┌──────────────┐
│ anthropics/  │──┐
│ skills       │  │    ┌─────────┐    ┌──────────┐    ┌─────────────┐
├──────────────┤  ├──▶│  Scan   │──▶│  Dedup   │──▶│ index.json  │
│ awesome-     │  │    │ (fetch) │    │ & Score  │    │ categories  │
│ claude-skills│──┤    └─────────┘    └──────────┘    │ changelog   │
├──────────────┤  │                                    │ scan-report │
│ GitHub Topic │──┤                                    └─────────────┘
│ Search       │  │
├──────────────┤  │
│ skills.sh    │──┤
├──────────────┤  │
│ aitmpl.com   │──┤
├──────────────┤  │
│ Extra Repos  │──┘
└──────────────┘
```

## Monitored Sources

### Tier 1 — GitHub Repos (SKILL.md scan)

| Source | URL | Strategy | Priority |
|--------|-----|----------|----------|
| **Anthropic Official Skills** | [anthropics/skills](https://github.com/anthropics/skills) | Contents API → recursive SKILL.md parse | 1 (canonical) |
| **Claude Skills Collection** | [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | Contents API → SKILL.md + scripts/ | 3 |
| **GetSkill Community** | [GetSkill-Agent/getskill-skills](https://github.com/GetSkill-Agent/getskill-skills) | Contents API → SKILL.md parse | 2 |

### Tier 2 — Awesome Lists (markdown parse)

| Source | URL | Strategy |
|--------|-----|----------|
| **Awesome Claude Skills** | [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) | README.md → regex parse `[Name](url) - desc` entries |

### Tier 3 — GitHub Topic Discovery

| Source | URL | Strategy |
|--------|-----|----------|
| **Topic: claude-skills** | [github.com/topics/claude-skills](https://github.com/topics/claude-skills) | Search API → check each repo for SKILL.md → parse |

Discovers new skill repos automatically as they get tagged on GitHub.

### Tier 4 — Web Scrapers (DOM, no API)

| Source | URL | Strategy | Note |
|--------|-----|----------|------|
| **Skills.sh** | [skills.sh](https://skills.sh) | HTTP fetch → cheerio DOM parse | 87K+ skills directory, trending/all-time |
| **AITMPL** | [aitmpl.com/skills](https://www.aitmpl.com/skills) | HTTP fetch → cheerio DOM parse | Claude Code template marketplace |

These sites have no public API. DOM structure may change — scrapers include graceful fallback.

### Tier 5 — Extra GitHub Repos

| Source | URL | Note |
|--------|-----|------|
| **Skill Seekers** | [yusufkaraaslan/Skill_Seekers](https://github.com/yusufkaraaslan/Skill_Seekers) | Document→skill preprocessor, 16+ export formats |
| **Planning with Files** | [OthmanAdi/planning-with-files](https://github.com/OthmanAdi/planning-with-files) | Persistent markdown planning system skill |
| **Anthropic Courses** | [anthropics/courses](https://github.com/anthropics/courses) | Official education materials |

### Watchlist (not yet scraped)

| Source | URL | Status | Note |
|--------|-----|--------|------|
| **Skills Marketplace** | [skillsmp.com](https://skillsmp.com) | Blocked (403) | Monitoring for availability |
| **mem9.ai** | [mem9.ai](https://mem9.ai) | Watching | AI agent memory infra, may list skills in future |

## Output

All output lives in `data/`:

| File | Description |
|------|-------------|
| `index.json` | Complete unified index — all skills with metadata, scores, dedup status |
| `index-by-category.json` | Canonical skills grouped by category |
| `changelog/YYYY-MM-DD.json` | Diff from previous scan (added/removed skills) |
| `scan-report.md` | Per-source results, timing, error tracking |

### Skill Schema

Each skill in `index.json`:

```json
{
  "name": "pdf",
  "slug": "pdf",
  "description": "Use this skill for PDF files...",
  "source": "anthropics-skills",
  "sourceUrl": "https://github.com/anthropics/skills/blob/main/skills/pdf/SKILL.md",
  "repoUrl": "https://github.com/anthropics/skills",
  "author": "anthropics",
  "stars": 90422,
  "category": "document-processing",
  "qualityScore": 80,
  "canonical": true
}
```

### Dedup Strategy

Skills appear in multiple sources. Dedup works by:

1. **Slug normalization** — `name` → lowercase kebab-case
2. **Same-source dedup** — composite key: `slug + sourceUrl`
3. **Cross-source dedup** — same slug across sources → pick canonical by priority
4. **Similarity check** — Jaccard similarity > 0.8 on descriptions → mark duplicate

Priority order: Anthropic Official > GetSkill Community > Awesome Lists > Topic Search > Web Scrapers

### Quality Score (0–100)

Heuristic scoring without LLM:

| Signal | Points |
|--------|--------|
| Content > 100 chars | +20 |
| Description > 50 chars | +15 |
| Has `scripts/` directory | +15 |
| Multiple files (>2) | +10 |
| GitHub stars > 100 | +10 |
| Updated within 30 days | +10 |
| Updated within 90 days | +5 |

## Usage

```bash
# Install
pnpm install

# Run indexer locally
pnpm start

# With GitHub token (recommended — 5000 req/hr vs 60)
GITHUB_TOKEN=ghp_xxx pnpm start

# Type check
pnpm typecheck
```

## Architecture

```
src/
├── index.ts                 # 4-stage pipeline entry point
├── config.ts                # YAML config loader + types
├── github.ts                # GitHub API (rate limit retry, content fetch)
├── parser.ts                # SKILL.md frontmatter + awesome-list parser
├── dedup.ts                 # Slug normalization, scoring, dedup
├── types.ts                 # SkillRaw, SkillEntry, SkillIndex
├── output.ts                # Write index/categories/changelog/report
└── scrapers/
    ├── github-repo.ts       # Tier 1: Scan repo SKILL.md files
    ├── github-awesome.ts    # Tier 2: Parse awesome-list markdown
    ├── github-topic.ts      # Tier 3: Topic search + SKILL.md check
    ├── skills-sh.ts         # Tier 4: skills.sh DOM scraper
    ├── aitmpl.ts            # Tier 4: aitmpl.com DOM scraper
    └── github-extra.ts      # Tier 5: Extra repos (Skill Seekers, etc.)
```

### Pipeline

```
Stage 1: Scan    — All 6 scraper types run (parallel where possible)
Stage 2: Parse   — SKILL.md YAML frontmatter / markdown / DOM → SkillRaw[]
Stage 3: Dedup   — Slug dedup + Jaccard similarity + heuristic quality score
Stage 4: Output  — index.json + categories + changelog + scan report
```

### Rate Limit Handling

- GitHub API: auto-retry on 429/403 with `Retry-After` header
- Topic search: 500ms delay between repo checks to avoid abuse detection
- DOM scrapers: 15s timeout, graceful fallback on failure

## Automation

GitHub Actions runs weekly (Monday 10:00 CST):

```yaml
on:
  schedule:
    - cron: "0 2 * * 1"
  workflow_dispatch:       # manual trigger
```

## Cost

| Item | Monthly Cost |
|------|-------------|
| GitHub Actions | ~8 min → **Free** (2000 min/month) |
| GitHub API | ~400 req → **Free** (5000/hr with token) |
| HTTP scraping | ~20 req → **Free** |
| **Total** | **$0/month** |

## Configuration

Edit `config/sources.yaml` to add/remove sources — no code changes needed for new GitHub repos or awesome lists.

## License

MIT
