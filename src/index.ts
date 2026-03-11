import { loadConfig } from "./config.ts";
import { scanGitHubRepo } from "./scrapers/github-repo.ts";
import { scanAwesomeList } from "./scrapers/github-awesome.ts";
import { scanGitHubTopic } from "./scrapers/github-topic.ts";
import { dedup } from "./dedup.ts";
import { writeIndex, writeCategoryIndex, writeChangelog, writeReadme } from "./output.ts";
import type { SkillRaw } from "./types.ts";

// ── Date helper ─────────────────────────────────────────

function getDateStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

// ── Stage 1: Scan all sources ───────────────────────────

async function scanAllSources(config: ReturnType<typeof loadConfig>): Promise<SkillRaw[]> {
  console.log("\n=== Stage 1: Scanning sources ===\n");
  const allSkills: SkillRaw[] = [];

  // 1a. GitHub repo sources (parallel)
  const repoResults = await Promise.all(
    config.sources.githubRepos.map((repo) => scanGitHubRepo(repo)),
  );
  for (const skills of repoResults) {
    allSkills.push(...skills);
  }

  // 1b. Awesome lists (parallel)
  const awesomeResults = await Promise.all(
    config.sources.awesomeLists.map((list) => scanAwesomeList(list)),
  );
  for (const skills of awesomeResults) {
    allSkills.push(...skills);
  }

  // 1c. GitHub topic search (exclude already-scanned repos)
  const excludeRepos = new Set(config.sources.githubRepos.map((r) => r.repo));
  const topicSkills = await scanGitHubTopic(config.sources.topicSearch, excludeRepos);
  allSkills.push(...topicSkills);

  console.log(`\n[scan] Total raw skills: ${allSkills.length}`);
  return allSkills;
}

// ── Stage 2: Parse & Normalize (already done in scrapers)

// ── Stage 3: Dedup & Score ──────────────────────────────

function dedupAndScore(rawSkills: SkillRaw[]) {
  console.log("\n=== Stage 3: Dedup & Score ===\n");
  const entries = dedup(rawSkills);
  const canonical = entries.filter((e) => e.canonical).length;
  console.log(`[dedup] ${rawSkills.length} raw → ${entries.length} entries (${canonical} canonical)`);
  return entries;
}

// ── Stage 4: Output ─────────────────────────────────────

function outputResults(entries: ReturnType<typeof dedup>, dateStr: string) {
  console.log("\n=== Stage 4: Output ===\n");
  writeChangelog(entries, dateStr);
  writeIndex(entries);
  writeCategoryIndex(entries);
  writeReadme(entries);
  console.log(`\n=== Done! ${entries.length} skills indexed ===\n`);
}

// ── Main ─────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("🔍 getskill-indexer starting...\n");

  const config = loadConfig();
  const dateStr = getDateStr();

  console.log(`Date: ${dateStr}`);
  console.log(`Repo sources: ${config.sources.githubRepos.map((r) => r.repo).join(", ")}`);
  console.log(`Awesome lists: ${config.sources.awesomeLists.map((r) => r.repo).join(", ")}`);
  console.log(`Topic search: ${config.sources.topicSearch.topic}`);

  // 4-stage pipeline
  const rawSkills = await scanAllSources(config);
  const entries = dedupAndScore(rawSkills);
  outputResults(entries, dateStr);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
