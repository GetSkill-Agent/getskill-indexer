import { listContents, getFileContent, getRepoInfo } from "../github.ts";
import { parseSkillMd } from "../parser.ts";
import type { RepoSourceConfig } from "../config.ts";
import type { SkillRaw, SkillSource } from "../types.ts";
import { toSlug } from "../dedup.ts";

/**
 * Scan a GitHub repo for SKILL.md files.
 * Supports two layouts:
 *   1. Flat: repo has SKILL.md at root → single skill
 *   2. Directory: repo has subdirs each containing SKILL.md → multiple skills
 */
export async function scanGitHubRepo(config: RepoSourceConfig): Promise<SkillRaw[]> {
  console.log(`[scan] Scanning ${config.repo}...`);
  const skills: SkillRaw[] = [];
  const now = new Date().toISOString();
  const sourceId = config.id as SkillSource;

  const repoInfo = await getRepoInfo(config.repo);

  // Check root for SKILL.md or skills/ directory
  const rootContents = await listContents(config.repo);
  if (!rootContents.length) {
    console.warn(`[scan] ${config.repo}: empty or inaccessible`);
    return [];
  }

  // Check if there's a top-level SKILL.md (single-skill repo)
  const rootSkillMd = rootContents.find(
    (f) => f.type === "file" && f.name.toUpperCase() === "SKILL.MD",
  );

  if (rootSkillMd) {
    const raw = await getFileContent(config.repo, rootSkillMd.path);
    if (raw) {
      const parsed = parseSkillMd(raw, config.name);
      if (parsed) {
        skills.push({
          name: parsed.name,
          slug: toSlug(parsed.name),
          description: parsed.description,
          source: sourceId,
          sourceUrl: `https://github.com/${config.repo}/blob/main/${rootSkillMd.path}`,
          repoUrl: `https://github.com/${config.repo}`,
          author: repoInfo?.owner.login,
          content: parsed.content,
          hasScripts: rootContents.some((f) => f.name === "scripts" && f.type === "dir"),
          fileCount: rootContents.filter((f) => f.type === "file").length,
          stars: repoInfo?.stargazers_count,
          license: repoInfo?.license?.spdx_id,
          updatedAt: repoInfo?.updated_at ?? now,
          scannedAt: now,
        });
      }
    }
  }

  // Check subdirectories for SKILL.md (multi-skill repo like anthropics/skills)
  const skillsDir = rootContents.find(
    (f) => f.type === "dir" && f.name.toLowerCase() === "skills",
  );
  const dirsToScan = skillsDir
    ? await listContents(config.repo, skillsDir.path)
    : rootContents.filter((f) => f.type === "dir" && !f.name.startsWith("."));

  // Only scan if we found a skills/ directory or if this is the official repo
  const shouldScanSubdirs = skillsDir || config.id === "anthropics-skills";
  if (!shouldScanSubdirs && rootSkillMd) {
    // Single-skill repo, already handled above
    return skills;
  }

  for (const dir of dirsToScan) {
    if (dir.type !== "dir") continue;
    if (dir.name.startsWith(".") || dir.name === "node_modules" || dir.name === "spec" || dir.name === "template") {
      continue;
    }

    const dirContents = await listContents(config.repo, dir.path);
    const skillMdFile = dirContents.find(
      (f) => f.type === "file" && f.name.toUpperCase() === "SKILL.MD",
    );

    if (!skillMdFile) continue;

    const raw = await getFileContent(config.repo, skillMdFile.path);
    if (!raw) continue;

    const parsed = parseSkillMd(raw, dir.name);
    if (!parsed) continue;

    skills.push({
      name: parsed.name,
      slug: toSlug(parsed.name),
      description: parsed.description,
      source: sourceId,
      sourceUrl: `https://github.com/${config.repo}/blob/main/${skillMdFile.path}`,
      repoUrl: `https://github.com/${config.repo}`,
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

  console.log(`[scan] ${config.repo}: found ${skills.length} skills`);
  return skills;
}
