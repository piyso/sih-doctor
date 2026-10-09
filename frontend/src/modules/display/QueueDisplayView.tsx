import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Maximize, WifiOff, LogOut } from 'lucide-react';
import { api } from '../../services/api';
import { session } from '../../services/session';
import { speak } from '../../utils/speech';

/**
 * Waiting-room TV: "now serving" per room plus who is next, and spoken announcements when a doctor
 * calls a token. Shows token numbers and rooms only — never patient names.
 *
 * Open with ?mode=display. Optional ?langs=hi,en,ta sets the announcement languages (in order).
 */

const ANNOUNCE: Record<string, (token: string, room: string) => string> = {
  en: (t, r) => `Token ${spell(t)}, please go to room ${r}.`,
  hi: (t, r) => `टोकन ${spell(t)}, कृपया कमरा नंबर ${r} में जाएँ।`,
  mr: (t, r) => `टोकन ${spell(t)}, कृपया खोली क्रमांक ${r} मध्ये जा.`,
  bn: (t, r) => `টোকেন ${spell(t)}, অনুগ্রহ করে ${r} নম্বর ঘরে যান।`,
  ta: (t, r) => `டோக்கன் ${spell(t)}, தயவுசெய்து அறை எண் ${r} க்கு செல்லவும்.`,
  te: (t, r) => `టోకెన్ ${spell(t)}, దయచేసి గది సంఖ్య ${r} కి వెళ్ళండి.`,
  gu: (t, r) => `ટોકન ${spell(t)}, કૃપા કરીને રૂમ નંબર ${r} માં જાઓ.`,
  kn: (t, r) => `ಟೋಕನ್ ${spell(t)}, ದಯವಿಟ್ಟು ಕೊಠಡಿ ಸಂಖ್ಯೆ ${r} ಗೆ ಹೋಗಿ.`,
  ml: (t, r) => `ടോക്കൺ ${spell(t)}, ദയവായി മുറി നമ്പർ ${r} ലേക്ക് പോകുക.`,
  pa: (t, r) => `ਟੋਕਨ ${spell(t)}, ਕਿਰਪਾ ਕਰਕੇ ਕਮਰਾ ਨੰਬਰ ${r} ਵਿੱਚ ਜਾਓ।`,
  or: (t, r) => `ଟୋକେନ୍ ${spell(t)}, ଦୟାକରି କୋଠରୀ ନମ୍ବର ${r} କୁ ଯାଆନ୍ତୁ।`
};

/** "GENMED-014" → "GENMED 0 1 4" so the digits are read one by one. */
function spell(token: string): string {
  const [dept, num] = token.split('-');
  return `${dept} ${(num || '').split('').join(' ')}`;
}

const DEPT_SHORT: Record<string, string> = {
  GENMED: 'General Medicine', PAED: 'Children', OBGY: 'Women', ORTH: 'Bones & Joints', ENT: 'Eye & ENT',
  KAYA: 'Ayurveda Medicine', PKRM: 'Panchakarma', SHLK: 'Ayurveda Eye & ENT', PRAS: 'Ayurveda Women', BALA: 'Ayurveda Children', SHAL: 'Ayurveda Surgery', ISO: 'Fever Clinic'
};

export const QueueDisplayView: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
  const [board, setBoard] = useState<any>(null);
  const [online, setOnline] = useState(true);
  const [sound, setSound] = useState(false);
  const [flash, setFlash] = useState<{ tokenNo: string; room: string } | null>(null);
  const [clock, setClock] = useState(new Date());
  const queueRef = useRef<Array<{ tokenNo: string; room: string }>>([]);
  const speakingRef = useRef(false);
  const soundRef = useRef(sound);
  useEffect(() => { soundRef.current = sound; }, [sound]);

  // Read once: a new array on every render would restart the data effect in a loop.
  const [langs] = useState<string[]>(() => {
    try {
      const l = new URLSearchParams(window.location.search).get('langs');
      const list = (l || 'hi,en').split(',').map(x => x.trim()).filter(x => ANNOUNCE[x]);
      return list.length ? list : ['hi', 'en'];
    } catch {
      return ['hi', 'en'];
    }
  });

  const load = useCallback(async () => {
    try {
      setBoard(await api.getQueueBoard(session.deviceToken || undefined));
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  const drain = useCallback(async () => {
    if (speakingRef.current) return;
    speakingRef.current = true;
    while (queueRef.current.length) {
      const next = queueRef.current.shift()!;
      setFlash(next);
      if (soundRef.current) {
        for (const l of langs) await speak(ANNOUNCE[l](next.tokenNo, next.room), l, { rate: 0.85 });
      } else {
        await new Promise(r => setTimeout(r, 6000));
      }
    }
    setTimeout(() => setFlash(null), 4000);
    speakingRef.current = false;
  }, [langs]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 20000);
    const tick = setInterval(() => setClock(new Date()), 1000);
    const stop = api.subscribeBoard(e => {
      if (e.type === 'token.called') {
        queueRef.current.push({ tokenNo: e.tokenNo, room: e.room });
        drain();
      }
      load();
    }, session.deviceToken || undefined);
    return () => { clearInterval(poll); clearInterval(tick); stop(); };
  }, [load, drain]);

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 sm:px-8 py-5">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">OPD Queue · ओपीडी कतार</h1>
          <p className="text-slate-400 text-sm sm:text-base mt-1">Please wait for your token to be called · कृपया अपना टोकन बुलाए जाने तक प्रतीक्षा करें</p>
        </div>
        <div className="text-right">
          <div className="text-3xl sm:text-5xl font-extrabold tabular-nums">{clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="flex gap-2 justify-end mt-2">
            <button type="button" onClick={() => setSound(s => !s)} className={`h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 ${sound ? 'bg-emerald-600' : 'bg-slate-800 border border-slate-700'}`}>
              {sound ? <Volume2 size={14} /> : <VolumeX size={14} />} {sound ? 'Announcements on' : 'Tap to enable announcements'}
            </button>
            <button type="button" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="h-9 px-3 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold inline-flex items-center gap-1.5">
              <Maximize size={14} /> Full screen
            </button>
            {/* The TV has no staff bar (public screen); staff leave with this or Esc. */}
            {onExit && (
              <button type="button" onClick={onExit} className="h-9 w-9 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-white inline-flex items-center justify-center" title="Leave the display (Esc)" aria-label="Leave the display">
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {!online && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200 font-semibold flex items-center gap-2"><WifiOff size={18} /> Connection lost — showing the last known queue.</div>
      )}

      {flash && (
        <div className="mb-5 p-5 sm:p-7 rounded-3xl bg-emerald-600 text-white text-center shadow-2xl animate-in fade-in zoom-in-95" role="status" aria-live="assertive">
          <div className="text-lg sm:text-2xl font-semibold opacity-90">Now calling · अभी बुलाया जा रहा है</div>
          <div className="text-6xl sm:text-8xl font-black tracking-tight my-2 tabular-nums">{flash.tokenNo}</div>
          <div className="text-2xl sm:text-4xl font-extrabold">Room {flash.room} · कमरा {flash.room}</div>
        </div>
      )}

      {!board ? (
        <div className="text-center text-slate-400 py-20 text-xl">Loading queue…</div>
      ) : board.departments.length === 0 ? (
        <div className="text-center text-slate-400 py-20 text-2xl">No one is waiting right now.</div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {board.departments.map((d: any) => (
            <div key={d.code} className="rounded-3xl bg-slate-900 border border-slate-800 p-5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-xl font-extrabold">Room {d.room}</div>
                <div className="text-sm text-slate-400 truncate">{DEPT_SHORT[d.code] || d.name}</div>
              </div>
              <div className="mt-3 text-xs uppercase tracking-wider text-slate-400 font-bold">Now serving</div>
              <div className="text-5xl font-black tabular-nums text-emerald-400 leading-tight">{d.nowServing || '—'}</div>
              <div className="mt-3 text-xs uppercase tracking-wider text-slate-400 font-bold">Next</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {d.next.length ? d.next.map((t: string) => (
                  <span key={t} className="px-3 py-1.5 rounded-xl bg-slate-800 text-xl font-bold tabular-nums">{t}</span>
                )) : <span className="text-slate-500">—</span>}
              </div>
              <div className="mt-3 text-sm text-slate-400">{d.waitingCount} waiting · about {d.estimatedWaitMinutes} min</div>
            </div>
          ))}
        </div>
      )}

      {board?.recentCalls?.length > 0 && (
        <div className="mt-6">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Recently called</div>
          <div className="flex flex-wrap gap-2">
            {board.recentCalls.map((c: any) => (
              <span key={`${c.tokenNo}-${c.calledAt}`} className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-lg font-bold tabular-nums">{c.tokenNo} → {c.room}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
