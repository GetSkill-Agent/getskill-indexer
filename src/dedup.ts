import type { SkillRaw, SkillEntry } from "./types.ts";

// ── Slug normalization ──────────────────────────────────

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Source priority (lower = more canonical) ────────────

const SOURCE_PRIORITY: Record<string, number> = {
  "anthropics-skills": 1,
  community: 2,
  "awesome-claude-skills": 3,
  alirezarezvani: 3,
  "github-topic": 4,
  "skills-sh": 5,
  aitmpl: 5,
  "skill-seekers": 5,
};

// ── Heuristic quality score ─────────────────────────────

function computeQualityScore(skill: SkillRaw): number {
  let score = 0;

  // Has YAML frontmatter (we stored it in content parse)
  if (skill.content && skill.content.length > 100) score += 20;

  // Good description
  if (skill.description.length > 50) score += 15;

  // Has scripts
  if (skill.hasScripts) score += 15;

  // Multiple files
  if (skill.fileCount > 2) score += 10;

  // GitHub stars
  if (skill.stars && skill.stars > 100) score += 10;
  else if (skill.stars && skill.stars > 10) score += 5;

  // Recently updated (within 90 days)
  const daysSinceUpdate = (Date.now() - new Date(skill.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 30) score += 10;
  else if (daysSinceUpdate < 90) score += 5;

  return Math.min(score, 100);
}

// ── Simple category guess from name/description ─────────

function guessCategory(skill: SkillRaw): string {
  const text = `${skill.name} ${skill.description}`.toLowerCase();

  if (/pdf|docx?|xlsx?|pptx?|document|convert/.test(text)) return "document-processing";
  if (/web|html|css|react|vue|next|frontend|website/.test(text)) return "web-development";
  if (/design|ui|ux|figma|canvas|brand/.test(text)) return "design";
  if (/mcp|model.context|server|tool.use/.test(text)) return "mcp-tools";
  if (/code|refactor|debug|test|lint|git|commit/.test(text)) return "coding-assistance";
  if (/data|csv|sql|analys|chart|visual/.test(text)) return "data-analysis";
  if (/slack|email|messag|discord|telegram/.test(text)) return "communication";
  if (/deploy|ci|cd|docker|k8s|monitor|infra/.test(text)) return "devops";
  if (/research|search|rag|knowledge|scrape/.test(text)) return "research";

  return "other";
}

// ── Jaccard similarity for descriptions ─────────────────

function jaccard(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// ── Dedup and enrich ────────────────────────────────────

export function dedup(rawSkills: SkillRaw[]): SkillEntry[] {
  // Group by slug
  const slugMap = new Map<string, SkillRaw[]>();
  for (const skill of rawSkills) {
    const existing = slugMap.get(skill.slug) ?? [];
    existing.push(skill);
    slugMap.set(skill.slug, existing);
  }

  const entries: SkillEntry[] = [];
  const canonicalSlugs = new Set<string>();

  for (const [slug, group] of slugMap) {
    // Sort by source priority (lowest = most canonical)
    group.sort(
      (a, b) => (SOURCE_PRIORITY[a.source] ?? 99) - (SOURCE_PRIORITY[b.source] ?? 99),
    );

    const canonical = group[0]!;
    canonicalSlugs.add(slug);

    entries.push({
      ...canonical,
      category: guessCategory(canonical),
      tags: [],
      qualityScore: computeQualityScore(canonical),
      canonical: true,
    });

    // Mark duplicates
    for (let i = 1; i < group.length; i++) {
      entries.push({
        ...group[i]!,
        category: guessCategory(group[i]!),
        tags: [],
        qualityScore: computeQualityScore(group[i]!),
        canonical: false,
        duplicateOf: slug,
      });
    }
  }

  // Cross-slug similarity check for near-duplicates
  const canonicalEntries = entries.filter((e) => e.canonical);
  for (let i = 0; i < canonicalEntries.length; i++) {
    for (let j = i + 1; j < canonicalEntries.length; j++) {
      const a = canonicalEntries[i]!;
      const b = canonicalEntries[j]!;

      if (a.description && b.description && jaccard(a.description, b.description) > 0.8) {
        // Mark the lower-priority one as duplicate
        const aPriority = SOURCE_PRIORITY[a.source] ?? 99;
        const bPriority = SOURCE_PRIORITY[b.source] ?? 99;

        if (bPriority >= aPriority) {
          b.canonical = false;
          b.duplicateOf = a.slug;
        } else {
          a.canonical = false;
          a.duplicateOf = b.slug;
        }
      }
    }
  }

  return entries;
}
