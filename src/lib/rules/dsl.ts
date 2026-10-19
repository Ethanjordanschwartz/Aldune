// Sandboxed rule-expression language (spec Vol. III Part 35). No eval, no property access beyond whitelisted
// dotted paths into the data object, no prototype traversal, a small function whitelist, and depth/length limits.
type Node = { k: 'num'; v: number } | { k: 'str'; v: string } | { k: 'bool'; v: boolean } | { k: 'path'; v: string[] } | { k: 'un'; op: string; a: Node } | { k: 'bin'; op: string; a: Node; b: Node } | { k: 'call'; fn: string; args: Node[] };
const FUNCS: Record<string, (...a: number[]) => number> = { min: Math.min, max: Math.max, abs: Math.abs, round: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d, clamp: (x, lo, hi) => Math.min(hi, Math.max(lo, x)) };
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
export class DslError extends Error {}
function lex(src: string) {
  if (src.length > 500) throw new DslError('Expression is too long (500 characters max).');
  const t: string[] = []; const re = /\s*(\d+(?:\.\d+)?|"[^"]*"|'[^']*'|[A-Za-z_][A-Za-z0-9_.]*|>=|<=|==|!=|&&|\|\||[()+\-*/<>!,])/y; let m; let i = 0;
  while (i < src.length) { re.lastIndex = i; m = re.exec(src); if (!m) { if (/^\s*$/.test(src.slice(i))) break; throw new DslError(`Unexpected character at position ${i + 1}.`); } t.push(m[1]); i = re.lastIndex; }
  return t;
}
export function parse(src: string): Node {
  const t = lex(src); let p = 0; let depth = 0;
  const peek = () => t[p]; const eat = (x?: string) => { const v = t[p++]; if (x && v !== x) throw new DslError(`Expected “${x}”.`); return v; };
  const kw = (s: string | undefined) => (s || '').toUpperCase();
  const orE = (): Node => { let a = andE(); while (kw(peek()) === 'OR' || peek() === '||') { eat(); a = { k: 'bin', op: 'or', a, b: andE() }; } return a; };
  const andE = (): Node => { let a = notE(); while (kw(peek()) === 'AND' || peek() === '&&') { eat(); a = { k: 'bin', op: 'and', a, b: notE() }; } return a; };
  const notE = (): Node => { if (kw(peek()) === 'NOT' || peek() === '!') { eat(); return { k: 'un', op: 'not', a: notE() }; } return cmp(); };
  const cmp = (): Node => { let a = add(); const o = peek(); if (['>', '<', '>=', '<=', '==', '!='].includes(o)) { eat(); a = { k: 'bin', op: o, a, b: add() }; } return a; };
  const add = (): Node => { let a = mul(); while (peek() === '+' || peek() === '-') { const o = eat(); a = { k: 'bin', op: o, a, b: mul() }; } return a; };
  const mul = (): Node => { let a = unary(); while (peek() === '*' || peek() === '/') { const o = eat(); a = { k: 'bin', op: o, a, b: unary() }; } return a; };
  const unary = (): Node => { if (peek() === '-') { eat(); return { k: 'un', op: 'neg', a: unary() }; } return atom(); };
  const atom = (): Node => {
    if (++depth > 50) throw new DslError('Expression is nested too deeply.');
    const x = eat(); if (x === undefined) throw new DslError('Unexpected end of expression.');
    if (x === '(') { const e = orE(); eat(')'); return e; }
    if (/^\d/.test(x)) return { k: 'num', v: Number(x) };
    if (/^["']/.test(x)) return { k: 'str', v: x.slice(1, -1) };
    if (/^(true|false)$/i.test(x)) return { k: 'bool', v: /^true$/i.test(x) };
    if (/^[A-Za-z_]/.test(x)) {
      if (peek() === '(') { if (!FUNCS[x]) throw new DslError(`Unknown function “${x}”. Allowed: ${Object.keys(FUNCS).join(', ')}.`); eat('('); const args: Node[] = []; if (peek() !== ')') { args.push(orE()); while (peek() === ',') { eat(); args.push(orE()); } } eat(')'); return { k: 'call', fn: x, args }; }
      const parts = x.split('.'); if (parts.some(s => FORBIDDEN.has(s) || !s)) throw new DslError(`“${x}” is not an allowed field.`); return { k: 'path', v: parts };
    }
    throw new DslError(`Unexpected “${x}”.`);
  };
  const ast = orE(); if (p < t.length) throw new DslError(`Unexpected “${t[p]}”.`); return ast;
}
const get = (o: unknown, path: string[]) => { let v: unknown = o; for (const k of path) { if (v === null || typeof v !== 'object' || !Object.prototype.hasOwnProperty.call(v, k)) return null; v = (v as Record<string, unknown>)[k]; } return typeof v === 'function' ? null : v; };
export function evaluate(n: Node, ctx: Record<string, unknown>): unknown {
  switch (n.k) {
    case 'num': case 'str': case 'bool': return n.v;
    case 'path': return get(ctx, n.v);
    case 'un': { const a = evaluate(n.a, ctx); return n.op === 'not' ? !a : -(Number(a) || 0); }
    case 'call': return FUNCS[n.fn](...n.args.map(x => Number(evaluate(x, ctx)) || 0));
    case 'bin': {
      if (n.op === 'and') return !!evaluate(n.a, ctx) && !!evaluate(n.b, ctx);
      if (n.op === 'or') return !!evaluate(n.a, ctx) || !!evaluate(n.b, ctx);
      const a = evaluate(n.a, ctx), b = evaluate(n.b, ctx);
      if (n.op === '==') return a === b; if (n.op === '!=') return a !== b;
      const x = Number(a), y = Number(b);
      switch (n.op) { case '+': return x + y; case '-': return x - y; case '*': return x * y; case '/': return y === 0 ? 0 : x / y; case '>': return x > y; case '<': return x < y; case '>=': return x >= y; case '<=': return x <= y; }
    }
  }
  return null;
}
export const compile = (src: string) => { const ast = parse(src); return (ctx: Record<string, unknown>) => evaluate(ast, ctx); };

// ---------- custom rules: authored as JSON, gated by attorney verification
export interface CustomRule { id: string; title: string; authority: string; scope: 'shift' | 'period' | 'employee'; applies_if?: string; violation_trigger: string; amount?: string; verification_status: 'needs_review' | 'attorney_verified'; verified_by?: string; effective_start?: string; effective_end?: string | null }
export function validateRule(r: Partial<CustomRule>): string[] {
  const e: string[] = []; if (!r.id || !/^[a-z0-9_-]{3,40}$/.test(r.id)) e.push('id: 3–40 lowercase letters, digits, - or _'); if (!r.title) e.push('title is required'); if (!r.authority || r.authority.length < 5) e.push('authority (citation) is required');
  if (!['shift', 'period', 'employee'].includes(String(r.scope))) e.push('scope must be shift, period, or employee');
  for (const k of ['applies_if', 'violation_trigger', 'amount'] as const) { const v = r[k]; if (k === 'violation_trigger' && !v) e.push('violation_trigger is required'); if (v) { try { parse(v); } catch (x) { e.push(`${k}: ${(x as Error).message}`); } } }
  if (r.verification_status === 'attorney_verified' && !r.verified_by) e.push('attorney_verified rules must name the verifying attorney (verified_by)');
  return e;
}
export function runRule(r: CustomRule, rows: Record<string, unknown>[], dateKey = 'date') {
  const ap = r.applies_if ? compile(r.applies_if) : () => true; const tr = compile(r.violation_trigger); const am = r.amount ? compile(r.amount) : () => 0;
  const hits = rows.filter(x => { const d = String(x[dateKey] ?? ''); if (r.effective_start && d && d < r.effective_start) return false; if (r.effective_end && d && d > r.effective_end) return false; return !!ap(x) && !!tr(x); });
  return { matches: hits.length, total: hits.reduce((t, x) => t + (Number(am(x)) || 0), 0), examples: hits.slice(0, 5), live: r.verification_status === 'attorney_verified' };
}
