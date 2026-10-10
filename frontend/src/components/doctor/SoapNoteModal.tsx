import React, { useEffect, useState } from 'react';
import { FileText, Loader2, X, Sparkles, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { SessionDetail } from '../../types/api';
import { RxDraft } from './doctorRole';

interface SoapNoteModalProps {
  session: SessionDetail;
  transcript: string;
  draft: RxDraft;
  onClose: () => void;
  onInsert: (note: string) => void;
}

const SECTIONS = [
  { key: 'subjective', label: 'S — Subjective (what the patient reports)' },
  { key: 'objective', label: 'O — Objective (vitals, examination)' },
  { key: 'assessment', label: 'A — Assessment (your clinical judgement)' },
  { key: 'plan', label: 'P — Plan (from your prescription)' }
] as const;

/**
 * Drafts a SOAP visit note from the kiosk intake, measured vitals, the consultation transcript and
 * the prescription with a fixed template. A language-model draft is used only when the hospital has switched it
 * on for clinicians (LLM_ASSIST=clinician on the server) and a model is installed.
 * The doctor edits it; nothing is saved until they insert it into the notes and sign the Rx.
 */
export const SoapNoteModal: React.FC<SoapNoteModalProps> = ({ session, transcript, draft, onClose, onInsert }) => {
  const [note, setNote] = useState<Record<string, string> | null>(null);
  const [meta, setMeta] = useState<{ generatedBy: string; model?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.draftSoapNote(session.sessionId, transcript, draft)
      .then(r => {
        if (!alive) return;
        setNote({ subjective: r.subjective, objective: r.objective, assessment: r.assessment, plan: r.plan });
        setMeta({ generatedBy: r.generatedBy, model: r.model });
      })
      .catch(e => alive && setError(e?.message || 'Could not draft the note.'));
    return () => { alive = false; };
  }, [session.sessionId, transcript, draft]);

  const text = note ? SECTIONS.map(s => `${s.label.split(' (')[0]}: ${note[s.key] || ''}`).join('\n') : '';

  return (
    <div className="fixed inset-0 z-[1300] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Visit note draft">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl">
        <div className="sticky top-0 bg-card border-b border-border/70 px-5 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            <h2 className="text-sm font-bold">Visit note draft — {session.patientName}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Close"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-3">
          {meta && (
            <div className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${meta.generatedBy === 'llm' ? 'bg-violet-500/10 border-violet-500/40 text-violet-800 dark:text-violet-200' : 'bg-muted border-border text-muted-foreground'}`}>
              {meta.generatedBy === 'llm' ? <Sparkles size={14} /> : <AlertTriangle size={14} />}
              {meta.generatedBy === 'llm'
                ? `Drafted by the on-premise language model${meta.model ? ` (${meta.model})` : ''}. It can be wrong — check every line against what happened.`
                : 'Built from the recorded intake, vitals and your prescription with a fixed template (no language model is used). Complete the assessment yourself.'}
            </div>
          )}
          {error && <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs font-semibold text-rose-700">{error}</div>}
          {!note && !error && <div className="py-10 flex items-center justify-center text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin mr-2" /> Drafting…</div>}
          {note && SECTIONS.map(s => (
            <label key={s.key} className="block">
              <span className="text-xs font-bold text-foreground">{s.label}</span>
              <textarea
                value={note[s.key]}
                onChange={e => setNote(n => ({ ...(n || {}), [s.key]: e.target.value }))}
                rows={s.key === 'subjective' ? 4 : 3}
                className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          ))}
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border/70 px-5 py-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Cancel</button>
          <button type="button" disabled={!note} onClick={() => onInsert(text)} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">I have reviewed it — add to notes</button>
        </div>
      </div>
    </div>
  );
};
