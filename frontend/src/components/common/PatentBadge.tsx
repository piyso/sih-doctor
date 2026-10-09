import React from 'react';
import { KeyRound } from 'lucide-react';
import { RecordSealBadge as RecordSealBadgeData } from '../../types/api';

/**
 * Small badge for a verified record seal (Ed25519 signature over canonical JSON plus the
 * SHA-256 provenance chain). It renders only what the backend returned; nothing is hardcoded.
 * Replaces the former "zk-SNARK soundness" badge, which displayed fixed text.
 */
export const RecordSealBadge: React.FC<{ badge: RecordSealBadgeData }> = ({ badge }) => (
  <div
    className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
    title={`${badge.algorithm}; key ${badge.keyId}; record SHA-256 ${badge.recordSha256}`}
  >
    <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
      <KeyRound size={14} />
    </div>
    <div className="text-left">
      <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-white">
        {badge.valid ? 'Record seal verified' : 'Record seal INVALID'}
      </div>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-sans leading-tight">
        {badge.algorithm} · key {badge.keyId}
        {typeof badge.provenanceNodes === 'number' ? ` · ${badge.provenanceNodes} provenance node(s)` : ''}
      </p>
    </div>
  </div>
);
