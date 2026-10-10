/**
 * Which kinds of machine-learning model this server may call. The hospital decides in configuration; it never
 * depends on what happens to be installed on the Edge AI machine.
 *
 *   LLM_ASSIST = off (default) | clinician
 *     off        No language model is ever called.
 *     clinician  A signed-in clinician's visit-note draft (POST /api/ai/soap) may use the on-premise model.
 *                The draft is labelled as model-written and the clinician edits it before anything is saved.
 *     There is no setting that lets a language model read a patient's words at the kiosk, decide triage or
 *     red flags, check medicines or write the history summary: those are rules and templates in every mode.
 *
 *   GENERATIVE_ASR = off (default) | allow
 *     Speech is recognised by per-language sherpa-onnx models (CTC / transducer: they emit only what the
 *     audio supports). The optional Whisper fallback is a generative decoder and can write fluent sentences
 *     for noise, so it is refused unless the hospital allows it.
 *
 * tests/no_llm_guarantee.test.ts runs the server against a stand-in Edge AI machine that advertises a language
 * model and Whisper, and checks that neither is ever called under the default policy.
 */

import type { EdgeAiStatus } from './edgeAi.client';

export type LlmAssist = 'off' | 'clinician';

export const llmAssist = (): LlmAssist => (process.env.LLM_ASSIST === 'clinician' ? 'clinician' : 'off');
export const generativeAsrAllowed = (): boolean => process.env.GENERATIVE_ASR === 'allow';

export interface AiPolicy {
  llmAssist: LlmAssist;
  generativeAsr: 'off' | 'allow';
  /** What the Edge AI machine has installed, whatever the policy lets this server use. */
  installed: { llm: boolean; generativeAsr: boolean };
}

/** Languages served by the non-generative recognisers, read from the service's model label ("sherpa-onnx:en,hi + whisper:small"). */
export function sherpaLanguages(asrModel?: string | null): string[] {
  const m = /sherpa-onnx:([a-z,]+)/i.exec(asrModel || '');
  return m ? m[1].split(',').filter(Boolean) : [];
}
export const hasGenerativeAsr = (asrModel?: string | null): boolean => /whisper/i.test(asrModel || '');

/**
 * The Edge AI status as this server is allowed to use it: a language model that the policy switches off is
 * reported as unavailable, and speech languages that only Whisper could serve are dropped.
 */
export function applyAiPolicy(raw: EdgeAiStatus): EdgeAiStatus & { policy: AiPolicy } {
  const caps = { ...raw.capabilities };
  const llmInstalled = !!raw.capabilities.llm?.available;
  const asrModel = raw.capabilities.asr?.model;
  const generativeInstalled = hasGenerativeAsr(asrModel);

  if (llmAssist() === 'off') caps.llm = { available: false };
  if (generativeInstalled && !generativeAsrAllowed()) {
    const allowed = sherpaLanguages(asrModel);
    caps.asr = allowed.length && raw.capabilities.asr?.available
      ? { available: true, model: `sherpa-onnx:${allowed.join(',')}`, languages: (raw.capabilities.asr.languages || []).filter(l => allowed.includes(l)) }
      : { available: false };
  }
  return {
    ...raw,
    capabilities: caps,
    policy: { llmAssist: llmAssist(), generativeAsr: generativeAsrAllowed() ? 'allow' : 'off', installed: { llm: llmInstalled, generativeAsr: generativeInstalled } }
  };
}

/** Thrown when a call would need a model that the policy does not allow. */
export class AiPolicyError extends Error {
  constructor(public readonly code: 'LLM_OFF' | 'ASR_LANGUAGE_UNAVAILABLE' | 'GENERATIVE_ASR_OFF', message: string) {
    super(message);
    this.name = 'AiPolicyError';
  }
}
