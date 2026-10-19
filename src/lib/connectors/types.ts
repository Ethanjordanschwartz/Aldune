// Connector framework: every provider maps its API data into Aldune's canonical import rows (same field keys as the importer).
export type Row = Record<string, string | number>;
export interface ConnectorPull { employees: Row[]; time: Row[]; payroll: Row[]; notes: string[] }
export interface Connector { id: string; name: string; pull(opts: { from: string; to: string }): Promise<ConnectorPull> }
/** AES-256-GCM token encryption for tokens at rest (key: CONNECTOR_KEY, 32 bytes base64). */
export async function encryptToken(plain: string, keyB64: string): Promise<string> {
  const { webcrypto } = await import('node:crypto'); const key = await webcrypto.subtle.importKey('raw', Buffer.from(keyB64, 'base64'), 'AES-GCM', false, ['encrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12)); const ct = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  return `${Buffer.from(iv).toString('base64')}.${Buffer.from(ct).toString('base64')}`;
}
export async function decryptToken(enc: string, keyB64: string): Promise<string> {
  const { webcrypto } = await import('node:crypto'); const [iv, ct] = enc.split('.'); const key = await webcrypto.subtle.importKey('raw', Buffer.from(keyB64, 'base64'), 'AES-GCM', false, ['decrypt']);
  return new TextDecoder().decode(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(iv, 'base64') }, key, Buffer.from(ct, 'base64')));
}
