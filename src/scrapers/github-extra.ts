import { getFileContent, getRepoInfo, listContents } from "../github.ts";
import { parseSkillMd, parseAwesomeList } from "../parser.ts";
import type { SkillRaw } from "../types.ts";
import { toSlug } from "../dedup.ts";

/**
 * Scan additional individual GitHub repos that don't fit the standard patterns.
 * Each has its own extraction logic.
 */

interface ExtraRepoConfig {
  repo: string;
  sourceId: string;
  scanner: (repo: string, now: string) => Promise<SkillRaw[]>;
}

// ── Skill Seekers ───────────────────────────────────────
// Document→skill preprocessor with 16+ export formats.
// The repo itself is a meta-skill; scan its examples/ or skills/ if any.

async function scanSkillSeekers(repo: string, now: string): Promise<SkillRaw[]> {
  const skills: SkillRaw[] = [];
  const repoInfo = await getRepoInfo(repo);

  // Try SKILL.md first, then README.md for description
  const content = await getFileContent(repo, "SKILL.md");
  const readme = content ? null : await getFileContent(repo, "README.md");
  const source = content ?? readme;

  if (source) {
    const parsed = parseSkillMd(source, "Skill Seekers");
    if (parsed) {
      skills.push({
        name: parsed.name || "Skill Seekers",
        slug: toSlug(parsed.name || "skill-seekers"),
        description: parsed.description || repoInfo?.description || "Document-to-skill preprocessor with 16+ export formats",
        source: "skill-seekers",
        sourceUrl: `https://github.com/${repo}`,
        repoUrl: `https://github.com/${repo}`,
        author: repoInfo?.owner.login,
        content: parsed.content,
        hasScripts: true,
        fileCount: 5,
        stars: repoInfo?.stargazers_count,
        license: repoInfo?.license?.spdx_id,
        updatedAt: repoInfo?.updated_at ?? now,
        scannedAt: now,
      });
    }
  } else if (repoInfo) {
    // Fallback: use repo metadata
    skills.push({
      name: "Skill Seekers",
      slug: "skill-seekers",
      description: repoInfo.description || "Document-to-skill preprocessor with 16+ export formats",
      source: "skill-seekers",
      sourceUrl: `https://github.com/${repo}`,
      repoUrl: `https://github.com/${repo}`,
      author: repoInfo.owner.login,
      hasScripts: true,
      fileCount: 5,
      stars: repoInfo.stargazers_count,
      license: repoInfo.license?.spdx_id,
      updatedAt: repoInfo.updated_at ?? now,
      scannedAt: now,
    });
  }

  return skills;
}

// ── Planning with Files ─────────────────────────────────
// Claude Code skill for persistent markdown planning system.

async function scanPlanningWithFiles(repo: string, now: string): Promise<SkillRaw[]> {
  const skills: SkillRaw[] = [];
  const repoInfo = await getRepoInfo(repo);

  const content = await getFileContent(repo, "SKILL.md");
  const readme = content ? null : await getFileContent(repo, "README.md");
  const source = content ?? readme;

  if (source) {
    const parsed = parseSkillMd(source, "Planning with Files");
    if (parsed) {
      skills.push({
        name: parsed.name || "Planning with Files",
        slug: toSlug(parsed.name || "planning-with-files"),
        description: parsed.description || repoInfo?.description || "Persistent markdown planning system for Claude Code",
        source: "github-topic",
        sourceUrl: `https://github.com/${repo}`,
        repoUrl: `https://github.com/${repo}`,
        author: repoInfo?.owner.login,
        content: parsed.content,
        hasScripts: false,
        fileCount: 3,
        stars: repoInfo?.stargazers_count,
        license: repoInfo?.license?.spdx_id,
        updatedAt: repoInfo?.updated_at ?? now,
        scannedAt: now,
      });
    }
  } else if (repoInfo) {
    skills.push({
      name: "Planning with Files",
      slug: "planning-with-files",
      description: repoInfo.description || "Persistent markdown planning system for Claude Code",
      source: "github-topic",
      sourceUrl: `https://github.com/${repo}`,
      repoUrl: `https://github.com/${repo}`,
      author: repoInfo.owner.login,
      hasScripts: false,
      fileCount: 3,
      stars: repoInfo.stargazers_count,
      license: repoInfo.license?.spdx_id,
      updatedAt: repoInfo.updated_at ?? now,
      scannedAt: now,
    });
  }

  return skills;
}

// ── VoltAgent awesome-agent-skills (500+ skills) ────────
// Large collection repo with skills/ subdirectories.

async function scanLargeSkillsRepo(repo: string, now: string): Promise<SkillRaw[]> {
  const skills: SkillRaw[] = [];
  const repoInfo = await getRepoInfo(repo);

  // Check root for skills/ directory
  const rootContents = await listContents(repo);
  const skillsDir = rootContents.find(
    (f) => f.type === "dir" && f.name.toLowerCase() === "skills",
  );

  const dirsToScan = skillsDir
    ? await listContents(repo, skillsDir.path)
    : rootContents.filter((f) => f.type === "dir" && !f.name.startsWith("."));

  for (const dir of dirsToScan) {
    if (dir.type !== "dir") continue;
    if (dir.name.startsWith(".") || dir.name === "node_modules") continue;

    const dirContents = await listContents(repo, dir.path);
    const skillMdFile = dirContents.find(
      (f) => f.type === "file" && f.name.toUpperCase() === "SKILL.MD",
    );
    if (!skillMdFile) continue;

    const raw = await getFileContent(repo, skillMdFile.path);
    if (!raw) continue;
    const parsed = parseSkillMd(raw, dir.name);
    if (!parsed) continue;

    skills.push({
      name: parsed.name,
      slug: toSlug(parsed.name),
      description: parsed.description,
      source: "github-topic",
      sourceUrl: `https://github.com/${repo}/blob/main/${skillMdFile.path}`,
      repoUrl: `https://github.com/${repo}`,
      author: repoInfo?.owner.login,
      content: parsed.content,
      hasScripts: dirContents.some((f) => f.name === "scripts" && f.type === "dir"),
      fileCount: dirContents.filter((f) => f.type === "file").length,
      stars: repoInfo?.stargazers_count,
      license: repoInfo?.license?.spdx_id,
      updatedAt: repoInfo?.updated_at ?? now,
      scannedAt: now,
    });
  }

  // Also check README for awesome-list style entries
  const readme = await getFileContent(repo, "README.md");
  if (readme && skills.length === 0) {
    const entries = parseAwesomeList(readme);
    for (const entry of entries) {
      skills.push({
        name: entry.name,
        slug: toSlug(entry.name),
        description: entry.description,
        source: "github-topic",
        sourceUrl: entry.url,
        repoUrl: entry.url.includes("github.com") ? entry.url : `https://github.com/${repo}`,
        author: entry.author ?? repoInfo?.owner.login,
        hasScripts: false,
        fileCount: 0,
        stars: repoInfo?.stargazers_count,
        updatedAt: repoInfo?.updated_at ?? now,
        scannedAt: now,
      });
    }
  }

  return skills;
}

// ── Registry ────────────────────────────────────────────

const EXTRA_REPOS: ExtraRepoConfig[] = [
  {
    repo: "yusufkaraaslan/Skill_Seekers",
    sourceId: "skill-seekers",
    scanner: scanSkillSeekers,
  },
  {
    repo: "OthmanAdi/planning-with-files",
    sourceId: "github-topic",
    scanner: scanPlanningWithFiles,
  },
  {
    repo: "anthropics/courses",
    sourceId: "github-topic",
    scanner: scanLargeSkillsRepo,
  },
];

export async function scanExtraRepos(): Promise<SkillRaw[]> {
  console.log(`[scan] Scanning ${EXTRA_REPOS.length} extra repos...`);
  const now = new Date().toISOString();
  const allSkills: SkillRaw[] = [];

  for (const config of EXTRA_REPOS) {
    try {
      const skills = await config.scanner(config.repo, now);
      allSkills.push(...skills);
      console.log(`[scan] ${config.repo}: found ${skills.length} skills`);
    } catch (e) {
      console.warn(`[scan] ${config.repo}: failed —`, e instanceof Error ? e.message : e);
    }
  }

  return allSkills;
}
