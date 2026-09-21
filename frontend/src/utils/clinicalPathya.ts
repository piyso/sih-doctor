import { SessionDetail, AyushFormulation } from '../types/api';

export interface ClinicalDietaryGuidance {
  pathya: string;
  apathya: string;
  source: 'FORMULATION_SPECIFIC' | 'PRAKRITI_TAILORED' | 'ADVISORY' | 'GENERAL';
}

/**
 * Derives patient-specific Charaka Samhita Pathya & Apathya dynamically from:
 * 1. Active prescribed classical AYUSH formulations
 * 2. Dashavidha Pariksha (Prakriti & Vikriti)
 * 3. Maternal / Pregnancy physiological status
 * 4. Explicit session clinical advisory
 */
export function getDynamicDietaryGuidance(
  session: SessionDetail | null,
  ayushFormulations: AyushFormulation[] = []
): ClinicalDietaryGuidance {
  // 1. If explicit advisory exists on session
  if (session?.parikshaAdvisory?.dietaryPathya || session?.parikshaAdvisory?.strictApathya) {
    return {
      pathya: session.parikshaAdvisory.dietaryPathya || 'Warm medicated water (Ushnodaka), light easily digestible meals (Laghu Ahara).',
      apathya: session.parikshaAdvisory.strictApathya || 'Cold refrigerated drinks, heavy fried foods, day sleep (Diva Swapna).',
      source: 'ADVISORY'
    };
  }

  // 2. If formulations are prescribed and contain specific pathya/apathya
  const formPathya = ayushFormulations
    .flatMap(f => f.pathya || [])
    .filter(Boolean);
  const formApathya = ayushFormulations
    .flatMap(f => f.apathya || [])
    .filter(Boolean);

  if (formPathya.length > 0 || formApathya.length > 0) {
    return {
      pathya: formPathya.length > 0 
        ? formPathya.join(', ') 
        : 'Warm water (Ushnodaka), light easily digestible diet (Laghu Ahara).',
      apathya: formApathya.length > 0 
        ? formApathya.join(', ') 
        : 'Refrigerated drinks, heavy fried meals, daytime sleep (Diva Swapna).',
      source: 'FORMULATION_SPECIFIC'
    };
  }

  // 3. Maternal / Pregnancy guidance
  if (session?.isPregnant) {
    return {
      pathya: 'Garbhini Pathya: Medicated milk (Kshira Paka), sweet grapes (Draksha), pomegranate, boiled shashtika rice with cow ghee, warm fluid broths.',
      apathya: 'Garbha Upaghatakara: Raw papaya, sesame seeds (Tila), heavy fasting (Upavasa), extreme pungent/sour spices, day sleep.',
      source: 'PRAKRITI_TAILORED'
    };
  }

  // 4. Derive dynamically from Prakriti & Vikriti
  const prakriti = (session?.pariksha?.prakriti || '').toLowerCase();
  const vikriti = (session?.pariksha?.vikriti || '').toLowerCase();

  if (prakriti.includes('pitta-vata') || prakriti.includes('vata-pitta') || vikriti.includes('pitta')) {
    return {
      pathya: 'Warm medicated water (*Ushnodaka*), light moong dal soup (*Mudga Yusha*), barley gruel, sweet seasonal gourds, cooling cow ghee (*Ghrita*).',
      apathya: 'Refrigerated cold drinks, fermented curd at night (*Nisha Dadhi*), deep-fried foods, excessive chili/sour spices (*Katu/Amla*), day sleep (*Diva Swapna*).',
      source: 'PRAKRITI_TAILORED'
    };
  }

  if (prakriti.includes('kapha-pitta') || prakriti.includes('pitta-kapha') || vikriti.includes('kapha')) {
    return {
      pathya: 'Warm water with dry ginger (*Shunti*), boiled barley (*Yava*), roasted grams, bitter vegetables (*Karavellaka*), light vegetable soups.',
      apathya: 'Heavy sweets (*Madhura*), cold refrigerated dairy, banana, oily/fried items (*Snigdha*), cold showers, day sleep (*Diva Swapna*).',
      source: 'PRAKRITI_TAILORED'
    };
  }

  if (prakriti.includes('vata') || vikriti.includes('vata')) {
    return {
      pathya: 'Freshly cooked warm meals (*Ushna Anna*), sesame oil seasoning (*Snehana*), warm cow milk with dashamula/turmeric, hot wheat & rice preparations.',
      apathya: 'Dry raw salads (*Ruksha*), cold aerated beverages, fasting (*Upavasa*), late-night meals (*Ratri Bhojana*), cold dry wind exposure.',
      source: 'PRAKRITI_TAILORED'
    };
  }

  return {
    pathya: 'Freshly cooked warm meals (*Laghu Anna*), boiled warm water (*Ushnodaka*), seasonal easily digestible vegetables.',
    apathya: 'Stale/reheated food (*Paryushita*), cold refrigerated drinks (*Sheetala Anna*), incompatible foods (*Viruddha Ahara*).',
    source: 'GENERAL'
  };
}
