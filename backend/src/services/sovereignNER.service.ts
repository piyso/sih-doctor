/**
 * Sovereign Privacy, Identity & De-Identification Engine
 * Implements mathematical Verhoeff D5 algorithm for 12-digit Indian Aadhaar validation,
 * PAN verification, and multilingual PII de-identification under the DPDP Act 2023.
 */

export class SovereignNERService {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. VERHOEFF ALGORITHM TABLES (Dihedral Group D5)
  // ─────────────────────────────────────────────────────────────────────────
  private static dTable = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
  ];

  private static pTable = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
  ];

  private static invTable = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

  /**
   * Validate 12-digit Aadhaar number using the mathematical Verhoeff algorithm
   */
  public static validateAadhaar(aadhaar: string): boolean {
    const clean = aadhaar.replace(/[\s\-]/g, '');
    if (!/^\d{12}$/.test(clean)) return false;

    // Verhoeff checksum calculation
    let c = 0;
    const reversed = clean.split('').reverse().map(Number);

    for (let i = 0; i < reversed.length; i++) {
      c = this.dTable[c][this.pTable[i % 8][reversed[i]]];
    }

    return c === 0;
  }

  /**
   * Generate a valid Verhoeff checksum digit for a given 11-digit prefix
   */
  public static generateAadhaarChecksum(elevenDigits: string): string {
    const clean = elevenDigits.replace(/[\s\-]/g, '');
    let c = 0;
    const reversed = clean.split('').reverse().map(Number);

    for (let i = 0; i < reversed.length; i++) {
      c = this.dTable[c][this.pTable[(i + 1) % 8][reversed[i]]];
    }

    return this.invTable[c].toString();
  }

  /**
   * Mask an Aadhaar number to DPDP-compliant format (e.g. XXXXXXXX1234)
   */
  public static maskAadhaar(aadhaar: string): string {
    const clean = aadhaar.replace(/[\s\-]/g, '');
    if (clean.length < 4) return 'XXXXXXXX0000';
    const last4 = clean.slice(-4);
    return `XXXXXXXX${last4}`;
  }

  /**
   * Validate 10-character Indian Permanent Account Number (PAN)
   */
  public static validatePAN(pan: string): boolean {
    const clean = pan.trim().toUpperCase();
    // [A-Z]{5}[0-9]{4}[A-Z]
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean)) return false;

    // 4th character denotes entity status
    const statusChar = clean[3];
    const validStatus = ['P', 'C', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G'];
    return validStatus.includes(statusChar);
  }

  /**
   * Mask Indian Mobile Number (10 digits) to XXXXXX3210
   */
  public static maskPhone(phone: string): string {
    const clean = phone.replace(/[^\d]/g, '').slice(-10);
    if (clean.length === 10) {
      return `XXXXXX${clean.slice(6)}`;
    }
    return phone;
  }

  /**
   * De-identify clinical text removing PII (Aadhaar, PAN, phone numbers, Indian names)
   */
  public static deIdentifyText(rawText: string): { redactedText: string; piiEntitiesFound: string[] } {
    let redacted = rawText;
    const piiEntitiesFound: string[] = [];

    // 1. Aadhaar detection and masking
    const aadhaarRegex = /\b\d{4}\s*\d{4}\s*\d{4}\b/g;
    redacted = redacted.replace(aadhaarRegex, (match) => {
      piiEntitiesFound.push(`Aadhaar: ${match}`);
      return this.maskAadhaar(match);
    });

    // 2. PAN detection
    const panRegex = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
    redacted = redacted.replace(panRegex, (match) => {
      piiEntitiesFound.push(`PAN: ${match}`);
      return `[REDACTED_PAN]`;
    });

    // 3. Phone number detection
    const phoneRegex = /\b(?:\+91[\-\s]?)?[6-9]\d{9}\b/g;
    redacted = redacted.replace(phoneRegex, (match) => {
      piiEntitiesFound.push(`Phone: ${match}`);
      return this.maskPhone(match);
    });

    // 4. Multilingual Devanagari Name Redaction
    const devanagariNamePattern = /(?:मरीज का नाम|मरीज|नाम|पिता का नाम|पिता)\s*[:=-]?\s*([\u0900-\u097F\s]+?)(?=(?:,\s*|\s+पिता|\s+ग्राम|\s+उम्र|\s+जिला|\s+मोबाइल|\n|$))/gi;
    redacted = redacted.replace(devanagariNamePattern, (match, nameGroup) => {
      piiEntitiesFound.push(`Name(Dev): ${nameGroup.trim()}`);
      return match.replace(nameGroup, ' [REDACTED_NAME] ');
    });

    // 5. English Patient, Relative & Address Redaction
    const englishNamePattern = /(?:Patient(?:\s+Name)?|Name|Father(?:\s+Name)?|Son of|Daughter of|Wife of|Resident of|Address)\s*[:=-]?\s*([A-Za-z\s]+?)(?=(?:,\s*|\s+Son of|\s+Father|\s+Resident|\s+Address|\s+Age|\s+Mobile|\s+Phone|\n|$))/gi;
    redacted = redacted.replace(englishNamePattern, (match, nameGroup) => {
      const trimmed = nameGroup.trim();
      if (trimmed.length > 2 && !['male', 'female', 'years', 'yrs', 'old', 'opd', 'aiia', 'hospital'].includes(trimmed.toLowerCase())) {
        piiEntitiesFound.push(`Name/Entity(EN): ${trimmed}`);
        return match.replace(nameGroup, ' [REDACTED_PII] ');
      }
      return match;
    });

    // 6. Devanagari Address (ग्राम, जिला, पता)
    const devanagariAddressPattern = /(?:ग्राम|जिला|पता)\s*[:=-]?\s*([\u0900-\u097F\s]+?)(?=(?:,\s*|\s+जिला|\s+मोबाइल|\n|$))/gi;
    redacted = redacted.replace(devanagariAddressPattern, (match, addrGroup) => {
      piiEntitiesFound.push(`Address(Dev): ${addrGroup.trim()}`);
      return match.replace(addrGroup, ' [REDACTED_LOC] ');
    });

    return {
      redactedText: redacted,
      piiEntitiesFound
    };
  }
}
