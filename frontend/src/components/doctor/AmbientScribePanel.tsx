import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  CheckCircle2,
  Square,
  Globe,
  Radio,
  Sliders,
  ShieldCheck,
  Zap,
  Ear,
  Activity,
  User,
  Stethoscope,
  Play
} from 'lucide-react';
import { AudioVisualizer } from '../common/AudioVisualizer';
import { api } from '../../services/api';
import { sovereignSound } from '../../utils/audio';
import { aiCapabilities, cloudSpeechAllowed, startRecording, Recorder } from '../../utils/onPremAsr';
import { scribeChips, ScribeChipKind } from '../../utils/scribeEntities';

interface AmbientScribePanelProps {
  onAutoExtract: (transcriptText?: string) => void;
  /** Receives the full consultation transcript whenever it changes (used for the visit-note draft). */
  onTranscriptChange?: (text: string) => void;
}

export type AcousticMode = 'far_field_cabin' | 'whisper_boost' | 'standard';

export interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: string;
  isWhisper?: boolean;
  snrDb?: number;
  tags?: string[];
}

const CHIP_STYLE: Record<ScribeChipKind, { bg: string; border: string; fg: string }> = {
  emergency: { bg: '#fef2f2', border: '#fecaca', fg: '#b91c1c' },
  symptom: { bg: '#f8fafc', border: '#e2e8f0', fg: '#334155' },
  denied: { bg: '#f8fafc', border: '#e2e8f0', fg: '#94a3b8' },
  vital: { bg: '#eff6ff', border: '#bfdbfe', fg: '#1d4ed8' },
  duration: { bg: '#f8fafc', border: '#e2e8f0', fg: '#475569' },
  rx: { bg: '#f0fdf4', border: '#bbf7d0', fg: '#15803d' },
  ayush: { bg: '#fefce8', border: '#fde68a', fg: '#a16207' }
};

export const AmbientScribePanel: React.FC<AmbientScribePanelProps> = ({ onAutoExtract, onTranscriptChange }) => {
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);

  // Only the real microphone is used: a scripted stream must never enter a real patient's record.
  const inputMode = 'real_mic' as const;
  const [micError, setMicError] = useState<string | null>(null);
  const [acousticMode, setAcousticMode] = useState<AcousticMode>('far_field_cabin');
  const [micLanguage, setMicLanguage] = useState<'hi-IN' | 'en-IN'>('hi-IN');
  const [hasWebSpeech, setHasWebSpeech] = useState<boolean>(false);
  // The hospital's own speech recognition (edge-ai): audio stays on the premises. Preferred whenever it is up.
  const [onPremAsr, setOnPremAsr] = useState(false);
  const [liveInterimText, setLiveInterimText] = useState<string>('');

  // Acoustic Telemetry State
  const [liveDbLevel, setLiveDbLevel] = useState<number>(-60);
  const [liveNoiseFloor, setLiveNoiseFloor] = useState<number>(-54);
  const [isWhisperDetected, setIsWhisperDetected] = useState<boolean>(false);

  const [transcriptLines, setTranscriptLines] = useState<TranscriptEntry[]>([]);

  const recognitionRef = useRef<any>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sync ref
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    onTranscriptChange?.(transcriptLines.map(t => `${t.speaker}: ${t.text}`).join('\n'));
  }, [transcriptLines, onTranscriptChange]);

  // Chips under each line come from the shared clinical text engine (utils/scribeEntities.ts).

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcriptLines, liveInterimText]);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setHasWebSpeech(!!SpeechRecognition);
  }, []);

  useEffect(() => {
    let alive = true;
    aiCapabilities().then(c => { if (alive) setOnPremAsr(c.asr); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  /** Adds one finished utterance to the transcript (speaker guessed from prescribing words). */
  const addFinalLine = useCallback((text: string) => {
    const piece = text.trim();
    if (!piece) return;
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isDocPrescribing = /गोली|सुबह|शाम|खुराक|mg|tablet|pani|water|blood pressure|take|गुग्गुलु|ashwagandha/i.test(piece);
    setTranscriptLines(prev => [...prev, {
      speaker: isDocPrescribing ? 'Doctor (Desk)' : 'Patient (Far-Field)',
      text: piece,
      timestamp: now,
      isWhisper: isWhisperDetected,
      snrDb: Math.max(0, liveDbLevel - liveNoiseFloor)
    }]);
    setLiveInterimText('');
    sovereignSound('notch');
  }, [isWhisperDetected, liveDbLevel, liveNoiseFloor]);
  const addFinalLineRef = useRef(addFinalLine);
  addFinalLineRef.current = addFinalLine;

  // Web Audio DSP Graph Setup for Far-Field Whisper Amplification
  const setupWebAudioDSP = async () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: false, // Keep false in quiet room to prevent clipping soft whispers
          autoGainControl: false   // Handled by our DSP compressor
        }
      });
      mediaStreamRef.current = stream;

      const sourceNode = audioCtx.createMediaStreamSource(stream);

      // 1. High-Pass Filter (85 Hz) - Cuts desk rumble and AC hum
      const hpFilter = audioCtx.createBiquadFilter();
      hpFilter.type = 'highpass';
      hpFilter.frequency.value = 85;
      hpFilter.Q.value = 0.707;

      // 2. Formant Clarifier (2.8 kHz, +5.5 dB) - Restores unvoiced consonant transients
      const formantBoost = audioCtx.createBiquadFilter();
      formantBoost.type = 'peaking';
      formantBoost.frequency.value = 2800;
      formantBoost.gain.value = acousticMode === 'whisper_boost' ? 7.0 : 5.5;
      formantBoost.Q.value = 1.2;

      // 3. High-Shelf Sibilance Air Filter (5.5 kHz, +4 dB)
      const highShelf = audioCtx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 5500;
      highShelf.gain.value = acousticMode === 'whisper_boost' ? 6.0 : 4.0;

      // 4. Clinical Dynamics Compressor with Soft-Knee Expansion
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = acousticMode === 'whisper_boost' ? -48.0 : acousticMode === 'far_field_cabin' ? -42.0 : -32.0;
      compressor.knee.value = 14.0;
      compressor.ratio.value = 4.5;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.14;

      // 5. AnalyserNode for Real-Time Telemetry & VU Metering
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      analyserRef.current = analyser;

      // Connect DSP Graph
      sourceNode.connect(hpFilter);
      hpFilter.connect(formantBoost);
      formantBoost.connect(highShelf);
      highShelf.connect(compressor);
      compressor.connect(analyser);

      // Start Telemetry VU Animation Loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateTelemetry = () => {
        if (!analyserRef.current || !isListeningRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArray);

        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        const db = rms <= 1e-4 ? -70 : Math.round(20 * Math.log10(rms));
        setLiveDbLevel(Math.max(-70, Math.min(0, db)));

        // Whisper Detection Heuristic (Voice active between -46dB and -35dB)
        const isWhisper = db > -48 && db < -35;
        setIsWhisperDetected(isWhisper);

        animFrameRef.current = requestAnimationFrame(updateTelemetry);
      };
      updateTelemetry();

    } catch (err) {
      console.warn('[AmbientScribe] Web Audio DSP initialization failed (permission or device busy):', err);
    }
  };

  const teardownWebAudioDSP = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch (e) {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setLiveDbLevel(-60);
    setIsWhisperDetected(false);
  };

  // Handle Listening State (Real Mic or Simulated Stream)
  useEffect(() => {
    let unsubscribeWs: (() => void) | null = null;
    const stopOnPrem: { cancelled: boolean; resolve?: () => void } = { cancelled: false };

    if (isListening) {
      if (inputMode === 'real_mic' && onPremAsr) {
        setupWebAudioDSP();
        // On-premise: record one utterance at a time (ends on ~1.2 s of silence or after 20 s) and transcribe it on
        // the hospital server while the next utterance is already being recorded.
        const lang = micLanguage.startsWith('hi') ? 'hi' : 'en';
        let current: Recorder | null = null;
        let failures = 0;
        const loop = async () => {
          while (!stopOnPrem.cancelled && isListeningRef.current) {
            let blob: Blob | null = null;
            try {
              blob = await new Promise<Blob | null>((resolve, reject) => {
                let finished = false;
                const finish = () => { if (finished || !current) return; finished = true; current.stop().then(resolve, reject); };
                stopOnPrem.resolve = () => { finished = true; current?.cancel(); resolve(null); };
                startRecording({ maxSeconds: 20, silenceMs: 1200, onSilence: finish })
                  .then(r => { current = r; if (stopOnPrem.cancelled) { r.cancel(); resolve(null); } setTimeout(finish, 20_000); }, reject);
              });
            } catch (e: any) {
              setMicError(e?.name === 'NotAllowedError'
                ? 'Microphone permission was denied. Allow microphone access in the browser to use the scribe, or type notes manually.'
                : 'The microphone could not be started on this device.');
              isListeningRef.current = false;
              setIsListening(false);
              return;
            }
            if (!blob || stopOnPrem.cancelled) return;
            setLiveInterimText('…');
            api.transcribeAudio(blob, lang).then(r => {
              failures = 0;
              if (!stopOnPrem.cancelled) addFinalLineRef.current(r.text || '');
              else setLiveInterimText('');
            }).catch(() => {
              setLiveInterimText('');
              if (++failures >= 2) setMicError('The hospital speech server is not responding. Type notes manually or try again.');
            });
          }
        };
        loop();
      } else if (inputMode === 'real_mic') {
        setupWebAudioDSP();

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!cloudSpeechAllowed) {
          setMicError('The hospital speech server is not available and browser (cloud) speech recognition is turned off here. Type notes manually.');
        } else if (SpeechRecognition) {
          try {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = micLanguage;
            recognition.maxAlternatives = 1;

            recognition.onresult = (event: any) => {
              let interim = '';
              for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcriptPiece = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                  addFinalLineRef.current(transcriptPiece);
                } else {
                  interim += transcriptPiece;
                }
              }
              if (interim) {
                setLiveInterimText(interim);
              }
            };

            recognition.onerror = (err: any) => {
              console.warn('[AmbientScribe] Speech Recognition warning:', err.error);
              if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
                setMicError('Microphone permission was denied. Allow microphone access in the browser to use the scribe, or type notes manually.');
                isListeningRef.current = false;
                setIsListening(false);
              } else if (err.error === 'network') {
                setMicError('Speech recognition needs a network connection on this browser. Type notes manually instead.');
              }
            };

            recognition.onend = () => {
              // Automatically restart if user is still in listening mode
              if (isListeningRef.current && recognitionRef.current) {
                try {
                  recognition.start();
                } catch (e) {
                  // Ignore if already started
                }
              }
            };

            recognition.start();
            recognitionRef.current = recognition;
          } catch (e) {
            console.warn('[AmbientScribe] Native speech recognition init failed:', e);
            setMicError('The microphone could not be started on this device.');
          }
        } else {
          setMicError('Live transcription is not supported in this browser (use Chrome or Edge). The audio meter still works.');
        }
      } else {
        // Simulated Autonomous OPD Stream
        unsubscribeWs = api.connectAmbientWs(
          (data) => {
            setTranscriptLines((prev) => [...prev, data]);
            sovereignSound('notch');
          },
          (err) => {
            console.error('Ambient WS error:', err);
          }
        );
      }
    } else {
      teardownWebAudioDSP();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
      setLiveInterimText('');
    }

    return () => {
      stopOnPrem.cancelled = true;
      stopOnPrem.resolve?.();
      teardownWebAudioDSP();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
      if (unsubscribeWs) unsubscribeWs();
    };
  }, [isListening, inputMode, micLanguage, acousticMode, onPremAsr]);

  const toggleListening = () => {
    sovereignSound(isListening ? 'shutter' : 'chime');
    if (!isListening) setMicError(null);
    setIsListening(!isListening);
  };



  const handleAcousticModeChange = (mode: AcousticMode) => {
    sovereignSound('notch');
    setAcousticMode(mode);
  };

  const handleAutoExtractClick = () => {
    sovereignSound('chime');
    const fullTranscript = transcriptLines.map(t => `${t.speaker}: ${t.text}`).join('\n') + (liveInterimText ? `\nPatient: ${liveInterimText}` : '');
    onAutoExtract(fullTranscript);
  };

  // Calculate VU meter percentage
  const vuPercentage = Math.min(100, Math.max(0, ((liveDbLevel + 60) / 60) * 100));

  return (
    <div
      className="card"
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            className={isListening ? 'live-dot' : ''}
            style={{
              background: isListening ? '#0f172a' : '#94a3b8',
              width: 8,
              height: 8,
              borderRadius: '50%'
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                Ambient Clinical Scribe
              </h3>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: '#0284c7',
                  background: '#e0f2fe',
                  padding: '2px 7px',
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3
                }}
              >
                <Ear size={11} />
                <span>Far-Field DSP</span>
              </span>
            </div>
          </div>
        </div>

        {/* Input & Acoustic Mode Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Acoustic Sensitivity Selector */}
          <select
            value={acousticMode}
            onChange={(e) => handleAcousticModeChange(e.target.value as AcousticMode)}
            disabled={isListening}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              borderRadius: 6,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              fontWeight: 600
            }}
            title="Acoustic tuning for room geometry"
          >
            <option value="far_field_cabin">Far-Field Cabin (+14dB)</option>
            <option value="whisper_boost">Ultra-Whisper Boost (+18dB)</option>
            <option value="standard">Standard Desk (+6dB)</option>
          </select>

          <select
            value={micLanguage}
            onChange={(e) => {
              sovereignSound('notch');
              setMicLanguage(e.target.value as any);
            }}
            disabled={isListening}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              borderRadius: 6,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a'
            }}
          >
            <option value="hi-IN">Hindi / Hinglish (hi-IN)</option>
            <option value="en-IN">Indian English (en-IN)</option>
          </select>
          <span
            title={onPremAsr ? 'Speech is transcribed on the hospital server; audio does not leave the premises.' : 'Speech is transcribed by the browser vendor’s cloud service.'}
            style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: onPremAsr ? '#ecfdf5' : '#fffbeb', color: onPremAsr ? '#047857' : '#92400e', border: `1px solid ${onPremAsr ? '#a7f3d0' : '#fde68a'}` }}
          >
            {onPremAsr ? 'On-premise speech' : 'Browser speech (cloud)'}
          </span>

          <button
            onClick={toggleListening}
            className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`}
            style={{ padding: '6px 14px', fontSize: 12, minHeight: 32, borderRadius: 8 }}
          >
            {isListening ? (
              <>
                <Square size={13} />
                <span>Stop Mic</span>
              </>
            ) : (
              <>
                <Mic size={13} />
                <span>Start Live Mic</span>
              </>
            )}
          </button>
        </div>
      </div>

      {micError && (
        <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600 }}>
          {micError}
        </div>
      )}

      {/* Live Acoustic Telemetry & VU Status HUD */}
      {isListening && inputMode === 'real_mic' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 11,
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          {/* Live VU Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
            <Activity size={13} color="#0284c7" />
            <span style={{ fontWeight: 600, color: '#475569', minWidth: 60 }}>
              {liveDbLevel > -65 ? `${liveDbLevel} dBFS` : 'Quiet'}
            </span>
            <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${vuPercentage}%`,
                  background:
                    vuPercentage > 80 ? '#ef4444' : vuPercentage > 50 ? '#10b981' : '#0ea5e9',
                  transition: 'width 0.08s ease'
                }}
              />
            </div>
          </div>

          {/* Telemetry Status Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                background: '#dcfce7',
                color: '#15803d',
                padding: '2px 6px',
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3
              }}
            >
              <Zap size={10} />
              <span>
                {acousticMode === 'whisper_boost' ? '+18dB Whisper Boost' : '+14dB Cabin DSP'}
              </span>
            </span>

            {isWhisperDetected && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: '#fef3c7',
                  color: '#b45309',
                  padding: '2px 6px',
                  borderRadius: 4
                }}
              >
                Soft Whisper Detected
              </span>
            )}

            <span
              style={{
                fontSize: 10,
                color: '#64748b',
                background: '#f1f5f9',
                padding: '2px 6px',
                borderRadius: 4
              }}
            >
              500ms Pre-Roll Zero-Drop
            </span>
          </div>
        </div>
      )}

      {/* Wave Visualizer */}
      <AudioVisualizer isRecording={isListening} color="#0f172a" />

      {/* Transcript Controls */}
      {transcriptLines.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
          <button
            onClick={() => {
              sovereignSound('notch');
              setTranscriptLines([]);
              setLiveInterimText('');
            }}
            style={{
              fontSize: 10.5,
              padding: '3px 8px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              cursor: 'pointer',
              color: '#64748b'
            }}
            title="Clear transcript"
          >
            Clear Live Transcript
          </button>
        </div>
      )}

      {/* Transcript Box */}
      <div
        ref={transcriptContainerRef}
        style={{
          background: '#f8fafc',
          borderRadius: 12,
          padding: 14,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          border: '1px solid #e2e8f0',
          maxHeight: 260,
          minHeight: 150,
          scrollBehavior: 'smooth'
        }}
      >
        {transcriptLines.length === 0 && !liveInterimText && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
            <Mic size={26} style={{ margin: '0 auto 8px auto', opacity: 0.6, color: '#0284c7' }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
              Far-Field Ambient Consultation Scribe Active
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
              Click &quot;Start Live Mic&quot; and speak into your room microphone to begin live acoustic consultation transcription.
            </div>
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 6 }}>
              • High-pass rumble filter active • Soft-knee whisper compressor • 500ms pre-roll zero-drop buffer
            </div>
          </div>
        )}

        {transcriptLines.map((line, idx) => {
          const isDoctor = line.speaker.includes('Doctor');
          const isLatest = idx === transcriptLines.length - 1 && !liveInterimText;
          const entities = scribeChips(line.text);

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isDoctor ? 'flex-end' : 'flex-start',
                transition: 'all 0.25s ease',
                opacity: isLatest ? 1 : 0.88
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: isDoctor ? '#0f172a' : '#0369a1',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                >
                  {isDoctor ? <Stethoscope size={11} /> : <User size={11} />}
                  <span>{line.speaker}</span>
                </span>
                <span style={{ fontSize: 9.5, color: '#94a3b8' }}>{line.timestamp}</span>
                {line.isWhisper && (
                  <span style={{ fontSize: 9, color: '#d97706', fontWeight: 600 }}>[Whisper Boosted]</span>
                )}
              </div>
              <div
                style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  fontSize: 13,
                  lineHeight: 1.55,
                  background: isDoctor ? '#f1f5f9' : '#ffffff',
                  border: isDoctor ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                  color: '#0f172a',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}
              >
                {line.text}
              </div>

              {/* Recognized Clinical Entity Capsules */}
              {entities.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    marginTop: 5,
                    justifyContent: isDoctor ? 'flex-end' : 'flex-start'
                  }}
                >
                  {entities.map((ent, eIdx) => (
                    <span
                      key={eIdx}
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        background: CHIP_STYLE[ent.kind].bg,
                        border: `1px solid ${CHIP_STYLE[ent.kind].border}`,
                        color: CHIP_STYLE[ent.kind].fg,
                        textDecoration: ent.kind === 'denied' ? 'line-through' : undefined,
                        padding: '2px 8px',
                        borderRadius: 6,
                        letterSpacing: '+0.01em'
                      }}
                    >
                      {ent.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Live Interim In-Progress Speech Line */}
        {liveInterimText && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Activity size={11} />
                <span>Capturing speech...</span>
              </span>
            </div>
            <div
              style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: 12,
                fontSize: 13,
                lineHeight: 1.55,
                background: '#f0f9ff',
                border: '1px dashed #0284c7',
                color: '#0369a1',
                fontStyle: 'italic'
              }}
            >
              {liveInterimText}
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <CheckCircle2 size={13} color="#16a34a" style={{ flexShrink: 0 }} />
          <span>Bilingual Whisper & Far-Field DSP Active</span>
        </span>

        <button
          onClick={handleAutoExtractClick}
          className="btn btn-secondary"
          style={{
            padding: '5px 12px',
            fontSize: 11.5,
            minHeight: 28,
            gap: 5,
            color: '#0f172a',
            borderColor: '#cbd5e1',
            background: '#ffffff'
          }}
        >
          <Sparkles size={12} color="#0f172a" />
          <span>Auto-Populate Rx</span>
        </button>
      </div>
    </div>
  );
};
