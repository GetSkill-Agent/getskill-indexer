import fs from "node:fs";
import path from "node:path";
import type { SkillEntry, SkillIndex } from "./types.ts";
import type { ScanResult } from "./index.ts";

const DATA_DIR = path.join(process.cwd(), "data");

// ── Write index.json ────────────────────────────────────

export function writeIndex(skills: SkillEntry[]): void {
  const now = new Date().toISOString();

  const sources: Record<string, number> = {};
  for (const s of skills) {
    sources[s.source] = (sources[s.source] ?? 0) + 1;
  }

  const index: SkillIndex = {
    version: "1.0.0",
    generatedAt: now,
    totalSkills: skills.length,
    totalCanonical: skills.filter((s) => s.canonical).length,
    sources,
    skills: skills.sort((a, b) => b.qualityScore - a.qualityScore),
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, "index.json"),
    JSON.stringify(index, null, 2),
  );
  console.log(`[output] index.json: ${index.totalSkills} skills (${index.totalCanonical} canonical)`);
}

// ── Write index-by-category.json ─────────────────────────

export function writeCategoryIndex(skills: SkillEntry[]): void {
  const byCategory: Record<string, SkillEntry[]> = {};
  for (const s of skills.filter((s) => s.canonical)) {
    const cat = s.category || "other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat]!.push(s);
  }

  fs.writeFileSync(
    path.join(DATA_DIR, "index-by-category.json"),
    JSON.stringify(byCategory, null, 2),
  );
  console.log(`[output] index-by-category.json: ${Object.keys(byCategory).length} categories`);
}

// ── Write changelog ─────────────────────────────────────

export function writeChangelog(skills: SkillEntry[], dateStr: string): void {
  const changelogDir = path.join(DATA_DIR, "changelog");
  fs.mkdirSync(changelogDir, { recursive: true });

  const prevIndexPath = path.join(DATA_DIR, "index.json");
  let prevSlugs = new Set<string>();
  try {
    const prev = JSON.parse(fs.readFileSync(prevIndexPath, "utf-8")) as SkillIndex;
    prevSlugs = new Set(prev.skills.map((s) => s.slug));
  } catch {
    // First run
  }

  const currentSlugs = new Set(skills.map((s) => s.slug));
  const added = skills.filter((s) => !prevSlugs.has(s.slug)).map((s) => s.slug);
  const removed = [...prevSlugs].filter((s) => !currentSlugs.has(s));

  const changelog = { date: dateStr, added, removed, total: skills.length };

  fs.writeFileSync(
    path.join(changelogDir, `${dateStr}.json`),
    JSON.stringify(changelog, null, 2),
  );

  if (added.length || removed.length) {
    console.log(`[output] changelog: +${added.length} -${removed.length}`);
  }
}

// ── Write scan report (data/scan-report.md) ─────────────

export function writeScanReport(
  skills: SkillEntry[],
  scanResults: ScanResult[],
  dateStr: string,
): void {
  const canonical = skills.filter((s) => s.canonical);
  const byCategory: Record<string, SkillEntry[]> = {};
  for (const s of canonical) {
    const cat = s.category || "other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat]!.push(s);
  }

  const categoryNames: Record<string, string> = {
    "document-processing": "Document Processing",
    "web-development": "Web Development",
    design: "Design",
    "mcp-tools": "MCP Tools",
    "coding-assistance": "Coding Assistance",
    "data-analysis": "Data & Analysis",
    communication: "Communication",
    devops: "DevOps",
    research: "Research",
    automation: "Automation",
    security: "Security",
    other: "Other",
  };

  const lines: string[] = [
    `# Scan Report — ${dateStr}`,
    "",
    "## Source Results",
    "",
    "| Source | Skills Found | Duration | Status |",
    "|--------|-------------|----------|--------|",
  ];

  for (const r of scanResults) {
    const status = r.error ? `⚠️ ${r.error.slice(0, 50)}` : "✅";
    lines.push(`| ${r.sourceName} | ${r.count} | ${(r.durationMs / 1000).toFixed(1)}s | ${status} |`);
  }

  const totalDuration = scanResults.reduce((sum, r) => sum + r.durationMs, 0);
  lines.push(`| **Total** | **${skills.length}** | **${(totalDuration / 1000).toFixed(1)}s** | |`);

  lines.push("");
  lines.push("## Dedup Summary");
  lines.push("");
  lines.push(`- Raw: ${skills.length}`);
  lines.push(`- Canonical (unique): ${canonical.length}`);
  lines.push(`- Duplicates: ${skills.length - canonical.length}`);
  lines.push("");
  lines.push("## By Category");
  lines.push("");

  for (const [cat, catSkills] of Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`- **${categoryNames[cat] ?? cat}**: ${catSkills.length}`);
  }

  fs.writeFileSync(path.join(DATA_DIR, "scan-report.md"), lines.join("\n"));
  console.log("[output] scan-report.md updated");
}
