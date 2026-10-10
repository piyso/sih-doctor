/**
 * Look-alike / sound-alike generic names with their "tall man" (mixed-case) spellings, from the US FDA
 * Name Differentiation Project and the ISMP list of look-alike drug names with recommended tall man
 * letters. A picking aid for the pharmacy counter: it is a fixed list of name groups, nothing more —
 * it does not check doses, interactions or brand names, and a name that is not listed here is not
 * thereby "safe from confusion".
 */
const GROUPS: string[][] = [
  // FDA Name Differentiation Project
  ['acetaZOLAMIDE', 'acetoHEXAMIDE'],
  ['buPROPion', 'busPIRone'],
  ['chlorproMAZINE', 'chlorproPAMIDE'],
  ['clomiPHENE', 'clomiPRAMINE'],
  ['cycloSERINE', 'cycloSPORINE'],
  ['DAUNOrubicin', 'DOXOrubicin'],
  ['dimenhyDRINATE', 'diphenhydrAMINE'],
  ['DOBUTamine', 'DOPamine'],
  ['glipiZIDE', 'glyBURIDE'],
  ['hydrALAZINE', 'hydrOXYzine', 'hydroCHLOROthiazide'],
  ['medroxyPROGESTERone', 'methylPREDNISolone', 'methylTESTOSTERone'],
  ['niCARdipine', 'NIFEdipine'],
  ['prednisoLONE', 'predniSONE'],
  ['sulfADIAZINE', 'sulfiSOXAZOLE'],
  ['TOLAZamide', 'TOLBUTamide'],
  ['vinBLAStine', 'vinCRIStine'],
  // ISMP additions
  ['ALPRAZolam', 'LORazepam'],
  ['clonazePAM', 'cloNIDine', 'cloZAPine'],
  ['aMILoride', 'amLODIPine'],
  ['ARIPiprazole', 'RABEprazole'],
  ['azaCITIDine', 'azaTHIOprine'],
  ['carBAMazepine', 'OXcarbazepine'],
  ['CARBOplatin', 'CISplatin'],
  ['ceFAZolin', 'cefoTEtan', 'cefOXitin', 'cefTAZidime', 'cefTRIAXone'],
  ['DOCEtaxel', 'PACLitaxel'],
  ['DULoxetine', 'FLUoxetine', 'PARoxetine'],
  ['ePHEDrine', 'EPINEPHrine'],
  ['fentaNYL', 'SUFentanil'],
  ['guaiFENesin', 'guanFACINE'],
  ['HYDROmorphone', 'morphine'],
  ['lamiVUDine', 'lamoTRIgine'],
  ['levETIRAcetam', 'levoFLOXacin'],
  ['metFORMIN', 'metroNIDAZOLE'],
  ['niMODipine', 'NIFEdipine'],
  ['PENTobarbital', 'PHENobarbital'],
  ['quiNIDine', 'quiNINE'],
  ['raNITIdine', 'riMANTAdine'],
  ['risperiDONE', 'rOPINIRole'],
  ['sAXagliptin', 'SITagliptin'],
  ['SUMAtriptan', 'ZOLMitriptan'],
  ['tiaGABine', 'tiZANidine'],
  ['traMADol', 'traZODone'],
  ['valACYclovir', 'valGANciclovir']
];

export interface LookAlike {
  /** The prescribed name in tall-man letters, e.g. "hydrOXYzine". */
  tallMan: string;
  /** The names it is confused with, in tall-man letters. */
  confusedWith: string[];
}

const INDEX = new Map<string, LookAlike>();
for (const group of GROUPS) {
  for (const name of group) {
    const key = name.toLowerCase();
    const others = group.filter(x => x !== name);
    const prev = INDEX.get(key);
    INDEX.set(key, { tallMan: name, confusedWith: prev ? Array.from(new Set([...prev.confusedWith, ...others])) : others });
  }
}

/** The first listed look-alike name found in any of the given names (generic first, then as written). */
export function lookAlike(...names: Array<string | undefined | null>): LookAlike | null {
  for (const raw of names) {
    for (const word of String(raw || '').toLowerCase().split(/[^a-z]+/)) {
      const hit = word.length > 4 ? INDEX.get(word) : undefined;
      if (hit) return hit;
    }
  }
  return null;
}
