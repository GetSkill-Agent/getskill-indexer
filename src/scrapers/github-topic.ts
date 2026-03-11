import { searchByTopic, listContents, getFileContent } from "../github.ts";
import { parseSkillMd } from "../parser.ts";
import type { TopicSearchConfig } from "../config.ts";
import type { SkillRaw } from "../types.ts";
import { toSlug } from "../dedup.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Search GitHub for repos tagged with the skills topic,
 * then check each for SKILL.md files.
 */
export async function scanGitHubTopic(
  config: TopicSearchConfig,
  excludeRepos: Set<string>,
): Promise<SkillRaw[]> {
  console.log(`[scan] Searching GitHub topic: ${config.topic}...`);
  const now = new Date().toISOString();
  const skills: SkillRaw[] = [];

  const repos = await searchByTopic(config.topic, config.maxRepos);

  for (const repo of repos) {
    // Skip repos we already scan via githubRepos config
    if (excludeRepos.has(repo.full_name)) {
      continue;
    }

    if (config.checkForSkillMd) {
      // Small delay to avoid abuse detection
      await sleep(500);

      // Check for SKILL.md at root
      const rootContents = await listContents(repo.full_name);
      const skillMdFile = rootContents.find(
        (f) => f.type === "file" && f.name.toUpperCase() === "SKILL.MD",
      );

      if (skillMdFile) {
        const raw = await getFileContent(repo.full_name, skillMdFile.path);
        if (raw) {
          const parsed = parseSkillMd(raw, repo.full_name.split("/")[1]);
          if (parsed) {
            skills.push({
              name: parsed.name,
              slug: toSlug(parsed.name),
              description: parsed.description,
              source: "github-topic",
              sourceUrl: `https://github.com/${repo.full_name}/blob/main/${skillMdFile.path}`,
              repoUrl: repo.html_url,
              author: repo.owner.login,
              content: parsed.content,
              hasScripts: rootContents.some((f) => f.name === "scripts" && f.type === "dir"),
              fileCount: rootContents.filter((f) => f.type === "file").length,
              stars: repo.stargazers_count,
              updatedAt: repo.updated_at,
              scannedAt: now,
            });
            continue;
          }
        }
      }

      // Check skills/ subdirectory
      const skillsDir = rootContents.find(
        (f) => f.type === "dir" && f.name.toLowerCase() === "skills",
      );
      if (skillsDir) {
        const subDirs = await listContents(repo.full_name, skillsDir.path);
        for (const dir of subDirs) {
          if (dir.type !== "dir") continue;
          const dirContents = await listContents(repo.full_name, dir.path);
          const md = dirContents.find(
            (f) => f.type === "file" && f.name.toUpperCase() === "SKILL.MD",
          );
          if (!md) continue;

          const raw = await getFileContent(repo.full_name, md.path);
          if (!raw) continue;
          const parsed = parseSkillMd(raw, dir.name);
          if (!parsed) continue;

          skills.push({
            name: parsed.name,
            slug: toSlug(parsed.name),
            description: parsed.description,
            source: "github-topic",
            sourceUrl: `https://github.com/${repo.full_name}/blob/main/${md.path}`,
            repoUrl: repo.html_url,
            author: repo.owner.login,
            content: parsed.content,
            hasScripts: dirContents.some((f) => f.name === "scripts" && f.type === "dir"),
            fileCount: dirContents.filter((f) => f.type === "file").length,
            stars: repo.stargazers_count,
            updatedAt: repo.updated_at,
            scannedAt: now,
          });
        }
      }
    } else {
      // No SKILL.md check — just index the repo as a skill
      skills.push({
        name: repo.full_name.split("/")[1] ?? repo.full_name,
        slug: toSlug(repo.full_name.split("/")[1] ?? repo.full_name),
        description: repo.description ?? "",
        source: "github-topic",
        sourceUrl: repo.html_url,
        repoUrl: repo.html_url,
        author: repo.owner.login,
        hasScripts: false,
        fileCount: 0,
        stars: repo.stargazers_count,
        updatedAt: repo.updated_at,
        scannedAt: now,
      });
    }
  }

  console.log(`[scan] Topic "${config.topic}": found ${skills.length} skills`);
  return skills;
}
