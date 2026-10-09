/**
 * Desk sounds. Off by default: in a busy OPD, a sound on every click is noise and trains people to
 * ignore sound — including the SOS alarm. Emergencies always sound; everything else only when the
 * doctor turns sounds on (stored per browser).
 */
import { sovereignSound } from './audio';

const KEY = 'desk_sounds';

export const soundsEnabled = (): boolean => {
  try { return localStorage.getItem(KEY) === 'on'; } catch { return false; }
};
export const setSoundsEnabled = (on: boolean) => {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {}
};

export function playSound(kind: 'emergency' | 'success' | 'alert' | 'tick') {
  try {
    if (kind === 'emergency') { sovereignSound.playEmergencyCodeRed(); return; }
    if (!soundsEnabled()) return;
    if (kind === 'success') sovereignSound.playCrystalChime();
    else if (kind === 'alert') sovereignSound.playClinicalAlert();
    else sovereignSound.playDialNotch();
  } catch { /* audio unavailable */ }
}
