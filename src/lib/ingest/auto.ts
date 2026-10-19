// Automatic time-file import: the same path the Import page uses (read → map columns → normalize).
import { parseFile, normalize, type Mapping } from './normalize';
import { suggestMapping } from './mapping';
export function autoImportTime(name: string, data: string | ArrayBuffer) {
  const pf = parseFile(name, data); const sug = suggestMapping('time', pf.headers);
  const mapping: Mapping = Object.fromEntries(sug.map(s => [s.column, s.field]));
  const r = normalize('x', { time: { ...pf, mapping } });
  return { records: r.input.timeRecords, mapping, headers: pf.headers, issues: r.issues };
}
