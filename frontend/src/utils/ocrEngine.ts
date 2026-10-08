/**
 * On-kiosk OCR (Tesseract.js) using self-hosted assets from /public:
 *   /tesseract/worker.min.js + /tesseract/*.wasm.js   (built by scripts/prepare-ocr-assets.mjs)
 *   /tessdata/{eng,hin}.traineddata.gz
 * One worker is created lazily and reused, so only the first scan pays the start-up cost.
 */
import { createWorker, Worker } from 'tesseract.js';

export type OcrStage = 'engine' | 'reading';
type ProgressListener = (stage: OcrStage, progress: number) => void;

let workerPromise: Promise<Worker> | null = null;
let listener: ProgressListener | null = null;

const ENGINE_STATUSES = new Set(['loading tesseract core', 'initializing tesseract', 'loading language traineddata', 'initializing api']);

const getWorker = (): Promise<Worker> => {
  if (!workerPromise) {
    workerPromise = createWorker(['eng', 'hin'], 1, {
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/',
      langPath: '/tessdata',
      gzip: true,
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => {
        if (!listener) return;
        if (m.status === 'recognizing text') listener('reading', m.progress);
        else if (ENGINE_STATUSES.has(m.status)) listener('engine', m.progress);
      }
    }).catch(err => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
};

/** Starts loading the OCR engine in the background (call when the documents step opens). */
export const warmUpOcr = () => {
  getWorker().catch(() => {});
};

export class OcrTimeoutError extends Error {}

const withTimeout = <T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new OcrTimeoutError('OCR timed out')), ms);
    const onAbort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    signal?.addEventListener('abort', onAbort, { once: true });
    promise.then(
      v => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); resolve(v); },
      e => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); reject(e); }
    );
  });

/**
 * Reads text from an image on the kiosk itself.
 * Engine start-up gets 30 s (first use downloads ~3 MB of language data from this server),
 * recognition gets 45 s. Rejects with OcrTimeoutError / AbortError instead of hanging.
 */
export const recognizeOnDevice = async (
  image: Blob | string,
  onProgress: ProgressListener,
  signal?: AbortSignal
): Promise<string> => {
  listener = onProgress;
  try {
    onProgress('engine', 0);
    const worker = await withTimeout(getWorker(), 30_000, signal);
    onProgress('reading', 0);
    const result = await withTimeout(worker.recognize(image), 45_000, signal);
    return result.data?.text || '';
  } finally {
    listener = null;
  }
};
