import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

// ── Types ────────────────────────────────────────────────

export interface RepoSourceConfig {
  id: string;
  repo: string; // owner/repo
  name: string;
  priority: number;
}

export interface AwesomeListConfig {
  id: string;
  repo: string;
  name: string;
  file: string;
}

export interface TopicSearchConfig {
  topic: string;
  maxRepos: number;
  checkForSkillMd: boolean;
}

export interface IndexerConfig {
  sources: {
    githubRepos: RepoSourceConfig[];
    awesomeLists: AwesomeListConfig[];
    topicSearch: TopicSearchConfig;
  };
  categories: string[];
}

// ── Loader ───────────────────────────────────────────────

export function loadConfig(configPath?: string): IndexerConfig {
  const file = configPath ?? path.join(process.cwd(), "config", "sources.yaml");
  const raw = fs.readFileSync(file, "utf-8");
  const parsed = parseYaml(raw) as IndexerConfig;

  // Validate
  for (const repo of parsed.sources.githubRepos) {
    if (!repo.repo.includes("/")) {
      throw new Error(`Invalid repo format (need owner/repo): ${repo.repo}`);
    }
  }

  return parsed;
}
