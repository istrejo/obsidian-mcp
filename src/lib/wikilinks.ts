import path from 'node:path';

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
const INLINE_TAG_RE = /#([\w/\-]+)/g;

export function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  let match: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return [...new Set(links)];
}

export function extractTags(content: string): string[] {
  const tags: string[] = [];
  let match: RegExpExecArray | null;
  INLINE_TAG_RE.lastIndex = 0;
  while ((match = INLINE_TAG_RE.exec(content)) !== null) {
    tags.push(match[1].toLowerCase());
  }
  return [...new Set(tags)];
}

export function replaceWikilink(content: string, fromPath: string, toPath: string): string {
  const fromName = path.basename(fromPath, '.md');
  const toName = path.basename(toPath, '.md');

  // Replace [[fromName]] and [[fromPath]] variants
  return content.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, (_match, link, alias) => {
    const normalized = link.trim();
    if (normalized === fromName || normalized === fromPath || normalized === fromPath + '.md') {
      return alias ? `[[${toName}${alias}]]` : `[[${toName}]]`;
    }
    return _match;
  });
}

export function wikilinkMatchesNote(link: string, notePath: string): boolean {
  const noteName = path.basename(notePath, '.md');
  const notePathNormalized = notePath.replace(/\.md$/, '');
  const normalized = link.trim();
  return (
    normalized === noteName ||
    normalized === notePathNormalized ||
    normalized === notePath
  );
}
