import { loadConfig } from "./config.ts";
import { scanGitHubRepo } from "./scrapers/github-repo.ts";
import { scanAwesomeList } from "./scrapers/github-awesome.ts";
import { scanGitHubTopic } from "./scrapers/github-topic.ts";
import { scanSkillsSh } from "./scrapers/skills-sh.ts";
import { scanAitmpl } from "./scrapers/aitmpl.ts";
import { scanExtraRepos } from "./scrapers/github-extra.ts";
import { dedup } from "./dedup.ts";
import { writeIndex, writeCategoryIndex, writeChangelog, writeScanReport } from "./output.ts";
import type { SkillRaw } from "./types.ts";

// ── Date helper ─────────────────────────────────────────

function getDateStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

// ── Scan result tracking ────────────────────────────────

export interface ScanResult {
  sourceId: string;
  sourceName: string;
  count: number;
  durationMs: number;
  error?: string;
}

// ── Stage 1: Scan all sources ───────────────────────────

async function scanAllSources(config: ReturnType<typeof loadConfig>): Promise<{
  skills: SkillRaw[];
  results: ScanResult[];
}> {
  console.log("\n=== Stage 1: Scanning sources ===\n");
  const allSkills: SkillRaw[] = [];
  const results: ScanResult[] = [];

  async function track(sourceId: string, sourceName: string, fn: () => Promise<SkillRaw[]>): Promise<SkillRaw[]> {
    const start = Date.now();
    try {
      const skills = await fn();
      results.push({ sourceId, sourceName, count: skills.length, durationMs: Date.now() - start });
      return skills;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[scan] ${sourceName}: FAILED — ${msg}`);
      results.push({ sourceId, sourceName, count: 0, durationMs: Date.now() - start, error: msg });
      return [];
    }
  }

  // Tier 1: GitHub repo sources (parallel)
  const repoResults = await Promise.all(
    config.sources.githubRepos.map((repo) =>
      track(repo.id, repo.name, () => scanGitHubRepo(repo)),
    ),
  );
  for (const skills of repoResults) allSkills.push(...skills);

  // Tier 2: Awesome lists (parallel)
  const awesomeResults = await Promise.all(
    config.sources.awesomeLists.map((list) =>
      track(list.id, list.name, () => scanAwesomeList(list)),
    ),
  );
  for (const skills of awesomeResults) allSkills.push(...skills);

  // Tier 3: GitHub topic search
  const excludeRepos = new Set(config.sources.githubRepos.map((r) => r.repo));
  const topicSkills = await track(
    "github-topic",
    `GitHub Topic: ${config.sources.topicSearch.topic}`,
    () => scanGitHubTopic(config.sources.topicSearch, excludeRepos),
  );
  allSkills.push(...topicSkills);

  // Tier 4: DOM scrapers (parallel)
  const [skillsShResult, aitmplResult] = await Promise.all([
    track("skills-sh", "Skills.sh", scanSkillsSh),
    track("aitmpl", "AITMPL", scanAitmpl),
  ]);
  allSkills.push(...skillsShResult, ...aitmplResult);

  // Tier 5: Extra repos
  const extraSkills = await track("extra-repos", "Extra Repos", scanExtraRepos);
  allSkills.push(...extraSkills);

  console.log(`\n[scan] Total raw skills: ${allSkills.length}`);
  return { skills: allSkills, results };
}

// ── Stage 2: Parse & Normalize (done in scrapers) ───────

// ── Stage 3: Dedup & Score ──────────────────────────────

function dedupAndScore(rawSkills: SkillRaw[]) {
  console.log("\n=== Stage 3: Dedup & Score ===\n");
  const entries = dedup(rawSkills);
  const canonical = entries.filter((e) => e.canonical).length;
  console.log(`[dedup] ${rawSkills.length} raw → ${entries.length} entries (${canonical} canonical)`);
  return entries;
}

// ── Stage 4: Output ─────────────────────────────────────

function outputResults(
  entries: ReturnType<typeof dedup>,
  scanResults: ScanResult[],
  dateStr: string,
) {
  console.log("\n=== Stage 4: Output ===\n");
  writeChangelog(entries, dateStr);
  writeIndex(entries);
  writeCategoryIndex(entries);
  writeScanReport(entries, scanResults, dateStr);
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
  console.log(`Web scrapers: skills.sh, aitmpl.com`);
  console.log(`Extra repos: ${config.sources.extraRepos.length}`);

  // 4-stage pipeline
  const { skills: rawSkills, results: scanResults } = await scanAllSources(config);
  const entries = dedupAndScore(rawSkills);
  outputResults(entries, scanResults, dateStr);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
