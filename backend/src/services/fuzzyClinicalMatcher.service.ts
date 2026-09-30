/**
 * Fuzzy Clinical Entity Matcher & Vernacular Posology Service
 * Designed for noisy, degraded OCR streams from Indian OPD prescriptions.
 * 
 * Features:
 * 1. Damerau-Levenshtein distance matching against Allopathic & Ayush pharmacopoeias
 * 2. Autocorrection of character-level OCR substitutions (e.g. '0' for 'o', 'rn' for 'm', 'q' for 'g')
 * 3. Devanagari numeral translation (०-९ -> 0-9)
 * 4. Hindi vernacular posology extraction (सुबह-शाम, खाने के बाद, उष्णोदक / गुनगुने पानी)
 */

export interface FuzzyMatchResult {
  matched: boolean;
  canonicalName?: string;
  originalToken: string;
  distance: number;
  confidence: number;
  category: 'ALLOPATHIC' | 'AYUSH' | 'UNKNOWN';
}

export class FuzzyClinicalMatcherService {
  // Comprehensive Canonical Allopathic Formulary (Indian OPD Standards)
  private static readonly CANONICAL_ALLOPATHIC: string[] = [
    // Cardiovascular & Antihypertensives
    'Atorvastatin', 'Rosuvastatin', 'Amlodipine', 'Telmisartan', 'Losartan',
    'Ramipril', 'Enalapril', 'Metoprolol', 'Atenolol', 'Carvedilol',
    'Clopidogrel', 'Aspirin', 'Warfarin', 'Digoxin', 'Nitroglycerin',
    'Spironolactone', 'Furosemide', 'Torsemide', 'Hydrochlorothiazide',
    
    // Endocrine & Diabetes
    'Metformin', 'Glimepiride', 'Gliclazide', 'Teneligliptin', 'Sitagliptin',
    'Vildagliptin', 'Dapagliflozin', 'Empagliflozin', 'Pioglitazone',
    'Levothyroxine', 'Insulin Glargine', 'Human Regular Insulin',
    
    // Gastrointestinal
    'Pantoprazole', 'Omeprazole', 'Rabeprazole', 'Esomeprazole', 'Ranitidine',
    'Domperidone', 'Ondansetron', 'Sucralfate', 'Lactulose',
    
    // Analgesics & Anti-inflammatory
    'Paracetamol', 'Ibuprofen', 'Diclofenac', 'Aceclofenac', 'Tramadol',
    'Naproxen', 'Piroxicam', 'Prednisolone', 'Methylprednisolone',
    
    // Antimicrobials & Anti-infectives
    'Amoxicillin', 'Amoxicillin-Clavulanate', 'Azithromycin', 'Ciprofloxacin',
    'Levofloxacin', 'Cefixime', 'Ceftriaxone', 'Doxycycline', 'Metronidazole',
    'Norfloxacin', 'Nitrofurantoin', 'Fluconazole', 'Albendazole',
    
    // Respiratory & Antiallergic
    'Salbutamol', 'Levocetirizine', 'Cetirizine', 'Montelukast', 'Budesonide',
    'Formoterol', 'Deriphyllin', 'Fexofenadine'
  ];

  // Comprehensive Canonical Ayush Formulary (Ayurvedic Formulary of India - AFI)
  private static readonly CANONICAL_AYUSH: string[] = [
    // Guggulu Formulations
    'Yogaraja Guggulu', 'Kaishore Guggulu', 'Kanchanara Guggulu', 'Gokshuradi Guggulu',
    'Triphala Guggulu', 'Punarnavadi Guggulu', 'Mahayograj Guggulu', 'Simhanada Guggulu',
    'Amritadi Guggulu', 'Lakshadi Guggulu', 'Trayodashanga Guggulu',
    
    // Vati & Gutika (Pills / Tablets)
    'Chandraprabha Vati', 'Arogyavardhini Vati', 'Sanjivani Vati', 'Chitrakadi Vati',
    'Shankha Vati', 'Khadiradi Vati', 'Brahmi Vati', 'Lashunadi Vati', 'Kutajghan Vati',
    'Sarpagandha Ghan Vati', 'Kamadudha Rasa', 'Sudarshana Vati', 'Eladi Vati',
    
    // Churna (Classical Herbal Powders)
    'Triphala Churna', 'Trikatu Churna', 'Sitopaladi Churna', 'Avipattikar Churna',
    'Ashwagandha Churna', 'Hingwashtak Churna', 'Mahasudarshana Churna', 'Yashtimadhu Churna',
    'Shatavari Churna', 'Lavan Bhaskar Churna', 'Pushyanug Churna', 'Talishadi Churna',
    
    // Asava & Arishta (Fermented Decoctions)
    'Draksharishta', 'Dashamularishta', 'Ashokarishta', 'Balarishta', 'Arvindasava',
    'Punarnavasava', 'Lohasava', 'Kutajarishta', 'Arjunarishta', 'Saraswatarishta',
    
    // Rasayana & Avaleha (Medicated Jams / Tonics)
    'Chyawanprash', 'Brahma Rasayana', 'Vasavaleha', 'Kantakaryavaleha', 'Agastya Haritaki',
    
    // Bhasma & Ras Aushadhi (Herbo-Mineral Preparations)
    'Swarna Bhasma', 'Tamra Bhasma', 'Shankha Bhasma', 'Praval Pishti', 'Mukta Pishti',
    'Vasant Kusumakar Ras', 'Tribhuvan Kirti Ras', 'Laxmi Vilas Ras', 'Sootshekhar Ras',
    'Garbhapal Ras', 'Hridyarnav Ras',
    
    // Medicated Oils & Ghrits
    'Mahanarayana Taila', 'Ksheerabala Taila', 'Anu Taila', 'Brahmi Ghrita', 'Panchatikta Ghrita'
  ];

  // Devanagari Numeral Map
  private static readonly DEVANAGARI_DIGITS: Record<string, string> = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
  };

  /**
   * Convert any Devanagari numerals in the text to ASCII digits
   */
  public static normalizeDevanagariNumerals(text: string): string {
    return text.replace(/[०-९]/g, d => this.DEVANAGARI_DIGITS[d] || d);
  }

  /**
   * Extract Hindi/Devanagari Posology instructions and map to standardized clinical terminology
   */
  public static extractVernacularPosology(text: string): Array<{ phrase: string; meaning: string }> {
    const results: Array<{ phrase: string; meaning: string }> = [];

    const vernacularPatterns: Array<{ regex: RegExp; meaning: string }> = [
      { regex: /सुबह[- ]?शाम/gi, meaning: 'BD (Twice Daily - Morning & Evening)' },
      { regex: /दिन में एक बार|रोजाना|प्रतिदिन/gi, meaning: 'OD (Once Daily)' },
      { regex: /दिन में तीन बार|सुबह[- ]?दोपहर[- ]?शाम/gi, meaning: 'TDS (Three Times Daily)' },
      { regex: /रात को सोते समय|सोते वक्त/gi, meaning: 'HS (Bedtime)' },
      { regex: /खाने के बाद|भोजनोपरांत/gi, meaning: 'PC (After Meals / Adhobhakta)' },
      { regex: /खाली पेट|खाने से पहले|प्रातःकाल/gi, meaning: 'AC (Before Meals / Pragbhakta)' },
      { regex: /गुनगुने पानी(?: के साथ)?|उष्णोदक/gi, meaning: 'Anupana: Lukewarm Water (Ushnodaka)' },
      { regex: /दूध के साथ|क्षीर/gi, meaning: 'Anupana: Warm Milk (Ksheera)' },
      { regex: /शहद के साथ|मधु/gi, meaning: 'Anupana: Honey (Madhu)' },
      { regex: /ताजे पानी के साथ/gi, meaning: 'Anupana: Fresh Water' }
    ];

    for (const { regex, meaning } of vernacularPatterns) {
      const match = text.match(regex);
      if (match) {
        results.push({ phrase: match[0], meaning });
      }
    }

    return results;
  }

  /**
   * Calculate Damerau-Levenshtein Distance between two strings
   * Accounts for insertions, deletions, substitutions, and adjacent transpositions
   */
  public static damerauLevenshtein(a: string, b: string): number {
    const al = a.length;
    const bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;

    const matrix: number[][] = [];

    for (let i = 0; i <= al; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= bl; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= al; i++) {
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );

        // Transposition
        if (i > 1 && j > 1 &&
            a[i - 1].toLowerCase() === b[j - 2].toLowerCase() &&
            a[i - 2].toLowerCase() === b[j - 1].toLowerCase()) {
          matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
        }
      }
    }

    return matrix[al][bl];
  }

  /**
   * Pre-clean common OCR character substitutions before fuzzy matching
   */
  public static cleanOcrSubstitutions(token: string): string {
    return token
      .replace(/([a-zA-Z])0/g, '$1o')   // 'Metf0' -> 'Metfo'
      .replace(/0([a-zA-Z])/g, 'o$1')   // '0x' -> 'ox'
      .replace(/([a-zA-Z])5/g, '$1s')   // 'Lo5artan' -> 'Losartan'
      .replace(/5([a-zA-Z])/g, 's$1')   // '5itopaladi' -> 'sitopaladi'
      .replace(/([a-zA-Z])1/g, '$1l')   // 'Te1misartan' -> 'Telmisartan'
      .replace(/1([a-zA-Z])/g, 'l$1')   // '1osartan' -> 'losartan'
      .replace(/rn(?=[a-zA-Z])/g, 'm')   // 'rn' often reads as 'm' in cursive
      .trim();
  }

  /**
   * Fuzzy match an extracted token against known medical drug dictionaries
   */
  public static matchDrug(rawToken: string): FuzzyMatchResult {
    // Strip common dosage prefixes/suffixes for base matching
    let baseClean = rawToken
      .replace(/^(Tab|Tablet|Cap|Capsule|Syp|Syrup|Inj|Churna|Vati|Gutika|Kwath|Taila|Ghrita|Asava|Arishta)\.?\s+/i, '')
      .replace(/\b(OD|BD|TDS|TID|BID|HS|SOS|QID|daily|twice|subah|shaam)\b.*$/i, '')
      .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|gm|ml|mq|drops|vati|tab)\b.*$/i, '')
      .replace(/\b\d+\b/g, '')
      .trim();

    baseClean = this.cleanOcrSubstitutions(baseClean);

    if (baseClean.length < 3) {
      return { matched: false, originalToken: rawToken, distance: 99, confidence: 0, category: 'UNKNOWN' };
    }

    let bestMatch: string | null = null;
    let minDistance = 999;
    let matchCategory: 'ALLOPATHIC' | 'AYUSH' | 'UNKNOWN' = 'UNKNOWN';

    // 1. Search Allopathic Candidates
    for (const cand of this.CANONICAL_ALLOPATHIC) {
      const dist = this.damerauLevenshtein(baseClean, cand);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = cand;
        matchCategory = 'ALLOPATHIC';
      }
    }

    // 2. Search Ayush Candidates
    for (const cand of this.CANONICAL_AYUSH) {
      const dist = this.damerauLevenshtein(baseClean, cand);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = cand;
        matchCategory = 'AYUSH';
      }
    }

    // Determine acceptance threshold:
    // For length <= 5, allow distance <= 1.
    // For length > 5, allow distance <= 2 (or 3 for long compound Sanskrit terms).
    const maxAllowedDist = baseClean.length <= 5 ? 1 : (baseClean.length > 12 ? 3 : 2);

    if (bestMatch && minDistance <= maxAllowedDist) {
      const maxLen = Math.max(baseClean.length, bestMatch.length);
      const confidence = parseFloat((1 - (minDistance / maxLen)).toFixed(3));

      return {
        matched: true,
        canonicalName: bestMatch,
        originalToken: rawToken,
        distance: minDistance,
        confidence,
        category: matchCategory
      };
    }

    return {
      matched: false,
      originalToken: rawToken,
      distance: minDistance,
      confidence: 0,
      category: 'UNKNOWN'
    };
  }

  /**
   * Reconstruct medication string with canonical drug name preserving dosage form & strength
   */
  public static resolveMedicationString(rawMed: string): {
    resolvedString: string;
    wasCorrected: boolean;
    canonical?: string;
    confidence: number;
    category: string;
  } {
    // Extract dosage form prefix if present
    const prefixMatch = rawMed.match(/^(Tab|Tablet|Cap|Capsule|Syp|Syrup|Inj|Churna|Vati|Gutika|Kwath|Taila|Ghrita|Asava|Arishta)\.?\s+/i);
    const prefix = prefixMatch ? prefixMatch[0] : '';

    // Extract dosage strength if present (normalizes OCR 'mq' to 'mg')
    const strengthMatch = rawMed.match(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|gm|ml|mq|drops|vati|tab)\b/i);
    const strength = strengthMatch ? strengthMatch[0].replace(/mq\b/i, 'mg') : '';

    // Extract schedule if present
    const freqMatch = rawMed.match(/\b(OD|BD|TDS|TID|BID|HS|SOS|QID)\b/i);
    const freq = freqMatch ? freqMatch[0].toUpperCase() : '';

    const match = this.matchDrug(rawMed);

    if (match.matched && match.canonicalName) {
      let resolved = match.canonicalName;
      if (prefix) resolved = `${prefix.trim()} ${resolved}`;
      if (strength && !resolved.includes(strength)) resolved = `${resolved} ${strength}`;
      if (freq && !resolved.includes(freq)) resolved = `${resolved} ${freq}`;

      const wasCorrected = match.distance > 0;
      return {
        resolvedString: resolved,
        wasCorrected,
        canonical: match.canonicalName,
        confidence: match.confidence,
        category: match.category
      };
    }

    return {
      resolvedString: rawMed,
      wasCorrected: false,
      confidence: 0.70,
      category: 'RAW_UNMATCHED'
    };
  }
}
