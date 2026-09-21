/**
 * SOTA 40-Analyte Physiological Plausibility & Laboratory Decimal Safeguard Service
 * Audits extracted biochemical parameters against strict biological and clinical limits.
 * 
 * Intercepts fatal optical and dot-matrix artifacts:
 * 1. Dropped decimal points (e.g., Creatinine 11 -> 1.1 mg/dL, Potassium 44 -> 4.4 mEq/L, Hb 6201 -> 6.2 g/dL)
 * 2. Bi-directional SI-to-Metric conversions (mmol/L, µmol/L, g/L, Lakhs/cumm)
 * 3. 40-Analyte Complete Clinical Biochemistry Registry (CBC, KFT, LFT, Electrolytes, Glycemic, Cardiac)
 * 4. Human-in-the-Loop Amber Badge verification triggers for court-admissible audit trails
 */

import { LabMarker } from '../shared/types';

export interface AnalyteDefinition {
  canonicalName: string;
  aliases: string[];
  standardMin: number;
  standardMax: number;
  minLethal: number;
  maxLethal: number;
  unit: string;
  siConversion?: {
    siUnit: string;
    factor: number; // Multiply by factor to reach metric unit
  };
  decimalDivisors?: number[]; // Candidate divisors for dropped decimals (e.g. [10, 100, 1000])
}

export interface PlausibilityAuditResult {
  auditedMarkers: LabMarker[];
  warnings: string[];
  unitConversions: string[];
  requiresHumanReview: boolean;
  reviewReason?: string;
}

export class PhysiologicalPlausibilityService {
  /**
   * SOTA 40-Analyte Comprehensive Clinical Registry
   */
  public static readonly REGISTRY: AnalyteDefinition[] = [
    // ── Complete Blood Count (CBC) ──
    {
      canonicalName: 'Hemoglobin',
      aliases: ['hemoglobin', 'hb', 'hgb', 'hemogions', 'haemoglobin'],
      standardMin: 12.0, standardMax: 17.0, minLethal: 3.0, maxLethal: 25.0, unit: 'g/dL',
      decimalDivisors: [10, 100, 1000] // Handles 135 -> 13.5 and 6201 -> 6.20
    },
    {
      canonicalName: 'Total Leukocyte Count (TLC)',
      aliases: ['tlc', 'wbc', 'total leukocyte', 'total leukocytes', 'total leucocyte count', 'wet', 'leukocyte count'],
      standardMin: 4000, standardMax: 11000, minLethal: 500, maxLethal: 150000, unit: '/cumm'
    },
    {
      canonicalName: 'Platelets',
      aliases: ['platelet', 'platelets', 'plt', 'wlatelet', 'platelet count', 'wlatelet count'],
      standardMin: 150000, standardMax: 450000, minLethal: 2000, maxLethal: 2000000, unit: '/cumm',
      siConversion: { siUnit: 'lakh', factor: 100000 }
    },
    {
      canonicalName: 'RBC Count',
      aliases: ['rbc', 'red blood cell', 'rbc count', 'erythrocyte count'],
      standardMin: 3.8, standardMax: 5.8, minLethal: 1.0, maxLethal: 8.5, unit: 'mil/uL',
      decimalDivisors: [10, 100]
    },
    {
      canonicalName: 'Hematocrit (PCV)',
      aliases: ['pcv', 'hematocrit', 'haematocrit', 'packed cell volume'],
      standardMin: 36.0, standardMax: 50.0, minLethal: 10.0, maxLethal: 70.0, unit: '%'
    },
    {
      canonicalName: 'Mean Corpuscular Volume (MCV)',
      aliases: ['mcv', 'mean corpuscular volume'],
      standardMin: 80.0, standardMax: 100.0, minLethal: 50.0, maxLethal: 140.0, unit: 'fL'
    },
    {
      canonicalName: 'Mean Corpuscular Hemoglobin (MCH)',
      aliases: ['mch', 'mean corpuscular hemoglobin'],
      standardMin: 27.0, standardMax: 33.0, minLethal: 15.0, maxLethal: 50.0, unit: 'pg'
    },
    {
      canonicalName: 'MCHC',
      aliases: ['mchc'],
      standardMin: 32.0, standardMax: 36.0, minLethal: 20.0, maxLethal: 45.0, unit: 'g/dL'
    },
    {
      canonicalName: 'RDW-CV',
      aliases: ['rdw', 'rdw-cv', 'rdw_cv'],
      standardMin: 11.5, standardMax: 14.5, minLethal: 8.0, maxLethal: 30.0, unit: '%'
    },
    {
      canonicalName: 'Neutrophils',
      aliases: ['neutrophils', 'polymorphs', 'newtophals'],
      standardMin: 40.0, standardMax: 75.0, minLethal: 5.0, maxLethal: 98.0, unit: '%'
    },
    {
      canonicalName: 'Lymphocytes',
      aliases: ['lymphocytes', 'lyniphoeytes'],
      standardMin: 20.0, standardMax: 45.0, minLethal: 2.0, maxLethal: 90.0, unit: '%'
    },
    {
      canonicalName: 'Monocytes',
      aliases: ['monocytes', 'monocytrs'],
      standardMin: 2.0, standardMax: 10.0, minLethal: 0.0, maxLethal: 30.0, unit: '%'
    },
    {
      canonicalName: 'Eosinophils',
      aliases: ['eosinophils', 'boummpinle'],
      standardMin: 1.0, standardMax: 6.0, minLethal: 0.0, maxLethal: 40.0, unit: '%'
    },
    {
      canonicalName: 'Basophils',
      aliases: ['basophils', 'baxophiks'],
      standardMin: 0.0, standardMax: 2.0, minLethal: 0.0, maxLethal: 10.0, unit: '%'
    },

    // ── Renal Function Tests (KFT) ──
    {
      canonicalName: 'Serum Creatinine',
      aliases: ['creatinine', 'serum creatinine', 'creat', 's. creatinine'],
      standardMin: 0.7, standardMax: 1.3, minLethal: 0.2, maxLethal: 20.0, unit: 'mg/dL',
      siConversion: { siUnit: 'umol', factor: 1 / 88.4 },
      decimalDivisors: [10, 100] // Handles 11 -> 1.1, 14 -> 1.4
    },
    {
      canonicalName: 'Blood Urea',
      aliases: ['blood urea', 'urea', 'b. urea'],
      standardMin: 15.0, standardMax: 45.0, minLethal: 5.0, maxLethal: 350.0, unit: 'mg/dL',
      decimalDivisors: [10]
    },
    {
      canonicalName: 'Blood Urea Nitrogen (BUN)',
      aliases: ['bun', 'blood urea nitrogen'],
      standardMin: 7.0, standardMax: 20.0, minLethal: 2.0, maxLethal: 150.0, unit: 'mg/dL',
      decimalDivisors: [10]
    },
    {
      canonicalName: 'Serum Uric Acid',
      aliases: ['uric acid', 'serum uric acid'],
      standardMin: 3.5, standardMax: 7.2, minLethal: 1.0, maxLethal: 25.0, unit: 'mg/dL',
      decimalDivisors: [10]
    },
    {
      canonicalName: 'Serum Calcium',
      aliases: ['calcium', 'serum calcium', 's. calcium'],
      standardMin: 8.5, standardMax: 10.5, minLethal: 4.0, maxLethal: 18.0, unit: 'mg/dL',
      decimalDivisors: [10]
    },
    {
      canonicalName: 'Serum Phosphorus',
      aliases: ['phosphorus', 'serum phosphorus', 'phosphate'],
      standardMin: 2.5, standardMax: 4.5, minLethal: 0.8, maxLethal: 15.0, unit: 'mg/dL',
      decimalDivisors: [10]
    },

    // ── Liver Function Tests (LFT) ──
    {
      canonicalName: 'Total Bilirubin',
      aliases: ['bilirubin', 'total bilirubin', 'serum bilirubin', 's. bilirubin'],
      standardMin: 0.2, standardMax: 1.2, minLethal: 0.05, maxLethal: 45.0, unit: 'mg/dL',
      siConversion: { siUnit: 'umol', factor: 1 / 17.1 },
      decimalDivisors: [10, 100]
    },
    {
      canonicalName: 'Direct Bilirubin',
      aliases: ['direct bilirubin', 'conjugated bilirubin'],
      standardMin: 0.0, standardMax: 0.3, minLethal: 0.0, maxLethal: 30.0, unit: 'mg/dL',
      decimalDivisors: [10, 100]
    },
    {
      canonicalName: 'Indirect Bilirubin',
      aliases: ['indirect bilirubin', 'unconjugated bilirubin'],
      standardMin: 0.2, standardMax: 0.8, minLethal: 0.0, maxLethal: 30.0, unit: 'mg/dL',
      decimalDivisors: [10, 100]
    },
    {
      canonicalName: 'SGOT (AST)',
      aliases: ['sgot', 'ast', 'aspartate aminotransferase'],
      standardMin: 5.0, standardMax: 40.0, minLethal: 2.0, maxLethal: 5000.0, unit: 'U/L'
    },
    {
      canonicalName: 'SGPT (ALT)',
      aliases: ['sgpt', 'alt', 'alanine aminotransferase'],
      standardMin: 7.0, standardMax: 56.0, minLethal: 2.0, maxLethal: 5000.0, unit: 'U/L'
    },
    {
      canonicalName: 'Alkaline Phosphatase (ALP)',
      aliases: ['alp', 'alkaline phosphatase', 'alk phos'],
      standardMin: 44.0, standardMax: 147.0, minLethal: 15.0, maxLethal: 2000.0, unit: 'U/L'
    },
    {
      canonicalName: 'Total Protein',
      aliases: ['total protein', 'protein'],
      standardMin: 6.0, standardMax: 8.3, minLethal: 2.5, maxLethal: 14.0, unit: 'g/dL',
      decimalDivisors: [10]
    },
    {
      canonicalName: 'Serum Albumin',
      aliases: ['albumin', 'serum albumin', 's. albumin'],
      standardMin: 3.5, standardMax: 5.0, minLethal: 1.0, maxLethal: 7.5, unit: 'g/dL',
      decimalDivisors: [10]
    },
    {
      canonicalName: 'Serum Globulin',
      aliases: ['globulin', 'serum globulin'],
      standardMin: 2.0, standardMax: 3.5, minLethal: 0.8, maxLethal: 8.0, unit: 'g/dL',
      decimalDivisors: [10]
    },

    // ── Electrolytes ──
    {
      canonicalName: 'Serum Potassium',
      aliases: ['potassium', 'serum potassium', 'k+', 's. potassium'],
      standardMin: 3.5, standardMax: 5.0, minLethal: 1.5, maxLethal: 9.0, unit: 'mEq/L',
      decimalDivisors: [10] // Handles 44 -> 4.4, 51 -> 5.1
    },
    {
      canonicalName: 'Serum Sodium',
      aliases: ['sodium', 'serum sodium', 'na+', 's. sodium'],
      standardMin: 135.0, standardMax: 145.0, minLethal: 100.0, maxLethal: 180.0, unit: 'mEq/L'
    },
    {
      canonicalName: 'Serum Chloride',
      aliases: ['chloride', 'serum chloride', 'cl-'],
      standardMin: 96.0, standardMax: 106.0, minLethal: 65.0, maxLethal: 145.0, unit: 'mEq/L'
    },

    // ── Diabetic & Glycemic Markers ──
    {
      canonicalName: 'Fasting Blood Sugar',
      aliases: ['fasting blood sugar', 'fbs', 'fasting glucose', 'blood sugar fasting'],
      standardMin: 70.0, standardMax: 100.0, minLethal: 25.0, maxLethal: 800.0, unit: 'mg/dL',
      siConversion: { siUnit: 'mmol', factor: 18.0182 }
    },
    {
      canonicalName: 'Post Prandial Blood Sugar',
      aliases: ['post prandial blood sugar', 'ppbs', 'pp blood sugar', 'post glucose'],
      standardMin: 80.0, standardMax: 140.0, minLethal: 30.0, maxLethal: 900.0, unit: 'mg/dL',
      siConversion: { siUnit: 'mmol', factor: 18.0182 }
    },
    {
      canonicalName: 'Random Blood Sugar',
      aliases: ['random blood sugar', 'rbs', 'blood sugar', 'blood glucose', 'glucose'],
      standardMin: 70.0, standardMax: 140.0, minLethal: 25.0, maxLethal: 850.0, unit: 'mg/dL',
      siConversion: { siUnit: 'mmol', factor: 18.0182 }
    },
    {
      canonicalName: 'HbA1c',
      aliases: ['hba1c', 'glycated hemoglobin', 'a1c'],
      standardMin: 4.0, standardMax: 5.6, minLethal: 2.5, maxLethal: 22.0, unit: '%',
      decimalDivisors: [10] // Handles 65 -> 6.5
    },

    // ── Cardiac & Inflammatory Markers ──
    {
      canonicalName: 'Cardiac Troponin-I',
      aliases: ['troponin', 'troponin-i', 'cardiac troponin-i', 'trop i', 'trop-i'],
      standardMin: 0.0, standardMax: 0.04, minLethal: 0.0, maxLethal: 100.0, unit: 'ng/mL'
    },
    {
      canonicalName: 'C-Reactive Protein (CRP)',
      aliases: ['crp', 'c-reactive protein', 'c reactive protein'],
      standardMin: 0.0, standardMax: 6.0, minLethal: 0.0, maxLethal: 500.0, unit: 'mg/L',
      decimalDivisors: [10]
    },
    {
      canonicalName: 'Erythrocyte Sedimentation Rate (ESR)',
      aliases: ['esr', 'erythrocyte sedimentation rate'],
      standardMin: 0.0, standardMax: 20.0, minLethal: 0.0, maxLethal: 160.0, unit: 'mm/hr'
    },
    {
      canonicalName: 'Serum Lipase',
      aliases: ['lipase', 'serum lipase'],
      standardMin: 10.0, standardMax: 60.0, minLethal: 2.0, maxLethal: 3000.0, unit: 'U/L'
    },
    {
      canonicalName: 'Serum Amylase',
      aliases: ['amylase', 'serum amylase'],
      standardMin: 30.0, standardMax: 110.0, minLethal: 5.0, maxLethal: 4000.0, unit: 'U/L'
    },
    {
      canonicalName: 'Thyroid Stimulating Hormone (TSH)',
      aliases: ['tsh', 'thyroid stimulating hormone'],
      standardMin: 0.4, standardMax: 4.2, minLethal: 0.01, maxLethal: 150.0, unit: 'uIU/mL',
      decimalDivisors: [10, 100]
    }
  ];

  /**
   * Find matching analyte definition from test name
   */
  public static matchAnalyte(testName: string): AnalyteDefinition | null {
    const clean = testName.toLowerCase().trim();
    for (const def of this.REGISTRY) {
      if (def.aliases.some(alias => clean === alias || clean.includes(alias) || alias.includes(clean))) {
        return def;
      }
    }
    return null;
  }

  /**
   * Comprehensive Audit across the 40-Analyte Registry
   */
  public static auditMarkers(
    rawMarkers: Array<{ testName: string; value: number; unit?: string }>,
    rawDocumentText: string = ''
  ): PlausibilityAuditResult {
    const auditedMarkers: LabMarker[] = [];
    const warnings: string[] = [];
    const unitConversions: string[] = [];
    let requiresHumanReview = false;
    const reviewReasons: string[] = [];

    const lowerDoc = rawDocumentText.toLowerCase();

    for (const marker of rawMarkers) {
      let val = marker.value;
      const test = marker.testName;
      let unit = (marker.unit || '').trim();
      let warning: string | undefined;
      let originalVal: number | undefined;

      const def = this.matchAnalyte(test);

      if (def) {
        const lowerUnit = unit.toLowerCase();

        // 1. Check SI Unit Conversions
        if (def.siConversion) {
          const hasExplicitMetric = lowerUnit.includes('mg') || lowerUnit.includes('g/dl') || lowerUnit.includes('meq');
          const isExplicitSI = lowerUnit.includes(def.siConversion.siUnit);
          const isContextSI = !hasExplicitMetric && lowerDoc.includes(def.siConversion.siUnit);

          // Auto-detect SI when unit omitted and value is inside SI threshold
          const isOmittedSI = !hasExplicitMetric && (
            (def.canonicalName.includes('Creatinine') && val >= 40 && val <= 1500) ||
            (def.canonicalName.includes('Sugar') && val >= 2.0 && val <= 35.0) ||
            (def.canonicalName.includes('Platelet') && val >= 0.5 && val <= 10.0)
          );

          if (isExplicitSI || isContextSI || isOmittedSI) {
            originalVal = val;
            if (def.canonicalName.includes('Sugar')) {
              val = Math.round(val * def.siConversion.factor);
            } else if (def.canonicalName.includes('Platelet')) {
              val = Math.round(val * def.siConversion.factor);
            } else {
              val = parseFloat((val * def.siConversion.factor).toFixed(2));
            }
            unit = def.unit;
            unitConversions.push(`Normalized ${def.canonicalName} from ${originalVal} ${def.siConversion.siUnit} to ${val} ${def.unit}`);
          }
        }

        // 2. Check Candidate Decimal Divisors (/10, /100, /1000) for dropped decimals
        if (!originalVal && def.decimalDivisors && (val < def.minLethal || val > def.maxLethal || (Number.isInteger(val) && val > def.standardMax * 3))) {
          for (const divisor of def.decimalDivisors) {
            const candidate = val / divisor;
            if (candidate >= def.minLethal && candidate <= def.maxLethal) {
              originalVal = val;
              val = parseFloat(candidate.toFixed(2));
              warning = `SUSPECTED_DROPPED_DECIMAL: Scanned value ${originalVal} ${def.unit} restored to plausible ${val} ${def.unit} (Divisor /${divisor}).`;
              warnings.push(warning);
              requiresHumanReview = true;
              reviewReasons.push(`${def.canonicalName} ${originalVal} restored to ${val} ${def.unit}.`);
              break;
            }
          }
        }

        // 3. Clinical Lethal Bound Verification
        if (val < def.minLethal || val > def.maxLethal) {
          warning = `BIOLOGICAL_IMPOSSIBILITY: ${def.canonicalName} value ${val} ${def.unit} is outside human survival limits [${def.minLethal} - ${def.maxLethal}].`;
          warnings.push(warning);
          requiresHumanReview = true;
          reviewReasons.push(warning);
        } else if (def.canonicalName === 'Serum Potassium' && (val < 2.5 || val > 6.2)) {
          warning = `CRITICAL_DYSELYTEMIA: Serum Potassium ${val} mEq/L poses fatal cardiac arrhythmia risk.`;
          warnings.push(warning);
          requiresHumanReview = true;
        } else if (def.canonicalName === 'Platelets' && val < 20000) {
          warning = `CRITICAL_THROMBOCYTOPENIA: Platelet count ${val} /cumm poses spontaneous intracranial hemorrhage risk.`;
          warnings.push(warning);
          requiresHumanReview = true;
        } else if (def.canonicalName === 'Hemoglobin' && val < 7.0) {
          warning = `SEVERE_ANEMIA: Hemoglobin ${val} g/dL is below critical transfusion threshold.`;
          warnings.push(warning);
          requiresHumanReview = true;
        }

        const isHigh = val > def.standardMax;
        const isLow = val < def.standardMin;

        auditedMarkers.push({
          testName: def.canonicalName,
          value: val,
          unit: unit || def.unit,
          referenceRange: `${def.standardMin} - ${def.standardMax}`,
          isAbnormal: isHigh || isLow,
          flag: isHigh ? 'HIGH' : (isLow ? 'LOW' : undefined),
          plausibilityWarning: warning,
          originalRawValue: originalVal
        });
      } else {
        // Fallback for unlisted markers
        auditedMarkers.push({
          testName: test,
          value: val,
          unit: unit || 'standard',
          referenceRange: 'Standard Clinical Range',
          isAbnormal: false
        });
      }
    }

    return {
      auditedMarkers,
      warnings,
      unitConversions,
      requiresHumanReview,
      reviewReason: reviewReasons.length > 0 ? reviewReasons.join('; ') : undefined
    };
  }
}
