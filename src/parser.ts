import matter from "gray-matter";

// ── Types ────────────────────────────────────────────────

export interface ParsedSkillMd {
  name: string;
  description: string;
  content: string;
  frontmatter: Record<string, unknown>;
}

// ── Parse SKILL.md with YAML frontmatter ─────────────────

export function parseSkillMd(raw: string, fallbackName?: string): ParsedSkillMd | null {
  try {
    const { data, content } = matter(raw);

    const name = (data.name as string) ?? fallbackName ?? extractNameFromContent(content);
    const description =
      (data.description as string) ?? extractFirstParagraph(content);

    if (!name) return null;

    return {
      name,
      description: description || "",
      content: content.slice(0, 5000), // truncate
      frontmatter: data,
    };
  } catch {
    // No frontmatter — try extracting from markdown headings
    const name = fallbackName ?? extractNameFromContent(raw);
    if (!name) return null;

    return {
      name,
      description: extractFirstParagraph(raw),
      content: raw.slice(0, 5000),
      frontmatter: {},
    };
  }
}

// ── Helpers ──────────────────────────────────────────────

function extractNameFromContent(content: string): string | null {
  // Try first heading
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function extractFirstParagraph(content: string): string {
  const lines = content.split("\n");
  const paragraphLines: string[] = [];
  let started = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!started) {
      // Skip headings and empty lines at the start
      if (trimmed && !trimmed.startsWith("#")) {
        started = true;
        paragraphLines.push(trimmed);
      }
    } else {
      if (!trimmed) break; // End of paragraph
      paragraphLines.push(trimmed);
    }
  }

  return paragraphLines.join(" ").slice(0, 500);
}

// ── Parse awesome-list markdown entries ──────────────────

export interface AwesomeEntry {
  name: string;
  url: string;
  description: string;
  author?: string;
}

export function parseAwesomeList(markdown: string): AwesomeEntry[] {
  const entries: AwesomeEntry[] = [];

  // Match pattern: - [Name](url) - Description. By @author
  // or: - **[Name](url)** - Description
  const regex = /^[\s-]*\*?\*?\[([^\]]+)\]\(([^)]+)\)\*?\*?\s*[-–—:]?\s*(.+)$/gm;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    const name = match[1]!.trim();
    const url = match[2]!.trim();
    let desc = match[3]!.trim();

    // Extract author if present
    let author: string | undefined;
    const authorMatch = desc.match(/[Bb]y\s+@?(\w+)\s*$/);
    if (authorMatch) {
      author = authorMatch[1];
      desc = desc.replace(authorMatch[0], "").trim().replace(/\.\s*$/, "");
    }

    // Skip non-skill entries (badges, headers, etc.)
    if (url.includes("shields.io") || url.includes("#")) continue;

    entries.push({ name, url, description: desc, author });
  }

  return entries;
}
