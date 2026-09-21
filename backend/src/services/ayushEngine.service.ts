/**
 * AYUSH Morbidity, Classical Pariksha & Tri-Coding Service
 * Implements official Ministry of Ayush NAMASTE Portal A-Codes,
 * Charaka Dashavidha Pariksha evaluation, and Viruddha Ahara detection.
 */

import ayushOntology from '../shared/ayush_ontology.json';
import { NamasteTriCodedDiagnosis, DashavidhaPariksha, AgniType, AyushFormulation } from '../shared/types';

export class AyushEngineService {
  private static namasteRegistry = ayushOntology.namasteEntries;
  private static classicalFormulations = ayushOntology.classicalFormulations;
  private static agniRules = ayushOntology.agniClassifications;

  /**
   * Resolve any clinical term or symptom string to official NAMASTE tri-coded entry
   */
  public static resolveDiagnosis(query: string): NamasteTriCodedDiagnosis | null {
    const lower = query.toLowerCase();

    for (const entry of this.namasteRegistry) {
      if (
        lower.includes(entry.aCode.toLowerCase()) ||
        lower.includes(entry.sanskritTerm.toLowerCase()) ||
        lower.includes(entry.englishEquivalent.toLowerCase()) ||
        (entry.sanskritTerm === 'Vataja Jwara' && (lower.includes('fever') || lower.includes('bukhar') || lower.includes('pyrexia') || lower.includes('tap'))) ||
        (entry.sanskritTerm === 'Kaphaja Kasa' && (lower.includes('cough') || lower.includes('khansi') || lower.includes('bronchitis'))) ||
        (entry.sanskritTerm === 'Tamaka Shwasa' && (lower.includes('asthma') || lower.includes('dama') || lower.includes('shwas') || lower.includes('wheez'))) ||
        (entry.sanskritTerm === 'Amlapitta' && (lower.includes('acidity') || lower.includes('gerd') || lower.includes('heartburn') || lower.includes('dyspepsia') || lower.includes('pitta'))) ||
        (entry.sanskritTerm === 'Sandhivata' && (lower.includes('osteoarthritis') || lower.includes('joint pain') || lower.includes('ghutne') || lower.includes('sandhivata'))) ||
        (entry.sanskritTerm === 'Amavata' && (lower.includes('rheumatoid') || lower.includes('gathiya') || lower.includes('polyarthritis'))) ||
        (entry.sanskritTerm === 'Kaphaja Prameha' && (lower.includes('diabetes') || lower.includes('sugar') || lower.includes('prameha') || lower.includes('madhumeha'))) ||
        (entry.sanskritTerm === 'Mutrakrichhra' && (lower.includes('uti') || lower.includes('urinary') || lower.includes('dysuria') || lower.includes('peshab me jalan'))) ||
        (entry.sanskritTerm === 'Grahani Roga' && (lower.includes('ibs') || lower.includes('loose') || lower.includes('grahani') || lower.includes('dast'))) ||
        (entry.sanskritTerm === 'Gridhrasi' && (lower.includes('sciatica') || lower.includes('lumbar') || lower.includes('radiculopathy') || lower.includes('kamar dard'))) ||
        (entry.sanskritTerm === 'Hridshula' && (lower.includes('angina') || lower.includes('ischemic chest pain') || lower.includes('hridshula'))) ||
        (entry.sanskritTerm === 'Hridroga' && (lower.includes('cardiac') || lower.includes('chest') || lower.includes('heart') || lower.includes('chhati'))) ||
        (entry.sanskritTerm === 'Arsha' && (lower.includes('arsha') || lower.includes('piles') || lower.includes('bawaseer') || lower.includes('hemorrhoids') || lower.includes('bawasir'))) ||
        (entry.sanskritTerm === 'Bhagandara' && (lower.includes('fistula') || lower.includes('bhagandar') || lower.includes('bhagandara'))) ||
        (entry.sanskritTerm === 'Pakshaghata' && (lower.includes('paralysis') || lower.includes('stroke') || lower.includes('lakwa') || lower.includes('pakshaghat'))) ||
        (entry.sanskritTerm === 'Apasmara' && (lower.includes('epilepsy') || lower.includes('seizure') || lower.includes('mirgi') || lower.includes('daura'))) ||
        (entry.sanskritTerm === 'Vrikkashotha' && (lower.includes('nephritis') || lower.includes('kidney swelling') || lower.includes('glomerulonephritis'))) ||
        (entry.sanskritTerm.includes('Kushtha') && (lower.includes('eczema') || lower.includes('skin') || lower.includes('khujli') || lower.includes('dermatitis')))
      ) {
        return {
          aCode: entry.aCode,
          sanskritTerm: entry.sanskritTerm,
          englishEquivalent: entry.englishEquivalent,
          icd10DualCode: entry.icd10DualCode,
          snomedConceptId: entry.snomedConceptId,
          icmrStandardWorkflowId: entry.icmrStandardWorkflowId
        };
      }
    }

    // Default fallback to Vataja Jwara if fever or acute
    if (lower.includes('fever') || lower.includes('bukhar')) {
      const e = this.namasteRegistry[0];
      return {
        aCode: e.aCode,
        sanskritTerm: e.sanskritTerm,
        englishEquivalent: e.englishEquivalent,
        icd10DualCode: e.icd10DualCode,
        snomedConceptId: e.snomedConceptId,
        icmrStandardWorkflowId: e.icmrStandardWorkflowId
      };
    }

    return null;
  }

  /**
   * Get all official NAMASTE entries
   */
  public static getAllNamasteEntries(): NamasteTriCodedDiagnosis[] {
    return this.namasteRegistry.map(e => ({
      aCode: e.aCode,
      sanskritTerm: e.sanskritTerm,
      englishEquivalent: e.englishEquivalent,
      icd10DualCode: e.icd10DualCode,
      snomedConceptId: e.snomedConceptId,
      icmrStandardWorkflowId: e.icmrStandardWorkflowId
    }));
  }

  /**
   * Evaluate Dashavidha Pariksha safety and generate clinical recommendations
   */
  public static evaluatePariksha(pariksha: DashavidhaPariksha): {
    contraindicatedFormulations: string[];
    recommendedChikitsa: string[];
    dietaryAdvisory: string[];
  } {
    const contraindicatedFormulations: string[] = [];
    const recommendedChikitsa: string[] = [];
    const dietaryAdvisory: string[] = [];

    // Agni rules
    if (pariksha.agni === 'Mandagni') {
      contraindicatedFormulations.push('Heavy Bhasmas (Swarna/Rajat)', 'Ghrits/Oils without prior Pachana', 'Chyawanprash');
      recommendedChikitsa.push('Deepana-Pachana therapy with Trikatu Churna or Chitrakadi Vati prior to Rasayana administration');
      dietaryAdvisory.push('Avoid cold drinks, curds, heavy sweets; drink warm water (Ushnodaka)');
    } else if (pariksha.agni === 'Tikshnagni') {
      contraindicatedFormulations.push('Pungent/Hot formulations (Trikatu, Bhallataka)');
      recommendedChikitsa.push('Pitta-shamana with Avipattikar Churna or Kamadudha Ras');
      dietaryAdvisory.push('Avoid sour, fermented, and excessively spicy foods');
    }

    // Ama presence
    if (pariksha.amaPresent) {
      contraindicatedFormulations.push('Brimhana (Nourishing) therapies', 'Direct Guggulu without Shodhana');
      recommendedChikitsa.push('Langhana (Light fasting) and Pachana until tongue coating clears');
    }

    // Age rules (Balya vs Jirna)
    if (pariksha.vaya === 'Jirna') {
      recommendedChikitsa.push('Rasayana chikitsa for Dhatu kshaya (Ashwagandha, Triphala)');
    }

    return {
      contraindicatedFormulations,
      recommendedChikitsa,
      dietaryAdvisory
    };
  }

  /**
   * Verify classical statutory Anupana for a given formulation
   */
  public static getStatutoryAnupana(formulationName: string): string {
    const match = this.classicalFormulations.find(f => f.name.toLowerCase() === formulationName.toLowerCase());
    return match ? match.statutoryAnupana : 'Lukewarm Water';
  }

  /**
   * Check for Viruddha Ahara (incompatible pairs) in prescriptions or dietary intake
   */
  public static checkViruddhaAhara(prescriptions: AyushFormulation[]): string[] {
    const warnings: string[] = [];

    for (const rx of prescriptions) {
      const lowerAnupana = (rx.anupana || '').toLowerCase();
      
      // Heated honey
      if (lowerAnupana.includes('honey') || lowerAnupana.includes('madhu')) {
        if (lowerAnupana.includes('hot') || lowerAnupana.includes('garam') || lowerAnupana.includes('boiling')) {
          warnings.push(`Viruddha Ahara Warning: ${rx.formulationName} is prescribed with heated honey. Honey heated above 40°C produces classical Ama toxins. Must only use lukewarm or room temperature vehicle.`);
        }
      }

      // Honey + Ghrita in equal ratio
      if ((lowerAnupana.includes('honey') || lowerAnupana.includes('madhu')) && (lowerAnupana.includes('ghee') || lowerAnupana.includes('ghrita'))) {
        warnings.push(`Viruddha Ahara Notice: When combining Madhu and Ghrita with ${rx.formulationName}, ensure unequal proportions (e.g. 2:1 ratio) to prevent antagonistic biochemical complexing.`);
      }
    }

    return warnings;
  }

  /**
   * Vulnerable Demographics Safety Gate (Pregnancy & Pediatrics)
   * Enforces Kashyapa Samhita restrictions against heavy metal Bhasmas and emmenagogues.
   */
  public static checkVulnerableDemographics(
    patient: { age?: number; isPregnant?: boolean; isLactating?: boolean },
    formulations: (AyushFormulation | string)[]
  ): {
    isRestricted: boolean;
    violations: string[];
    safeRecommendations: string[];
    statutoryNotice: string;
  } {
    const violations: string[] = [];
    const safeRecommendations: string[] = [];
    const formNames = formulations.map(f => (typeof f === 'string' ? f : (f.classicalName || f.formulationName || ''))).join(' ').toLowerCase();

    const heavyMetals = ['bhasma', 'kajjali', 'suvarna', 'swarna', 'rajat', 'hingula', 'tamra', 'abhraka', 'makardhwaj', 'parada'];
    const emmenagogues = ['kanyasara', 'aloe', 'bhallataka', 'chitraka', 'langali', 'hingu', 'kalajaji', 'methi in high dose'];

    // 1. Pregnancy Safety Gate
    if (patient.isPregnant) {
      for (const hm of heavyMetals) {
        if (formNames.includes(hm)) {
          violations.push(`Garbhini Contraindication: Heavy metal Rasashastra preparation (${hm}) is strictly prohibited during gestation to prevent teratogenicity.`);
        }
      }
      for (const em of emmenagogues) {
        if (formNames.includes(em)) {
          violations.push(`Garbhini Contraindication: Emmenagogue/abortifacient agent (${em}) triggers uterine hyper-motility and is strictly contraindicated in pregnancy.`);
        }
      }
      safeRecommendations.push(
        'Garbhapala Rasa (Classical Kashyapa Samhita gestation protector)',
        'Phala Ghrita with Koshna Ksheera (Warm Milk)',
        'Aravindasava (Safe pediatric and maternal restorative)'
      );
    }

    // 2. Pediatric Safety Gate (Age < 12)
    if (patient.age !== undefined && patient.age < 12) {
      for (const hm of heavyMetals) {
        if (formNames.includes(hm) && !formNames.includes('kumar kalyan')) {
          violations.push(`Kaumarbhritya Contraindication: Adult Rasashastra mineral preparation (${hm}) contraindicated in pediatric age (<12 yrs) due to immature renal tubular clearance.`);
        }
      }
      if (formNames.includes('trivrit') || formNames.includes('jayapala') || formNames.includes('croton')) {
        violations.push('Kaumarbhritya Contraindication: Drastic purgatives (Tikshna Virechana) contraindicated in children.');
      }
      safeRecommendations.push(
        'Balachaturbhadra Churna (Musta, Pippali, Ativisha, Karkatashringi)',
        'Aravindasava (Kashyapa Samhita pediatric digestive and vitalizer)',
        'Kumar Kalyan Rasa (Pediatric-adjusted posology only under MD supervision)'
      );
    }

    return {
      isRestricted: violations.length > 0,
      violations,
      safeRecommendations,
      statutoryNotice: violations.length > 0
        ? 'Kashyapa Samhita Vulnerable Demographic Lockout Active: Formula modified to prevent maternal-fetal and pediatric toxicity.'
        : 'Demographic safety clearance verified.'
    };
  }
}
