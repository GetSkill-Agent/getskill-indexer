import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

// ── Types ────────────────────────────────────────────────

export interface RepoSourceConfig {
  id: string;
  repo: string; // owner/repo
  name: string;
  url: string;
  priority: number;
}

export interface AwesomeListConfig {
  id: string;
  repo: string;
  name: string;
  url: string;
  file: string;
}

export interface TopicSearchConfig {
  topic: string;
  url: string;
  maxRepos: number;
  checkForSkillMd: boolean;
}

export interface WebScraperConfig {
  id: string;
  name: string;
  url: string;
  note?: string;
}

export interface ExtraRepoConfig {
  id: string;
  repo: string;
  name: string;
  url: string;
  note?: string;
}

export interface WatchlistEntry {
  id: string;
  name: string;
  url: string;
  status: string;
  note?: string;
}

export interface IndexerConfig {
  sources: {
    githubRepos: RepoSourceConfig[];
    awesomeLists: AwesomeListConfig[];
    topicSearch: TopicSearchConfig;
    webScrapers: WebScraperConfig[];
    extraRepos: ExtraRepoConfig[];
    watchlist: WatchlistEntry[];
  };
  categories: string[];
}

// ── Loader ───────────────────────────────────────────────

export function loadConfig(configPath?: string): IndexerConfig {
  const file = configPath ?? path.join(process.cwd(), "config", "sources.yaml");
  const raw = fs.readFileSync(file, "utf-8");
  const parsed = parseYaml(raw) as IndexerConfig;

  // Validate repos
  for (const repo of parsed.sources.githubRepos) {
    if (!repo.repo.includes("/")) {
      throw new Error(`Invalid repo format (need owner/repo): ${repo.repo}`);
    }
  }

  // Defaults
  parsed.sources.webScrapers ??= [];
  parsed.sources.extraRepos ??= [];
  parsed.sources.watchlist ??= [];

  return parsed;
}
