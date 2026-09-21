/**
 * AIIA Sovereign Clinical Formulary
 * Approved National AYUSH Formulary (NAMASTE / WHO ICD-11 TM-2)
 * & Allopathic Essential Medicines Formulary (NLEM 2022)
 */

export interface FormularyAllopathicItem {
  id: string;
  name: string;
  genericName: string;
  dosage: string;
  route: string;
  frequency: string;
  durationDays: number;
}

export interface FormularyAyushItem {
  id: string;
  classicalName: string;
  namasteCode: string;
  dosageForm: string;
  dose: string;
  anupana: string;
  frequency: string;
  durationDays: number;
  pathya: string[];
  apathya: string[];
}

export const CLINICAL_ALLOPATHIC_FORMULARY: FormularyAllopathicItem[] = [
  { id: 'allo-1', name: 'Warfarin', genericName: 'Warfarin Sodium', dosage: '5 mg', route: 'ORAL', frequency: 'OD (Once Daily)', durationDays: 30 },
  { id: 'allo-2', name: 'Digoxin', genericName: 'Digoxin', dosage: '0.25 mg', route: 'ORAL', frequency: 'OD (Once Daily)', durationDays: 30 },
  { id: 'allo-3', name: 'Metformin', genericName: 'Metformin Hydrochloride', dosage: '500 mg', route: 'ORAL', frequency: 'BD (Twice Daily)', durationDays: 60 },
  { id: 'allo-4', name: 'Atorvastatin', genericName: 'Atorvastatin Calcium', dosage: '20 mg', route: 'ORAL', frequency: 'HS (Bedtime)', durationDays: 30 },
  { id: 'allo-5', name: 'Paracetamol', genericName: 'Acetaminophen', dosage: '650 mg', route: 'ORAL', frequency: 'TDS (Thrice Daily)', durationDays: 5 },
  { id: 'allo-6', name: 'Amoxicillin-Clavulanate', genericName: 'Amoxicillin + Clavulanic Acid', dosage: '625 mg', route: 'ORAL', frequency: 'BD (Twice Daily)', durationDays: 5 },
  { id: 'allo-7', name: 'Amlodipine', genericName: 'Amlodipine Besylate', dosage: '5 mg', route: 'ORAL', frequency: 'OD (Once Daily)', durationDays: 30 }
];

export const CLINICAL_AYUSH_FORMULARY: FormularyAyushItem[] = [
  { id: 'ayush-1', classicalName: 'Yogaraja Guggulu', namasteCode: 'AYU-FORM-002', dosageForm: 'Vati / Tablet', dose: '2 tablets (500mg)', anupana: 'Koshna Jala (Warm Water) or Rasnadi Kwatha', frequency: 'BD (Twice Daily)', durationDays: 30, pathya: ['Light warm soups', 'Mudga yusha', 'Barley'], apathya: ['Curd', 'Cold drinks', 'Black gram'] },
  { id: 'ayush-2', classicalName: 'Shilajit Rasayana', namasteCode: 'AYU-FORM-004', dosageForm: 'Vati / Resin', dose: '1 tablet (250mg)', anupana: 'Godugdha (Warm Cow Milk)', frequency: 'BD (Twice Daily)', durationDays: 45, pathya: ['Cow ghee', 'Milk', 'Shali rice'], apathya: ['Horsegram (Kulatthi)', 'Excessive sour foods'] },
  { id: 'ayush-3', classicalName: 'Yashtimadhu Churna', namasteCode: 'AYU-FORM-003', dosageForm: 'Churna / Powder', dose: '3 grams', anupana: 'Godugdha (Warm Cow Milk) or Honey', frequency: 'BD (Twice Daily)', durationDays: 15, pathya: ['Sweet fruits', 'Ghee', 'Moong dal'], apathya: ['Pungent spices', 'Fried food'] },
  { id: 'ayush-4', classicalName: 'Sudarshana Ghanavati', namasteCode: 'AYU-FORM-007', dosageForm: 'Ghanavati / Extract Tablet', dose: '2 tablets', anupana: 'Koshna Jala (Warm Water)', frequency: 'TDS (Thrice Daily)', durationDays: 5, pathya: ['Boiled water', 'Light gruel (Peya)'], apathya: ['Heavy meals', 'Cold baths'] },
  { id: 'ayush-5', classicalName: 'Ashwagandha Rasayana', namasteCode: 'AYU-FORM-001', dosageForm: 'Avaleha / Churna', dose: '5 grams', anupana: 'Godugdha (Warm Cow Milk)', frequency: 'BD (Twice Daily)', durationDays: 60, pathya: ['Fresh fruits', 'Almonds', 'Milk'], apathya: ['Stale food', 'Excessive exertion'] },
  { id: 'ayush-6', classicalName: 'Triphala Churna', namasteCode: 'AYU-FORM-005', dosageForm: 'Churna', dose: '3-5 grams', anupana: 'Koshna Jala (Lukewarm Water) at bedtime', frequency: 'HS (Bedtime)', durationDays: 30, pathya: ['High fiber vegetables', 'Buttermilk'], apathya: ['Late night snacking'] }
];
