// Document review → edit plan → redline. Works on the document's own paragraphs so a Word file can be revised in place.
// Rules (./rules.ts) read logical blocks (wrapped lines re-joined) and propose edits; each edit carries its reason and
// authority, which become Word comments. Every edit is deterministic and reviewable by counsel.

export type Lang = 'en' | 'es';
export interface Block { i: number; paras: number[]; text: string; lang: Lang }
export interface EditNote { title: string; why: string; cite: string; level: 'required' | 'recommended' }
export type Edit =
  | ({ op: 'replace'; block: number; text: string } & EditNote)
  | ({ op: 'delete'; block: number } & EditNote)
  | ({ op: 'insert'; after: number; texts: string[]; heading?: boolean[] } & EditNote);

export type DocKind = 'meal_waiver' | 'on_duty_meal' | 'handbook' | 'policy' | 'other';
export interface ReviewPlan { kind: DocKind; label: string; employer?: string; blocks: Block[]; edits: Edit[]; findings: (EditNote & { quote?: string })[]; notes: string[] }

const SPANISH = /\b(los|las|el|de|del|su|sus|periodo|período|comida|empleados?|jornada|firma|nombre|renunciar|descanso|fecha|tienda|aprobado|debe|horas|mi|que|por|para|esta|este|y|formulario|entregue|usted|empleador)\b/gi;
const ENGLISH = /\b(the|and|of|to|my|is|that|will|with|for|employee|meal|period|signature|approved|agree|hours?)\b/gi;
export function langOf(s: string): Lang { const es = (s.match(SPANISH) || []).length, en = (s.match(ENGLISH) || []).length; return es >= 2 && es > en ? 'es' : 'en'; }

/** Re-join lines a document wrapped mid-sentence (one paragraph per printed line is common in old forms). */
export function toBlocks(paras: string[]): Block[] {
  const out: Block[] = [];
  paras.forEach((raw, i) => {
    const p = raw.replace(/\s+$/, ''); if (!p.trim()) return;
    const last = out[out.length - 1];
    const prev = last ? last.text : '';
    const continues = last && last.paras[last.paras.length - 1] === i - 1 && prev.length >= 40 && !/[.:;!?)”"]\s*$/.test(prev) && /^[a-z(]/.test(p.trim()) && !/\t/.test(p);
    if (continues) { last.paras.push(i); last.text = `${prev} ${p.trim()}`; }
    else out.push({ i: out.length, paras: [i], text: p.trim(), lang: 'en' });
  });
  out.forEach(b => { b.lang = langOf(b.text); });
  return out;
}

/** Word-level diff (LCS) for readable tracked changes inside a paragraph. */
export function wordDiff(a: string, b: string): { type: 'keep' | 'del' | 'ins'; text: string }[] {
  const A = a.match(/\S+\s*/g) || [], B = b.match(/\S+\s*/g) || [];
  const n = A.length, m = B.length; if (n * m > 250000) return [{ type: 'del', text: a }, { type: 'ins', text: b }];
  const norm = (w: string) => w.trim();
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = norm(A[i]) === norm(B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: { type: 'keep' | 'del' | 'ins'; text: string }[] = []; const push = (type: 'keep' | 'del' | 'ins', text: string) => { const l = out[out.length - 1]; if (l && l.type === type) l.text += text; else out.push({ type, text }); };
  let i = 0, j = 0;
  while (i < n && j < m) { if (norm(A[i]) === norm(B[j])) { push('keep', B[j]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) push('del', A[i++]); else push('ins', B[j++]); }
  while (i < n) push('del', A[i++]); while (j < m) push('ins', B[j++]);
  // too fragmented to read → show as a clean replacement
  const kept = out.filter(x => x.type === 'keep').reduce((t, x) => t + x.text.length, 0);
  if (kept < Math.min(a.length, b.length) * 0.35) return [{ type: 'del', text: a }, { type: 'ins', text: b }];
  return out;
}

export interface RedlineItem { kind: 'keep' | 'replace' | 'delete' | 'insert'; paras?: number[]; original?: string; text?: string; heading?: boolean; segments: { type: 'keep' | 'del' | 'ins'; text: string }[]; note?: EditNote }
/** Turn the plan into an ordered list of output paragraphs (with segments for tracked changes). */
export function applyPlan(plan: ReviewPlan): RedlineItem[] {
  const byBlock = new Map<number, Edit[]>(); const inserts = new Map<number, Edit[]>();
  for (const e of plan.edits) { if (e.op === 'insert') { const l = inserts.get(e.after) || []; l.push(e); inserts.set(e.after, l); } else { const l = byBlock.get(e.block) || []; l.push(e); byBlock.set(e.block, l); } }
  const out: RedlineItem[] = [];
  const emitInserts = (k: number) => { for (const e of inserts.get(k) || []) if (e.op === 'insert') e.texts.forEach((t, n) => out.push({ kind: 'insert', text: t, heading: !!e.heading?.[n], segments: [{ type: 'ins', text: t }], note: n === 0 ? note(e) : undefined })); };
  emitInserts(-1);
  for (const b of plan.blocks) {
    const es = byBlock.get(b.i) || [];
    const del = es.find(e => e.op === 'delete'); const rep = es.find(e => e.op === 'replace') as Extract<Edit, { op: 'replace' }> | undefined;
    if (del) out.push({ kind: 'delete', paras: b.paras, original: b.text, segments: [{ type: 'del', text: b.text }], note: note(del) });
    else if (rep) out.push({ kind: 'replace', paras: b.paras, original: b.text, text: rep.text, segments: wordDiff(b.text, rep.text), note: note(rep) });
    else out.push({ kind: 'keep', paras: b.paras, original: b.text, segments: [{ type: 'keep', text: b.text }] });
    emitInserts(b.i);
  }
  return out;
}
const note = (e: EditNote): EditNote => ({ title: e.title, why: e.why, cite: e.cite, level: e.level });
