import { getFileContent, getRepoInfo } from "../github.ts";
import { parseAwesomeList } from "../parser.ts";
import type { AwesomeListConfig } from "../config.ts";
import type { SkillRaw, SkillSource } from "../types.ts";
import { toSlug } from "../dedup.ts";

/**
 * Scan an awesome-list repo (markdown README) for skill entries.
 */
export async function scanAwesomeList(config: AwesomeListConfig): Promise<SkillRaw[]> {
  console.log(`[scan] Scanning awesome list ${config.repo}...`);
  const now = new Date().toISOString();
  const sourceId = config.id as SkillSource;

  const content = await getFileContent(config.repo, config.file);
  if (!content) {
    console.warn(`[scan] ${config.repo}: could not fetch ${config.file}`);
    return [];
  }

  const repoInfo = await getRepoInfo(config.repo);
  const entries = parseAwesomeList(content);

  const skills: SkillRaw[] = entries.map((entry) => ({
    name: entry.name,
    slug: toSlug(entry.name),
    description: entry.description,
    source: sourceId,
    sourceUrl: entry.url,
    repoUrl: entry.url.includes("github.com") ? entry.url : undefined,
    author: entry.author,
    content: undefined,
    hasScripts: false,
    fileCount: 0,
    stars: repoInfo?.stargazers_count,
    updatedAt: repoInfo?.updated_at ?? now,
    scannedAt: now,
  }));

  console.log(`[scan] ${config.repo}: found ${skills.length} entries`);
  return skills;
}
