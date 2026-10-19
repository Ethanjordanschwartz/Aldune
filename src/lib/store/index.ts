import 'server-only';
import { demoSource } from './demo';
import { dbSource } from './db';
import type { AuditSource } from './types';

/** Resolve the data source for an audit. "demo" is public; everything else goes through RLS-protected queries. */
export function getSource(auditId: string): AuditSource {
  return auditId === 'demo' ? demoSource : dbSource(auditId);
}
export * from './types';
