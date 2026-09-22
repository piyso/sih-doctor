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
  { id: 'allo-7', name: 'Amlodipine', genericName: 'Amlodipine Besylate', dosage: '5 mg', route: 'ORAL', frequency: 'OD (Once Daily)', durationDays: 30 },
  { id: 'allo-8', name: 'Telmisartan', genericName: 'Telmisartan', dosage: '40 mg', route: 'ORAL', frequency: 'OD (Morning)', durationDays: 30 },
  { id: 'allo-9', name: 'Pantoprazole', genericName: 'Pantoprazole Sodium', dosage: '40 mg', route: 'ORAL', frequency: 'OD (Empty Stomach)', durationDays: 14 },
  { id: 'allo-10', name: 'Aspirin (Ecosprin)', genericName: 'Acetylsalicylic Acid', dosage: '75 mg', route: 'ORAL', frequency: 'OD (Post Lunch)', durationDays: 30 },
  { id: 'allo-11', name: 'Levothyroxine', genericName: 'Levothyroxine Sodium', dosage: '50 mcg', route: 'ORAL', frequency: 'OD (Early Morning Empty Stomach)', durationDays: 60 },
  { id: 'allo-12', name: 'Cetirizine', genericName: 'Cetirizine Hydrochloride', dosage: '10 mg', route: 'ORAL', frequency: 'HS (Night)', durationDays: 7 },
  { id: 'allo-13', name: 'Metoprolol Succinate', genericName: 'Metoprolol ER', dosage: '25 mg', route: 'ORAL', frequency: 'OD (Morning)', durationDays: 30 },
  { id: 'allo-14', name: 'Ciprofloxacin', genericName: 'Ciprofloxacin Hydrochloride', dosage: '500 mg', route: 'ORAL', frequency: 'BD (Twice Daily)', durationDays: 5 }
];

export const CLINICAL_AYUSH_FORMULARY: FormularyAyushItem[] = [
  { id: 'ayush-1', classicalName: 'Yogaraja Guggulu', namasteCode: 'AYU-FORM-002', dosageForm: 'Vati / Tablet', dose: '2 tablets (500mg)', anupana: 'Koshna Jala (Warm Water) or Rasnadi Kwatha', frequency: 'BD (Twice Daily)', durationDays: 30, pathya: ['Light warm soups', 'Mudga yusha', 'Barley'], apathya: ['Curd', 'Cold drinks', 'Black gram'] },
  { id: 'ayush-2', classicalName: 'Shilajit Rasayana', namasteCode: 'AYU-FORM-004', dosageForm: 'Vati / Resin', dose: '1 tablet (250mg)', anupana: 'Godugdha (Warm Cow Milk)', frequency: 'BD (Twice Daily)', durationDays: 45, pathya: ['Cow ghee', 'Milk', 'Shali rice'], apathya: ['Horsegram (Kulatthi)', 'Excessive sour foods'] },
  { id: 'ayush-3', classicalName: 'Yashtimadhu Churna', namasteCode: 'AYU-FORM-003', dosageForm: 'Churna / Powder', dose: '3 grams', anupana: 'Godugdha (Warm Cow Milk) or Honey', frequency: 'BD (Twice Daily)', durationDays: 15, pathya: ['Sweet fruits', 'Ghee', 'Moong dal'], apathya: ['Pungent spices', 'Fried food'] },
  { id: 'ayush-4', classicalName: 'Sudarshana Ghanavati', namasteCode: 'AYU-FORM-007', dosageForm: 'Ghanavati / Extract Tablet', dose: '2 tablets', anupana: 'Koshna Jala (Warm Water)', frequency: 'TDS (Thrice Daily)', durationDays: 5, pathya: ['Boiled water', 'Light gruel (Peya)'], apathya: ['Heavy meals', 'Cold baths'] },
  { id: 'ayush-5', classicalName: 'Ashwagandha Rasayana', namasteCode: 'AYU-FORM-001', dosageForm: 'Avaleha / Churna', dose: '5 grams', anupana: 'Godugdha (Warm Cow Milk)', frequency: 'BD (Twice Daily)', durationDays: 60, pathya: ['Fresh fruits', 'Almonds', 'Milk'], apathya: ['Stale food', 'Excessive exertion'] },
  { id: 'ayush-6', classicalName: 'Triphala Churna', namasteCode: 'AYU-FORM-005', dosageForm: 'Churna', dose: '3-5 grams', anupana: 'Koshna Jala (Lukewarm Water) at bedtime', frequency: 'HS (Bedtime)', durationDays: 30, pathya: ['High fiber vegetables', 'Buttermilk'], apathya: ['Late night snacking'] },
  { id: 'ayush-7', classicalName: 'Avipattikar Churna', namasteCode: 'AYU-CH-006', dosageForm: 'Churna', dose: '3 grams', anupana: 'Sheetala Jala (Cool Water) or Madhu', frequency: 'BD (Before Meals)', durationDays: 21, pathya: ['Pomegranate', 'Old rice', 'Barley water'], apathya: ['Pickles', 'Deep fried food', 'Spices'] },
  { id: 'ayush-8', classicalName: 'Arogyavardhini Vati', namasteCode: 'AYU-VAT-008', dosageForm: 'Vati', dose: '2 tablets (500mg)', anupana: 'Koshna Jala or Punarnavasava', frequency: 'BD (After Meals)', durationDays: 30, pathya: ['Moong dal soup', 'Papaya', 'Gourds'], apathya: ['Alcohol', 'Heavy oily curries', 'Day sleeping'] },
  { id: 'ayush-9', classicalName: 'Chandraprabha Vati', namasteCode: 'AYU-VAT-015', dosageForm: 'Vati', dose: '2 tablets (500mg)', anupana: 'Godugdha or Chandanasava', frequency: 'BD (After Food)', durationDays: 30, pathya: ['Cucumber', 'Coconut water', 'Barley'], apathya: ['Excessive salt', 'Chilli', 'Sun exposure'] },
  { id: 'ayush-10', classicalName: 'Rasnasaptaka Kwatha', namasteCode: 'AYU-KW-042', dosageForm: 'Kwatha (Decoction)', dose: '15 ml with equal warm water', anupana: 'Koshna Jala (Warm Water)', frequency: 'BD (After Meals)', durationDays: 30, pathya: ['Garlic rasam', 'Ginger water', 'Warm rice'], apathya: ['Curd', 'Cold water', 'Sprouted grains'] },
  { id: 'ayush-11', classicalName: 'Sitopaladi Churna', namasteCode: 'AYU-CH-038', dosageForm: 'Churna', dose: '3 grams', anupana: 'Madhu (Honey) + Ghrita (Ghee)', frequency: 'TDS (Thrice Daily)', durationDays: 10, pathya: ['Warm turmeric milk', 'Raisins', 'Steam inhalation'], apathya: ['Ice cream', 'Cold beverages', 'Dust exposure'] },
  { id: 'ayush-12', classicalName: 'Nishamalaki Vati', namasteCode: 'AYU-VAT-031', dosageForm: 'Vati', dose: '2 tablets (500mg)', anupana: 'Koshna Jala', frequency: 'BD (Before Meals)', durationDays: 60, pathya: ['Methi seeds', 'Bitter gourd', 'Yava'], apathya: ['Sweets', 'Potatoes', 'Couch potato sedentary habit'] },
  { id: 'ayush-13', classicalName: 'Brahmi Vati', namasteCode: 'AYU-VAT-019', dosageForm: 'Vati', dose: '1 tablet (250mg)', anupana: 'Godugdha (Warm Cow Milk)', frequency: 'BD (Morning & Bedtime)', durationDays: 45, pathya: ['Almonds', 'Cow ghee', 'Meditation'], apathya: ['Late night screen time', 'Stress', 'Caffeine'] },
  { id: 'ayush-14', classicalName: 'Guduchi Ghanavati', namasteCode: 'AYU-VAT-025', dosageForm: 'Ghanavati', dose: '1 tablet (500mg)', anupana: 'Koshna Jala', frequency: 'BD (After Meals)', durationDays: 30, pathya: ['Fresh fruits', 'Seasonal vegetables'], apathya: ['Fast food', 'Stale refrigerated food'] }
];
