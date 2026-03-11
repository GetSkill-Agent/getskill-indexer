import * as cheerio from "cheerio";
import type { SkillRaw } from "../types.ts";
import { toSlug } from "../dedup.ts";

const USER_AGENT = "getskill-indexer/1.0 (https://github.com/GetSkill-Agent/getskill-indexer)";

/**
 * Scrape aitmpl.com/skills for Claude Code skill templates.
 * Based on davila7/claude-code-templates GitHub repo.
 * No API — DOM scraping via cheerio.
 */
export async function scanAitmpl(): Promise<SkillRaw[]> {
  console.log("[scan] Scraping aitmpl.com/skills...");
  const now = new Date().toISOString();
  const skills: SkillRaw[] = [];

  try {
    const res = await fetch("https://www.aitmpl.com/skills", {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.warn(`[aitmpl] HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // aitmpl renders skill cards — try common patterns
    $("a[href*='skill'], .card, [class*='skill'], [class*='template']").each((_i, el) => {
      const $el = $(el);
      const name = $el.find("h3, h4, .title, .name").first().text().trim()
        || $el.find("strong, b").first().text().trim();
      const desc = $el.find("p, .description, .desc").first().text().trim();
      const href = $el.attr("href") || "";

      if (!name || name.length < 2 || name.length > 100) return;

      const sourceUrl = href.startsWith("http") ? href : `https://www.aitmpl.com${href}`;

      skills.push({
        name,
        slug: toSlug(name),
        description: desc || "",
        source: "aitmpl",
        sourceUrl,
        hasScripts: false,
        fileCount: 0,
        updatedAt: now,
        scannedAt: now,
      });
    });

    // Fallback: list items
    if (skills.length === 0) {
      $("li a, .list-item a").each((_i, el) => {
        const $el = $(el);
        const name = $el.text().trim();
        const href = $el.attr("href") || "";

        if (!name || name.length < 3 || name.length > 100) return;
        if (href.includes("#") || !href) return;

        const sourceUrl = href.startsWith("http") ? href : `https://www.aitmpl.com${href}`;

        skills.push({
          name,
          slug: toSlug(name),
          description: "",
          source: "aitmpl",
          sourceUrl,
          hasScripts: false,
          fileCount: 0,
          updatedAt: now,
          scannedAt: now,
        });
      });
    }
  } catch (e) {
    console.warn("[aitmpl] Scrape failed:", e instanceof Error ? e.message : e);
  }

  // Deduplicate within source
  const seen = new Set<string>();
  const unique = skills.filter((s) => {
    if (seen.has(s.slug)) return false;
    seen.add(s.slug);
    return true;
  });

  console.log(`[scan] aitmpl.com: found ${unique.length} skills`);
  return unique;
}
