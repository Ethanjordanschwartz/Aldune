// Provenance policy: Aldune’s legal layer is built only from primary law (statutes, regulations, published opinions
// cited to official reporters) and official agency publications, written in Aldune’s own words. No
// third-party editorial content (headnotes, citators, unofficial reporter citations).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LAW } from '@/lib/law/kb';
import { FAQ } from '@/lib/law/faq';
const FORBIDDEN = /\(West\)|headnote|Cal\.\s?Rptr|\bP\.[23]d\b/i; // third-party editorial markers
const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|js)$/.test(f) && !/engine\.js$/.test(f) ? [p] : []; });
describe('provenance policy', () => {
  it('no third-party editorial content anywhere in product code', () => {
    const bad = [...walk('src'), ...walk('standalone')].filter(f => FORBIDDEN.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
  it('every law-library and answer citation is primary law, an official reporter, or official guidance', () => {
    const OK = /§|Cal\.(?:\s?App\.)?\s?(?:2d|3d|4th|5th)|U\.S\.|F\.(?:3d|4th)|Cal\. Code Regs|Wage Order|Rules of Court|ordinance|Mun\. Code|AB |SB |Labor Commissioner|DLSE|Office of Wage Standards|LWDA|Prop|\bCir\b/i;
    const cites = [...LAW.flatMap(t => t.citations.map(c => [t.id, c])), ...FAQ.flatMap(f => f.cites.map(c => [f.id, c]))];
    expect(cites.filter(([, c]) => !OK.test(c))).toEqual([]);
  });
});
