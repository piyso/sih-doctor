/**
 * AIIA Sovereign Clinical Formulary
 * Approved National AYUSH Formulary (NAMASTE / WHO ICD-11 TM-2)
 * & Allopathic Essential Medicines Formulary (NLEM 2022)
 * Complete with Posology, Anupana, Schedule E1 Poison Flags & Dietary Directives
 */

export interface FormularyAllopathicItem {
  id: string;
  name: string;
  genericName: string;
  dosage: string;
  route: string;
  frequency: string;
  durationDays: number;
  category: 'Cardiovascular' | 'Endocrine' | 'Analgesic' | 'Antibiotic' | 'Gastrointestinal' | 'Respiratory' | 'Neurology';
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
  category: 'Rasayana' | 'Vati / Guggulu' | 'Churna' | 'Kwatha' | 'Asava-Arishta' | 'Bhasma / Mineral (Sch E1)';
  isScheduleE1?: boolean;
  scheduleE1PoisonDetail?: string;
  pathya: string[];
  apathya: string[];
}

export const CLINICAL_ALLOPATHIC_FORMULARY: FormularyAllopathicItem[] = [
  { id: 'allo-1', name: 'Warfarin', genericName: 'Warfarin Sodium', dosage: '5 mg', route: 'ORAL', frequency: 'OD (Once Daily)', durationDays: 30, category: 'Cardiovascular' },
  { id: 'allo-2', name: 'Digoxin', genericName: 'Digoxin', dosage: '0.25 mg', route: 'ORAL', frequency: 'OD (Once Daily)', durationDays: 30, category: 'Cardiovascular' },
  { id: 'allo-3', name: 'Metformin', genericName: 'Metformin Hydrochloride', dosage: '500 mg', route: 'ORAL', frequency: 'BD (Twice Daily)', durationDays: 60, category: 'Endocrine' },
  { id: 'allo-4', name: 'Atorvastatin', genericName: 'Atorvastatin Calcium', dosage: '20 mg', route: 'ORAL', frequency: 'HS (Bedtime)', durationDays: 30, category: 'Cardiovascular' },
  { id: 'allo-5', name: 'Paracetamol', genericName: 'Acetaminophen', dosage: '650 mg', route: 'ORAL', frequency: 'TDS (Thrice Daily)', durationDays: 5, category: 'Analgesic' },
  { id: 'allo-6', name: 'Amoxicillin-Clavulanate', genericName: 'Amoxicillin + Clavulanic Acid', dosage: '625 mg', route: 'ORAL', frequency: 'BD (Twice Daily)', durationDays: 5, category: 'Antibiotic' },
  { id: 'allo-7', name: 'Amlodipine', genericName: 'Amlodipine Besylate', dosage: '5 mg', route: 'ORAL', frequency: 'OD (Once Daily)', durationDays: 30, category: 'Cardiovascular' },
  { id: 'allo-8', name: 'Telmisartan', genericName: 'Telmisartan', dosage: '40 mg', route: 'ORAL', frequency: 'OD (Morning)', durationDays: 30, category: 'Cardiovascular' },
  { id: 'allo-9', name: 'Pantoprazole', genericName: 'Pantoprazole Sodium', dosage: '40 mg', route: 'ORAL', frequency: 'OD (Empty Stomach)', durationDays: 14, category: 'Gastrointestinal' },
  { id: 'allo-10', name: 'Aspirin (Ecosprin)', genericName: 'Acetylsalicylic Acid', dosage: '75 mg', route: 'ORAL', frequency: 'OD (Post Lunch)', durationDays: 30, category: 'Cardiovascular' },
  { id: 'allo-11', name: 'Levothyroxine', genericName: 'Levothyroxine Sodium', dosage: '50 mcg', route: 'ORAL', frequency: 'OD (Early Morning Empty Stomach)', durationDays: 60, category: 'Endocrine' },
  { id: 'allo-12', name: 'Cetirizine', genericName: 'Cetirizine Hydrochloride', dosage: '10 mg', route: 'ORAL', frequency: 'HS (Night)', durationDays: 7, category: 'Respiratory' },
  { id: 'allo-13', name: 'Metoprolol Succinate', genericName: 'Metoprolol ER', dosage: '25 mg', route: 'ORAL', frequency: 'OD (Morning)', durationDays: 30, category: 'Cardiovascular' },
  { id: 'allo-14', name: 'Ciprofloxacin', genericName: 'Ciprofloxacin Hydrochloride', dosage: '500 mg', route: 'ORAL', frequency: 'BD (Twice Daily)', durationDays: 5, category: 'Antibiotic' }
];

export const CLINICAL_AYUSH_FORMULARY: FormularyAyushItem[] = [
  { id: 'ayush-1', classicalName: 'Yogaraja Guggulu', namasteCode: 'AYU-FORM-002', dosageForm: 'Vati / Tablet', dose: '2 tablets (500mg)', anupana: 'Koshna Jala (Warm Water) or Rasnadi Kwatha', frequency: 'BD (Twice Daily)', durationDays: 30, category: 'Vati / Guggulu', pathya: ['Light warm soups', 'Mudga yusha', 'Barley'], apathya: ['Curd', 'Cold drinks', 'Black gram'] },
  { id: 'ayush-2', classicalName: 'Shilajit Rasayana', namasteCode: 'AYU-FORM-004', dosageForm: 'Vati / Resin', dose: '1 tablet (250mg)', anupana: 'Godugdha (Warm Cow Milk)', frequency: 'BD (Twice Daily)', durationDays: 45, category: 'Rasayana', pathya: ['Cow ghee', 'Milk', 'Shali rice'], apathya: ['Horsegram (Kulatthi)', 'Excessive sour foods'] },
  { id: 'ayush-3', classicalName: 'Yashtimadhu Churna', namasteCode: 'AYU-FORM-003', dosageForm: 'Churna / Powder', dose: '3 grams', anupana: 'Godugdha (Warm Cow Milk) or Honey', frequency: 'BD (Twice Daily)', durationDays: 15, category: 'Churna', pathya: ['Sweet fruits', 'Ghee', 'Moong dal'], apathya: ['Pungent spices', 'Fried food'] },
  { id: 'ayush-4', classicalName: 'Sudarshana Ghanavati', namasteCode: 'AYU-FORM-007', dosageForm: 'Ghanavati / Extract Tablet', dose: '2 tablets', anupana: 'Koshna Jala (Warm Water)', frequency: 'TDS (Thrice Daily)', durationDays: 5, category: 'Vati / Guggulu', pathya: ['Boiled water', 'Light gruel (Peya)'], apathya: ['Heavy meals', 'Cold baths'] },
  { id: 'ayush-5', classicalName: 'Ashwagandha Rasayana', namasteCode: 'AYU-FORM-001', dosageForm: 'Avaleha / Churna', dose: '5 grams', anupana: 'Godugdha (Warm Cow Milk)', frequency: 'BD (Twice Daily)', durationDays: 60, category: 'Rasayana', pathya: ['Fresh fruits', 'Almonds', 'Milk'], apathya: ['Stale food', 'Excessive exertion'] },
  { id: 'ayush-6', classicalName: 'Triphala Churna', namasteCode: 'AYU-FORM-005', dosageForm: 'Churna', dose: '3-5 grams', anupana: 'Koshna Jala (Lukewarm Water) at bedtime', frequency: 'HS (Bedtime)', durationDays: 30, category: 'Churna', pathya: ['High fiber vegetables', 'Buttermilk'], apathya: ['Late night snacking'] },
  { id: 'ayush-7', classicalName: 'Avipattikar Churna', namasteCode: 'AYU-CH-006', dosageForm: 'Churna', dose: '3 grams', anupana: 'Sheetala Jala (Cool Water) or Madhu', frequency: 'BD (Before Meals)', durationDays: 21, category: 'Churna', pathya: ['Pomegranate', 'Old rice', 'Barley water'], apathya: ['Pickles', 'Deep fried food', 'Spices'] },
  { id: 'ayush-8', classicalName: 'Arogyavardhini Vati', namasteCode: 'AYU-VAT-008', dosageForm: 'Vati', dose: '2 tablets (500mg)', anupana: 'Koshna Jala or Punarnavasava', frequency: 'BD (After Meals)', durationDays: 30, category: 'Bhasma / Mineral (Sch E1)', isScheduleE1: true, scheduleE1PoisonDetail: 'Contains Shuddha Parada (Purified Mercury) & Shuddha Gandhaka (Purified Sulphur) - D&C Act 1940 Rule 161 Applicable', pathya: ['Moong dal soup', 'Papaya', 'Gourds'], apathya: ['Alcohol', 'Heavy oily curries', 'Day sleeping'] },
  { id: 'ayush-9', classicalName: 'Chandraprabha Vati', namasteCode: 'AYU-VAT-015', dosageForm: 'Vati', dose: '2 tablets (500mg)', anupana: 'Godugdha or Chandanasava', frequency: 'BD (After Food)', durationDays: 30, category: 'Bhasma / Mineral (Sch E1)', isScheduleE1: true, scheduleE1PoisonDetail: 'Contains Shuddha Shilajit & Loha Bhasma (Calcined Iron) - D&C Act Rule 161 Attestation', pathya: ['Cucumber', 'Coconut water', 'Barley'], apathya: ['Excessive salt', 'Chilli', 'Sun exposure'] },
  { id: 'ayush-10', classicalName: 'Rasnasaptaka Kwatha', namasteCode: 'AYU-KW-042', dosageForm: 'Kwatha (Decoction)', dose: '15 ml with equal warm water', anupana: 'Koshna Jala (Warm Water)', frequency: 'BD (After Meals)', durationDays: 30, category: 'Kwatha', pathya: ['Garlic rasam', 'Ginger water', 'Warm rice'], apathya: ['Curd', 'Cold water', 'Sprouted grains'] },
  { id: 'ayush-11', classicalName: 'Sitopaladi Churna', namasteCode: 'AYU-CH-038', dosageForm: 'Churna', dose: '3 grams', anupana: 'Madhu (Honey) + Ghrita (Ghee)', frequency: 'TDS (Thrice Daily)', durationDays: 10, category: 'Churna', pathya: ['Warm turmeric milk', 'Raisins', 'Steam inhalation'], apathya: ['Ice cream', 'Cold beverages', 'Dust exposure'] },
  { id: 'ayush-12', classicalName: 'Nishamalaki Vati', namasteCode: 'AYU-VAT-031', dosageForm: 'Vati', dose: '2 tablets (500mg)', anupana: 'Koshna Jala', frequency: 'BD (Before Meals)', durationDays: 60, category: 'Vati / Guggulu', pathya: ['Methi seeds', 'Bitter gourd', 'Yava'], apathya: ['Sweets', 'Potatoes', 'Couch potato sedentary habit'] },
  { id: 'ayush-13', classicalName: 'Brahmi Vati', namasteCode: 'AYU-VAT-019', dosageForm: 'Vati', dose: '1 tablet (250mg)', anupana: 'Godugdha (Warm Cow Milk)', frequency: 'BD (Morning & Bedtime)', durationDays: 45, category: 'Vati / Guggulu', pathya: ['Almonds', 'Cow ghee', 'Meditation'], apathya: ['Late night screen time', 'Stress', 'Caffeine'] },
  { id: 'ayush-14', classicalName: 'Guduchi Ghanavati', namasteCode: 'AYU-VAT-025', dosageForm: 'Ghanavati', dose: '1 tablet (500mg)', anupana: 'Koshna Jala', frequency: 'BD (After Meals)', durationDays: 30, category: 'Vati / Guggulu', pathya: ['Fresh fruits', 'Seasonal vegetables'], apathya: ['Fast food', 'Stale refrigerated food'] },
  { id: 'ayush-15', classicalName: 'Shallaki (Boswellia serrata)', namasteCode: 'AYU-SHA-001', dosageForm: 'Extract Tablet', dose: '1 tablet (500mg)', anupana: 'Koshna Jala (Warm Water)', frequency: 'BD (After Food)', durationDays: 30, category: 'Vati / Guggulu', pathya: ['Warm light soups', 'Sesame oil massage'], apathya: ['Cold air exposure', 'Dry refrigerated foods'] },
  { id: 'ayush-16', classicalName: 'Haridra Khanda', namasteCode: 'AYU-KHA-009', dosageForm: 'Granules', dose: '3 grams', anupana: 'Godugdha (Warm Cow Milk)', frequency: 'BD (After Food)', durationDays: 21, category: 'Churna', pathya: ['Warm milk', 'Turmeric', 'Easily digestible rice'], apathya: ['Sour curd', 'Fish', 'Stale food'] },
  { id: 'ayush-17', classicalName: 'Draksharishta', namasteCode: 'AYU-ARI-012', dosageForm: 'Asava-Arishta', dose: '20 ml with equal water', anupana: 'Equal quantity of water', frequency: 'BD (After Meals)', durationDays: 30, category: 'Asava-Arishta', pathya: ['Pomegranate', 'Fresh dates', 'Cow milk'], apathya: ['Excessive fasting', 'Very spicy food'] },
  { id: 'ayush-18', classicalName: 'Arjuna Kwatha', namasteCode: 'AYU-KW-018', dosageForm: 'Decoction / Kwatha', dose: '20 ml', anupana: 'Godugdha or Warm Water', frequency: 'BD (Twice Daily)', durationDays: 30, category: 'Kwatha', pathya: ['Garlic in diet', 'Cow ghee in moderation', 'Fiber'], apathya: ['Smoking', 'Sedentary lifestyle', 'Heavy fried meals'] }
];
