import { SessionDetail, AyushFormulation } from '../types/api';

export interface ClinicalDietaryGuidance {
  pathya: string;
  apathya: string;
  source: 'FORMULATION_SPECIFIC' | 'PRAKRITI_TAILORED' | 'ADVISORY' | 'GENERAL';
  agniAdvisory?: string;
}

/**
 * Derives patient-specific Charaka Samhita & Sushruta Samhita Pathya & Apathya dynamically from:
 * 1. Active prescribed classical AYUSH formulations & statutory Anupana
 * 2. Dashavidha Pariksha (Prakriti, Vikriti & Agni status)
 * 3. Maternal / Pregnancy physiological status (Garbhini Pathya)
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
      source: 'ADVISORY',
      agniAdvisory: session.pariksha?.agni ? `Digestive state: ${session.pariksha.agni}` : undefined
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
        ? Array.from(new Set(formPathya)).join(', ') 
        : 'Warm water (*Ushnodaka*), light easily digestible diet (*Laghu Ahara*), seasonal gourds.',
      apathya: formApathya.length > 0 
        ? Array.from(new Set(formApathya)).join(', ') 
        : 'Refrigerated drinks (*Sheetala Anna*), heavy fried meals, daytime sleep (*Diva Swapna*).',
      source: 'FORMULATION_SPECIFIC',
      agniAdvisory: session?.pariksha?.agni ? `Digestive state: ${session.pariksha.agni}` : undefined
    };
  }

  // 3. Maternal / Pregnancy guidance (Garbhini Pathya - Charaka Sharirasthana Ch. 8)
  if (session?.isPregnant) {
    return {
      pathya: 'Garbhini Pathya: Medicated cow milk (*Kshira Paka*), sweet black grapes (*Draksha*), pomegranate, boiled shashtika rice with cow ghee (*Ghrita*), warm moong dal broth.',
      apathya: 'Garbha Upaghatakara: Raw papaya, sesame seeds (*Tila*), heavy fasting (*Upavasa*), extreme pungent/sour spices (*Katu-Amla*), daytime sleeping (*Diva Swapna*).',
      source: 'PRAKRITI_TAILORED',
      agniAdvisory: 'Gentle bio-nourishing nourishment without Agni vitiation'
    };
  }

  // 4. Derive dynamically from Prakriti, Vikriti & Agni
  const prakriti = (session?.pariksha?.prakriti || '').toLowerCase();
  const vikriti = (session?.pariksha?.vikriti || '').toLowerCase();
  const agni = (session?.pariksha?.agni || '').toUpperCase();

  let agniNote = '';
  if (agni === 'MANDAGNI') {
    agniNote = 'Low metabolic digestive fire: consume warm ginger water (Shunti Jala) before meals.';
  } else if (agni === 'TIKSHNAGNI') {
    agniNote = 'High metabolic heat: consume cooling sweet gruels, milk, and ghee.';
  } else if (agni === 'VISHAMAGNI') {
    agniNote = 'Irregular variable digestion: adhere to strict fixed meal timings with warm soups.';
  }

  if (prakriti.includes('pitta-vata') || prakriti.includes('vata-pitta') || vikriti.includes('pitta')) {
    return {
      pathya: 'Warm medicated water (*Ushnodaka*), light moong dal soup (*Mudga Yusha*), barley gruel, sweet seasonal gourds, cooling cow ghee (*Ghrita*).',
      apathya: 'Refrigerated cold drinks, fermented curd at night (*Nisha Dadhi*), deep-fried foods, excessive chili/sour spices (*Katu/Amla*), day sleep (*Diva Swapna*).',
      source: 'PRAKRITI_TAILORED',
      agniAdvisory: agniNote || undefined
    };
  }

  if (prakriti.includes('kapha-pitta') || prakriti.includes('pitta-kapha') || vikriti.includes('kapha')) {
    return {
      pathya: 'Warm water with dry ginger (*Shunti*), boiled barley (*Yava*), roasted grams, bitter vegetables (*Karavellaka*), light vegetable soups.',
      apathya: 'Heavy sweets (*Madhura*), cold refrigerated dairy, banana, oily/fried items (*Snigdha*), cold showers, day sleep (*Diva Swapna*).',
      source: 'PRAKRITI_TAILORED',
      agniAdvisory: agniNote || undefined
    };
  }

  if (prakriti.includes('vata') || vikriti.includes('vata')) {
    return {
      pathya: 'Freshly cooked warm meals (*Ushna Anna*), sesame oil seasoning (*Snehana*), warm cow milk with dashamula/turmeric, hot wheat & rice preparations.',
      apathya: 'Dry raw salads (*Ruksha*), cold aerated beverages, fasting (*Upavasa*), late-night meals (*Ratri Bhojana*), cold dry wind exposure.',
      source: 'PRAKRITI_TAILORED',
      agniAdvisory: agniNote || undefined
    };
  }

  return {
    pathya: 'Freshly cooked warm meals (*Laghu Anna*), boiled warm water (*Ushnodaka*), seasonal easily digestible vegetables.',
    apathya: 'Stale/reheated food (*Paryushita*), cold refrigerated drinks (*Sheetala Anna*), incompatible foods (*Viruddha Ahara*).',
    source: 'GENERAL',
    agniAdvisory: agniNote || undefined
  };
}
