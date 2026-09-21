import { sovereignSound } from './audio';

export class SovereignVoiceEngine {
  private voices: SpeechSynthesisVoice[] = [];
  private isInitialized = false;

  constructor() {
    this.initVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.initVoices();
      };
    }
  }

  private initVoices() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const availableVoices = window.speechSynthesis.getVoices();
    if (availableVoices.length > 0) {
      this.voices = availableVoices;
      this.isInitialized = true;
    }
  }

  /**
   * Evaluates available voices and selects the most premium, natural, non-robotic voice for a given language tag.
   */
  private getBestVoice(langTag: string): SpeechSynthesisVoice | null {
    if (!this.isInitialized) {
      this.initVoices();
    }
    
    // Exact language filter or prefix filter (e.g. 'hi' matches 'hi-IN')
    const localePrefix = langTag.split('-')[0].toLowerCase();
    
    const candidates = this.voices.filter(v => 
      v.lang.toLowerCase().startsWith(localePrefix)
    );

    if (candidates.length === 0) return null;

    // Voice Scoring Heuristics
    // We heavily prioritize Neural, Google, Online, and Enhanced/Premium voices over Desktop mechanical ones.
    const scoreVoice = (v: SpeechSynthesisVoice) => {
      let score = 0;
      const nameLower = v.name.toLowerCase();

      // High Quality Indicators
      if (nameLower.includes('google')) score += 100;
      if (nameLower.includes('natural')) score += 100;
      if (nameLower.includes('online')) score += 90;
      if (nameLower.includes('neural')) score += 90;
      if (nameLower.includes('premium')) score += 80;
      if (nameLower.includes('enhanced')) score += 80;
      if (nameLower.includes('siri')) score += 70;
      
      // Female/Warm Clinical Tone Priority (Often named Female, Swara, Neerja, Lekha, etc.)
      if (nameLower.includes('female')) score += 30;
      if (nameLower.includes('swara') || nameLower.includes('neerja') || nameLower.includes('lekha')) score += 50;

      // Penalize Robotic/Desktop Voices
      if (nameLower.includes('desktop')) score -= 200;
      if (nameLower.includes('espeak')) score -= 500;
      if (nameLower.includes('david') || nameLower.includes('zira') || nameLower.includes('hazel')) score -= 150;
      if (nameLower.includes('robotic')) score -= 500;

      // Exact match for the full region code gets a boost
      if (v.lang.toLowerCase() === langTag.toLowerCase()) score += 20;

      return score;
    };

    // Sort by descending score
    const ranked = candidates.map(v => ({ voice: v, score: scoreVoice(v) }))
                             .sort((a, b) => b.score - a.score);
                             
    return ranked[0]?.voice || candidates[0];
  }

  public speak(text: string, langCode: string, onEnd?: () => void, onError?: () => void) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // Interrupt any ongoing speech

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Map short codes (hi, en, mr, etc.) to full BCP-47 for better voice matching
    const bcp47 = langCode === 'hi' ? 'hi-IN' : 
                  langCode === 'en' ? 'en-IN' : 
                  langCode === 'mr' ? 'mr-IN' : 
                  langCode === 'ta' ? 'ta-IN' : 
                  langCode === 'te' ? 'te-IN' : 
                  langCode === 'bn' ? 'bn-IN' : langCode;
                  
    utterance.lang = bcp47;
    
    // Clinical Acoustic Warmth Overrides
    // Natural human conversational pitch is slightly elevated (1.04) and rate is 1.02.
    utterance.pitch = 1.04;
    utterance.rate = 1.02;

    // Attach highest-scoring natural voice
    const bestVoice = this.getBestVoice(bcp47);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.onend = () => { if (onEnd) onEnd(); };
    utterance.onerror = () => { if (onError) onError(); };

    // Pre-Roll Acoustic Chime: Plays 200ms before speech synthesis begins
    // to prime the patient's ear gently.
    sovereignSound.playCrystalChime();
    
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 250); // Give the chime a split second to resonate
  }

  public stop() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

export const sovereignVoice = new SovereignVoiceEngine();
