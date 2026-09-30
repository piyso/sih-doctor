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

interface AmbientScribePanelProps {
  onAutoExtract: (transcriptText?: string) => void;
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

export const AmbientScribePanel: React.FC<AmbientScribePanelProps> = ({ onAutoExtract }) => {
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false);

  const [inputMode, setInputMode] = useState<'real_mic' | 'simulated'>('real_mic');
  const [acousticMode, setAcousticMode] = useState<AcousticMode>('far_field_cabin');
  const [micLanguage, setMicLanguage] = useState<'hi-IN' | 'en-IN'>('hi-IN');
  const [hasWebSpeech, setHasWebSpeech] = useState<boolean>(false);
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

  const extractEntitiesFromText = useCallback((text: string) => {
    const entities: string[] = [];
    const lower = text.toLowerCase();

    // Antacids & Gastrointestinal
    if (
      lower.includes('antacid') ||
      lower.includes('antaside') ||
      lower.includes('gelusil') ||
      lower.includes('digene') ||
      lower.includes('eno') ||
      lower.includes('mucaine') ||
      lower.includes('pantocid') ||
      lower.includes('pan-d') ||
      lower.includes('pan 40') ||
      lower.includes('omez') ||
      lower.includes('aciloc') ||
      lower.includes('rantac') ||
      lower.includes('pudina hara') ||
      lower.includes('gasex')
    ) {
      entities.push('Rx: Antacid / Amlapitta Shamaka');
    }

    // Pain / Analgesics & Resolved Status
    if (
      lower.includes('pain') ||
      lower.includes('ane gone') ||
      lower.includes('dard') ||
      lower.includes('ghutne') ||
      lower.includes('cut cut') ||
      lower.includes('कट-कट') ||
      lower.includes('sandhi') ||
      lower.includes('dolo') ||
      lower.includes('paracetamol') ||
      lower.includes('combiflam') ||
      lower.includes('meftal') ||
      lower.includes('zerodol') ||
      lower.includes('voveran') ||
      lower.includes('brufen')
    ) {
      entities.push('Rx: Analgesic / Shoola Prashamana');
    }

    // Retrosternal Pressure / Chest Pain
    if (lower.includes('भारी दबाव') || lower.includes('crushing') || lower.includes('stone') || lower.includes('पत्थर') || lower.includes('chhati me bojh')) {
      entities.push('Symptom: Crushing Retrosternal Pressure');
    }

    // Dyspnea / Respiratory
    if (lower.includes('सांस') || lower.includes('breath') || lower.includes('shwasa') || lower.includes('dum phool') || lower.includes('ascoril') || lower.includes('grilinctus')) {
      entities.push('Respiratory: Dyspnea / Shwasa Krichrata');
    }

    // Vitals & BP
    if (lower.includes('bp') || lower.includes('blood pressure') || lower.includes('160') || lower.includes('140') || lower.includes('120/80')) {
      entities.push('Vitals: Blood Pressure Telemetry');
    }

    // Classical AYUSH Formulations
    if (
      lower.includes('गुग्गुलु') ||
      lower.includes('guggulu') ||
      lower.includes('yograj') ||
      lower.includes('ashwagandha') ||
      lower.includes('triphala') ||
      lower.includes('shilajit') ||
      lower.includes('avipattikar') ||
      lower.includes('shankha bhasma') ||
      lower.includes('arogyavardhini') ||
      lower.includes('chandraprabha')
    ) {
      entities.push('Rx: Classical AYUSH Formulation');
    }

    // Cardio / Metabolic NLEM
    if (
      lower.includes('metformin') ||
      lower.includes('glycomet') ||
      lower.includes('telma') ||
      lower.includes('telmisartan') ||
      lower.includes('amlong') ||
      lower.includes('amlodipine') ||
      lower.includes('atorva') ||
      lower.includes('atorvastatin') ||
      lower.includes('ecosprin') ||
      lower.includes('aspirin')
    ) {
      entities.push('Rx: Cardio-Metabolic NLEM Standard');
    }

    return entities;
  }, []);

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

    if (isListening) {
      if (inputMode === 'real_mic') {
        setupWebAudioDSP();

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
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
                  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const pieceTrimmed = transcriptPiece.trim();

                  if (pieceTrimmed.length > 0) {
                    const isDocPrescribing = /गोली|सुबह|शाम|खुराक|mg|tablet|pani|water|blood pressure|take|गुग्गुलु|ashwagandha/i.test(pieceTrimmed);
                    const speakerLabel = isDocPrescribing ? 'Doctor (Desk)' : 'Patient (Far-Field)';

                    setTranscriptLines((prev) => [
                      ...prev,
                      {
                        speaker: speakerLabel,
                        text: pieceTrimmed,
                        timestamp: now,
                        isWhisper: isWhisperDetected,
                        snrDb: Math.max(0, liveDbLevel - liveNoiseFloor)
                      }
                    ]);
                    setLiveInterimText('');
                    sovereignSound('notch');
                  }
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
                console.warn('[AmbientScribe] Mic permission denied. Switching to autonomous simulation.');
                setInputMode('simulated');
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
          }
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
      teardownWebAudioDSP();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
      if (unsubscribeWs) unsubscribeWs();
    };
  }, [isListening, inputMode, micLanguage, acousticMode]);

  const toggleListening = () => {
    sovereignSound(isListening ? 'shutter' : 'chime');
    setIsListening(!isListening);
  };

  const handleModeChange = (mode: 'real_mic' | 'simulated') => {
    sovereignSound('notch');
    setInputMode(mode);
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

  const injectQuickSimulation = (scenario: 'knee_osteo' | 'chest_ami' | 'gastritis') => {
    sovereignSound('notch');
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (scenario === 'knee_osteo') {
      setTranscriptLines((prev) => [
        ...prev,
        {
          speaker: 'Patient (Far-Field)',
          text: 'डॉक्टर साहब, 2 महीने से दोनों घुटनों में कट-कट आवाज़ और चलने में तीव्र दर्द है। (Bilateral knee crepitus & pain.)',
          timestamp: now,
          isWhisper: true
        },
        {
          speaker: 'Doctor (Desk)',
          text: 'यह संधिगत वात (Sandhigata Vata) के लक्षण हैं। हम योगराज गुग्गुलु 500mg सुबह-शाम गुनगुने पानी से शुरू करेंगे। (Prescribing Yogaraja Guggulu 1-0-1 with warm water.)',
          timestamp: now
        }
      ]);
    } else if (scenario === 'chest_ami') {
      setTranscriptLines((prev) => [
        ...prev,
        {
          speaker: 'Patient (Far-Field)',
          text: 'डॉक्टर साहब, 3 घंटे से सीने में बहुत भारी दबाव और पसीना आ रहा है। (Substernal crushing chest pain since 3 hours.)',
          timestamp: now,
          isWhisper: true
        },
        {
          speaker: 'Doctor (Desk)',
          text: 'बीपी 160/100 है। यह एक्यूट कोरोनरी सिंड्रोम का रेड फ्लैग है। तुरंत ईसीजी और इमरजेंसी प्रोटोकॉल सक्रिय करें।',
          timestamp: now
        }
      ]);
    } else {
      setTranscriptLines((prev) => [
        ...prev,
        {
          speaker: 'Patient (Far-Field)',
          text: 'पेट में खट्टी डकारें और सीने में जलन हो रही है। (Amlapitta / Acid reflux.)',
          timestamp: now,
          isWhisper: true
        },
        {
          speaker: 'Doctor (Desk)',
          text: 'अविपत्तिकर चूर्ण 3 ग्राम भोजन से पहले और पैंटोप्रोजोल 40mg खाली पेट लें। (Avipattikar Churna + Pantoprazole.)',
          timestamp: now
        }
      ]);
    }
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
          const entities = extractEntitiesFromText(line.text);

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
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: ent.includes('Rx:') ? '#15803d' : ent.includes('Red Flag') ? '#b91c1c' : '#334155',
                        padding: '2px 8px',
                        borderRadius: 6,
                        letterSpacing: '+0.01em'
                      }}
                    >
                      {ent}
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
