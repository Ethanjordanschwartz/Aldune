'use client';
import { useState } from 'react';

const T = {
  en: { title: 'End-of-shift check-out', date: 'Work date', meal: 'Did you get a full, uninterrupted 30-minute meal break that started before the end of your 5th hour of work (and a second one before your 10th hour, if you worked that long)?', rest: 'Did you get every 10-minute rest break, completely off duty and not on call?', off: 'Did you do any work today that isn’t on your time record?', mins: 'About how many minutes?', yes: 'Yes', no: 'No', submit: 'Submit', note: 'Answer honestly. You will never be disciplined for reporting a missed break or unrecorded work.', done: 'Thank you. Your answers were saved.', prem: (h: number) => `You will receive ${h} extra hour${h === 1 ? '' : 's'} of pay on your next paycheck.`, again: 'Done' },
  es: { title: 'Registro al terminar el turno', date: 'Fecha de trabajo', meal: '¿Recibió un periodo de comida completo de 30 minutos, sin interrupciones, que empezó antes del final de su quinta hora de trabajo (y otro antes de la décima hora, si trabajó tanto)?', rest: '¿Recibió todos sus descansos de 10 minutos, sin trabajar y sin estar disponible?', off: '¿Hizo algún trabajo hoy que no aparece en su registro de horas?', mins: '¿Aproximadamente cuántos minutos?', yes: 'Sí', no: 'No', submit: 'Enviar', note: 'Conteste con honestidad. Nunca habrá castigo por reportar un descanso perdido o trabajo no registrado.', done: 'Gracias. Sus respuestas se guardaron.', prem: (h: number) => `Recibirá ${h} hora${h === 1 ? '' : 's'} adicional${h === 1 ? '' : 'es'} de pago en su próximo cheque.`, again: 'Listo' }
};
type YN = boolean | null;
export function Kiosk({ token, name }: { token: string; name?: string }) {
  const [lang, setLang] = useState<'en' | 'es'>('en'); const t = T[lang];
  const [meal, setMeal] = useState<YN>(null), [rest, setRest] = useState<YN>(null), [off, setOff] = useState<YN>(null);
  const [mins, setMins] = useState(0); const [date] = useState(new Date().toLocaleDateString('en-CA'));
  const [result, setResult] = useState<number | null>(null); const [err, setErr] = useState('');
  const ready = meal !== null && rest !== null && off !== null;
  async function submit() {
    setErr('');
    const r = await fetch('/api/attest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, workDate: date, mealProvided: meal, restProvided: rest, offClockWork: off, offClockMinutes: off ? mins : 0, language: lang }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) { setErr(j.error || 'Not saved. Try again.'); return; } setResult(j.premiumHours);
  }
  const q = (label: string, v: YN, set: (b: boolean) => void) => (
    <fieldset className="mb-6"><legend className="text-lg font-semibold mb-3 leading-snug">{label}</legend>
      <div className="grid grid-cols-2 gap-3">{[true, false].map(b => <button type="button" key={String(b)} aria-pressed={v === b} onClick={() => set(b)} className={`py-5 text-xl font-bold rounded-lg border-2 ${v === b ? (b ? 'bg-ledger text-white border-ledger' : 'bg-risk-high text-white border-risk-high') : 'bg-white border-line'}`}>{b ? t.yes : t.no}</button>)}</div></fieldset>);
  if (result !== null) return (
    <div className="text-center py-16"><p className="text-2xl font-bold">{t.done}</p>{result > 0 && <p className="mt-3 text-lg">{t.prem(result)}</p>}
      <button onClick={() => { setResult(null); setMeal(null); setRest(null); setOff(null); setMins(0); }} className="mt-8 px-6 py-3 rounded-lg bg-ink text-white font-semibold">{t.again}</button></div>);
  return (
    <div>
      <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-extrabold">{t.title}</h1>
        <div className="flex gap-1" role="group" aria-label="Language">{(['en', 'es'] as const).map(l => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} className={`px-3 py-1.5 rounded border ${lang === l ? 'bg-ink text-white' : 'bg-white border-line'}`}>{l === 'en' ? 'English' : 'Español'}</button>)}</div></div>
      {name && <p className="mb-1 font-semibold">{name}</p>}<p className="text-ink-2 mb-6">{t.date}: {date}</p>
      {q(t.meal, meal, setMeal)}{q(t.rest, rest, setRest)}{q(t.off, off, setOff)}
      {off && <label className="block mb-6 text-lg">{t.mins}<input type="number" min={1} max={600} value={mins || ''} onChange={e => setMins(Number(e.target.value))} className="block mt-2 w-40 border-2 border-line rounded-lg px-3 py-3 text-xl" /></label>}
      <p className="text-sm text-ink-2 mb-4">{t.note}</p>
      <button disabled={!ready} onClick={submit} className="w-full py-4 rounded-lg bg-ink text-white text-xl font-bold disabled:opacity-40">{t.submit}</button>
      {err && <p role="alert" className="text-risk-high mt-3">{err}</p>}
    </div>
  );
}
