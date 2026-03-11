// ── Unified Skill Types ──────────────────────────────────

export type SkillSource =
  | "anthropics-skills"
  | "awesome-claude-skills"
  | "alirezarezvani"
  | "github-topic"
  | "skills-sh"
  | "aitmpl"
  | "skill-seekers"
  | "community";

export interface SkillRaw {
  name: string;
  slug: string;
  description: string;
  source: SkillSource;
  sourceUrl: string;
  repoUrl?: string;
  author?: string;
  content?: string;
  hasScripts: boolean;
  fileCount: number;
  stars?: number;
  license?: string;
  updatedAt: string;
  scannedAt: string;
}

export interface SkillEntry extends SkillRaw {
  category: string;
  tags: string[];
  qualityScore: number;
  canonical: boolean;
  duplicateOf?: string;
}

export interface SkillIndex {
  version: string;
  generatedAt: string;
  totalSkills: number;
  totalCanonical: number;
  sources: Record<string, number>;
  skills: SkillEntry[];
}
