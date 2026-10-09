/**
 * Fixed-dose combinations prohibited for human use under Section 26A of the Drugs and Cosmetics
 * Act, 1940. Matching is by ingredient set (order-free), so a brand or a re-ordered name still
 * matches; where the notification names a strength, only that strength is prohibited (e.g. the
 * Aceclofenac 50 mg + Paracetamol 125 mg tablet is banned, the common 100 + 325 tablet is not).
 *
 * Sources:
 *  - Gazette notifications S.O. 3285(E)–S.O. 3440(E), August 2024 (156 FDCs), as tabulated by
 *    Medical Dialogues, 2024-08-23, and the Goa FDA advisory DI/NB/AXP/AS/LT/2024/538.
 *  - June 2023 notification (14 FDCs); the seven combinations named in press reports are listed.
 * Check cdsco.gov.in for later notifications and for court orders on individual entries.
 */

export interface BannedFdc {
  components: string[];          // normalised ingredient names (see normaliseIngredient)
  strengthsMg?: number[];        // in the same order as components, when the notification names strengths
  form?: string;
  notification: string;
  label: string;
}

const SALT_WORDS = /\b(hcl|hydrochloride|hydrobromide|sodium|potassium|magnesium|calcium|maleate|sulphate|sulfate|citrate|tartrate|bromide|anhydrous|monohydrate|trihydrate|hydrate|phosphate|acetate|ip|bp|usp|eq\.?|equivalent|to|as|enteric|coated|tablet|tablets|tab|capsule|cap|syrup|suspension|injection|oral|liquid|dispersible|eye|ointment|drops|cream|gel|spray|solution|dried|weak|tincture|extract|extracts|elemental|light|compound)\b/g;

const SYNONYMS: Record<string, string> = {
  acelofenac: 'aceclofenac', guaiphenesin: 'guaifenesin', pentazocin: 'pentazocine', 'acetyl cysteine': 'acetylcysteine', 'n-acetylcysteine': 'acetylcysteine',
  'chlorpheniramine': 'chlorpheniramine', chlorphenamine: 'chlorpheniramine', cpm: 'chlorpheniramine', 'hydroxy propyl methyl cellulose': 'hpmc', 'hydroxypropyl methylcellulose': 'hpmc',
  levetiracitam: 'levetiracetam', 'divalproex': 'valproate', 'sodium valproate': 'valproate', paracetamol: 'paracetamol', acetaminophen: 'paracetamol',
  'diclofenac': 'diclofenac', 'cephalexin': 'cephalexin', cefalexin: 'cephalexin', 'phenyl propanolamine': 'phenylpropanolamine', 'ursodeoxycholicacid': 'ursodeoxycholic acid',
  'vitamin b12': 'cyanocobalamin', 'vit d3': 'vitamin d3', 'vit e': 'vitamin e', 'flurometholone': 'fluorometholone', 'simethicone': 'simethicone', dimethicone: 'dimethicone',
  'lactobacillus rhamnosus': 'lactobacillus', 'lactobacillus reuteri rc': 'lactobacillus', 'lactic acid bacillus': 'lactobacillus', 'salicyclic acid': 'salicylic acid',
  camylofin: 'camylofin', 'camylofin dihydrochloride': 'camylofin', 'diacerin': 'diacerein'
};

/** Normalises one ingredient phrase from a notification or a prescription line. */
export function normaliseIngredient(raw: string): string {
  let s = raw.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[\d.]+\s*(mg|mcg|µg|g|ml|iu|%\s*w\/w|%)?/g, ' ');
  s = s.replace(/[^a-z\- ]/g, ' ').replace(/\s+/g, ' ').trim();
  // Strip salt and form words, but keep a name that is only salt words ("sodium citrate").
  const stripped = s.replace(SALT_WORDS, ' ').replace(/\s+/g, ' ').trim();
  const out = stripped || s;
  return SYNONYMS[out] || out;
}

/** Splits "A 50mg + B 125 mg" into components with any stated strengths. */
export function splitCombination(name: string): Array<{ ingredient: string; strengthMg?: number }> {
  return name.split(/\s*\+\s*|\s+with\s+|\s*&\s*/i).map(part => {
    const m = part.match(/(\d+(?:\.\d+)?)\s*(mg|g|mcg)\b/i);
    const strength = m ? Number(m[1]) * (m[2].toLowerCase() === 'g' ? 1000 : m[2].toLowerCase() === 'mcg' ? 0.001 : 1) : undefined;
    return { ingredient: normaliseIngredient(part), strengthMg: strength };
  }).filter(p => p.ingredient);
}

const S24 = (n: number) => `S.O. ${3284 + n}(E), Aug 2024`;
const B = (n: number, label: string, form?: string, strengths?: number[]): BannedFdc => {
  const parts = splitCombination(label);
  return { components: parts.map(p => p.ingredient), strengthsMg: strengths, form, notification: S24(n), label };
};

export const BANNED_FDCS: BannedFdc[] = [
  B(1, 'Amylase + Protease + Glucoamylase + Pectinase + Alpha Galactosidase + Lactase + Beta-Gluconase + Cellulase + Lipase + Bromelain + Xylanase + Hemicellulase + Malt diastase + Invertase + Papain'),
  B(2, 'Antimony Potassium Tartrate + Ferrous Sulphate'),
  B(3, 'Benfotiamine + Silymarin + L-Ornithine L-aspartate + Sodium Selenite + Folic acid + Pyridoxine'),
  B(4, 'Bismuth Ammonium Citrate + Papain'),
  B(5, 'Cyproheptadine + Thiamine + Riboflavine + Pyridoxine + Niacinamide'),
  B(6, 'Cyproheptadine + Tricholine Citrate + Thiamine + Riboflavine + Pyridoxine'),
  B(7, 'Rabeprazole + Clidinium + Dicyclomine + Chlordiazepoxide'),
  B(8, 'Fungal Diastase + Papain + Nux vomica + Cardamom + Casein Hydrolysed + Alcohol'),
  B(9, 'Mefenamic Acid + Paracetamol', 'injection'),
  B(10, 'Omeprazole + Dicyclomine'),
  B(11, 'S-adenosyl methionine + Metadoxine + Ursodeoxycholic acid + L-Methylfolate + Choline bitartrate + Silymarin + L-ornithine L-aspartate + Inositol + Taurine'),
  B(12, 'Silymarin + Thiamine Mononitrate + Riboflavin + Pyridoxine + Niacinamide + Calcium pantothenate + Vitamin B12'),
  B(13, 'Silymarin + Pyridoxine + Cyanocobalamin + Niacinamide + Folic Acid'),
  B(14, 'Silymarin + Vitamin B6 + Vitamin B12 + Niacinamide + Folic acid + Tricholine Citrate'),
  B(15, 'Sodium Citrate + Citric Acid + Cardamom Oil + Caraway Oil + Cinnamon Oil + Clove Oil + Ginger Oil + Alcohol'),
  B(16, 'Sucralfate + Aceclofenac'),
  B(17, 'Sucralfate + Domperidone + Dimethicone'),
  B(18, 'Sucralfate + Domperidone'),
  B(19, 'Ipecacuanha + Urgenia + Camphorated Opium + Aromatic Spirit of Ammonia + Chloroform + Alcohol'),
  B(20, 'Ursodeoxycholic Acid + Metformin'),
  B(21, 'Ginger + Aromatic Spirit of Ammonia + Peppermint Spirit + Chloroform + Sodium Bicarbonate + Cardamom + Alcohol'),
  B(22, 'Sucralfate + Pantoprazole + Zinc Gluconate + Magnesium Carbonate'),
  B(23, 'Aloe + Vitamin E Soap', 'topical'),
  B(24, 'Povidone Iodine + Metronidazole + Aloe', 'topical'),
  B(25, 'Azelaic acid + Tea Tree Oil + Salicylic acid + Allantoin + Zinc oxide + Aloe vera + Jojoba oil + Vitamin E + Soap noodles', 'topical'),
  B(26, 'Azithromycin + Adapalene', 'topical'),
  B(27, 'Calamine + Aloes + Allantoin', 'topical'),
  B(28, 'Calamine + Diphenhydramine + Aloe + Glycerine + Camphor', 'topical'),
  B(29, 'Chlorphenesin + Zinc oxide + Starch', 'topical'),
  B(30, 'Clindamycin Phosphate + Zinc acetate', 'topical'),
  B(31, 'Gamma Benzene Hexachloride + Benzocaine', 'topical'),
  B(32, 'Glucosamine + Diacerein + Menthol + Camphor + Capsaicin', 'topical'),
  B(33, 'Hydroxyquinone + Octyl Methoxycinnamate + Oxybenzone', 'topical'),
  B(34, 'Ketoconazole + Zinc Pyrithione + D-Panthenol + Tea Tree Oil + Aloes', 'topical'),
  B(35, 'Ketoconazole + Aloe vera + Vitamin A', 'topical'),
  B(36, 'Ketoconazole + Aloes + ZPTO', 'topical'),
  B(37, 'Kojic Acid + Arbutin + Octinoxate + Vitamin E + Mulberry', 'topical'),
  B(38, 'Lornoxicam + Capsaicin + Menthol + Camphor', 'topical'),
  B(39, 'Lornoxicam + Thiocolchicoside + Oleum Lini + Menthol + Methyl salicylate', 'topical'),
  B(40, 'Menthol + Aloe vera', 'topical spray'),
  B(41, 'Menthol + Lignocaine + Aloe vera + Clotrimazole + Diphenhydramine', 'topical'),
  B(42, 'Miconazole + Gentamicin + Fluocinolone + Zinc Sulphate', 'topical'),
  B(43, 'Miconazole + Tinidazole', 'topical'),
  B(44, 'Minoxidil + Aminexil + Alcohol', 'topical'),
  B(45, 'Minoxidil + Azelaic acid + Saw palmetto', 'topical'),
  B(46, 'Minoxidil + Aminexil', 'topical'),
  B(47, 'Pine Bark + Kojic acid + Sodium Ascorbyl Phosphate', 'topical'),
  B(48, 'Povidone Iodine + Tinidazole + Zinc sulphate', 'topical'),
  B(49, 'Povidone Iodine + Ornidazole + Dexpanthenol', 'topical'),
  B(50, 'Salicylic acid + Aloe vera + Allantoin + D-Panthenol', 'topical'),
  B(51, 'Silver sulphadiazine + Chlorhexidine + Allantoin + Aloe vera + Vitamin E', 'topical'),
  B(52, 'Sodium salicylate + Zinc gluconate + Pyridoxine'),
  B(53, 'Tetracycline + Colistin'),
  B(54, 'Clomiphene + Ubidecarenone'),
  B(55, 'Clomiphene + Estradiol Valerate', 'combikit'),
  B(56, 'Flavoxate + Ofloxacin'),
  B(57, 'Clomiphene + N-Acetylcysteine'),
  B(58, 'Primrose Oil + Cod liver oil'),
  B(59, 'Sildenafil + Papaverine + L-Arginine'),
  B(60, 'Tranexamic acid + Mefenamic acid + Vitamin K1'),
  B(61, 'Divalproex + Oxcarbazepine'),
  B(62, 'Divalproex + Levetiracetam'),
  B(63, 'Ergotamine + Caffeine + Paracetamol + Prochlorperazine'),
  B(64, 'Piracetam + Ginkgo biloba + Vinpocetine'),
  B(65, 'Ginkgo biloba + Methylcobalamin'),
  B(66, 'Ginkgo biloba + Methylcobalamin + Alpha lipoic acid + Pyridoxine'),
  B(67, 'Ginseng + Ginkgo Biloba'),
  B(68, 'Meclizine + Paracetamol + Caffeine'),
  B(69, 'Nicergoline + Vinpocetine'),
  B(70, 'Gamma Linolenic Acid + Methylcobalamin'),
  B(71, 'Beclomethasone + Neomycin + Clotrimazole + Lignocaine', 'ear/topical'),
  B(72, 'Boric acid + Phenylephrine + Naphazoline + Menthol + Camphor', 'eye/nasal'),
  B(73, 'Naphazoline + Chlorpheniramine + Zinc Sulphate + Hydroxy Propyl Methyl Cellulose', 'eye'),
  B(74, 'Chlorpheniramine + Naphazoline + Zinc Sulphate + Sodium Chloride + Hydroxy Propyl Methyl Cellulose', 'eye'),
  B(75, 'Chlorpheniramine + Naphazoline + Hydroxy Propyl Methyl Cellulose', 'eye'),
  B(76, 'Chlorpheniramine + Sodium Chloride + Boric Acid + Tetrahydrozoline', 'eye'),
  B(77, 'Chlorpheniramine + Phenylephrine + Antipyrine', 'eye'),
  B(78, 'Ketorolac + Chlorpheniramine + Phenylephrine + Hydroxy Propyl Methyl Cellulose', 'eye'),
  B(79, 'Ketorolac + Fluorometholone', 'eye'),
  B(80, 'Naphazoline + Zinc Sulphate + Boric Acid + Sodium Chloride + Chlorpheniramine', 'eye'),
  B(81, 'Naphazoline + Hydroxy Propyl Methyl Cellulose + Boric Acid + Borax + Menthol + Camphor', 'eye'),
  B(82, 'Naphazoline + Hydroxy Propyl Methyl Cellulose + Chlorpheniramine + Boric Acid + Sodium Chloride + Zinc Sulphate', 'eye'),
  B(83, 'Naphazoline + Hydroxy Propyl Methyl Cellulose + Chlorpheniramine + Boric Acid', 'eye'),
  B(84, 'Naphazoline + Chlorpheniramine + Methyl Cellulose', 'eye'),
  B(85, 'Naphazoline + Hydroxy Methyl Cellulose + Boric Acid + Menthol + Camphor', 'eye'),
  B(86, 'Naphazoline + Boric Acid + Menthol + Camphor + Methyl Cellulose + Chlorpheniramine + Zinc Sulphate + Sodium Chloride', 'eye'),
  B(87, 'Naphazoline + Phenylephrine + HPMC + Chlorpheniramine + Menthol + Camphor', 'eye'),
  B(88, 'Naphazoline + Hydroxy Propyl Methyl Cellulose + Chlorpheniramine + Boric Acid + Sodium Chloride + Zinc Sulphate + Menthol + Camphor', 'eye'),
  B(89, 'Naphazoline + Hydroxy Propyl Methyl Cellulose + Chlorpheniramine + Boric Acid + Zinc Sulphate', 'eye'),
  B(90, 'Naphazoline + Azelastine + Sodium Carboxy Methyl Cellulose + Menthol + Camphor + Stabilized Oxychlorocomplex', 'eye'),
  B(91, 'Naphazoline + Sodium Carboxy Methyl Cellulose + Menthol + Camphor + Stabilized Oxychloro complex', 'eye'),
  B(92, 'Naphazoline + Chlorpheniramine + Phenylephrine + Hydroxy Methyl Cellulose + Boric Acid + Menthol + Camphor', 'eye'),
  B(93, 'Naphazoline + Chlorpheniramine + Zinc Sulphate + Boric Acid + Sodium Chloride', 'eye'),
  B(94, 'Norfloxacin + Tinidazole', 'eye ointment'),
  B(95, 'Ofloxacin + Beclomethasone + Lignocaine', 'ear/topical'),
  B(96, 'Naphazoline + Chlorpheniramine + Phenylephrine + Menthol + Camphor', 'eye'),
  B(97, 'Phenylephrine + Naphazoline + Menthol + Camphor + Hydroxy Propyl Methyl Cellulose', 'eye'),
  B(98, 'Phenylephrine + Naphazoline + Menthol + Camphor', 'eye'),
  B(99, 'Sulphacetamide + Zinc Sulphate + Chlorpheniramine + Boric acid + Sodium Chloride', 'eye'),
  B(100, 'Zinc Sulphate + Boric acid + Naphazoline + Sodium Chloride + Phenyl Ethyl Alcohol', 'eye'),
  B(101, 'Cetirizine + Paracetamol + Phenylephrine'),
  B(102, 'Cetirizine + Phenylephrine'),
  B(103, 'Levocetirizine + Phenylephrine'),
  B(104, 'Levocetirizine + Phenylephrine + Paracetamol'),
  B(105, 'Phenylephrine + Paracetamol + Levocetirizine + Menthol'),
  B(106, 'Levocetirizine + Ambroxol + Paracetamol'),
  B(107, 'Levocetirizine + Ambroxol + Phenylephrine'),
  B(108, 'Diethylcarbamazine + Chlorpheniramine'),
  B(109, 'Diethylcarbamazine + Levocetirizine'),
  B(110, 'Ambroxol + Phenylephrine + Guaiphenesin'),
  B(111, 'Bromhexine + Phenylephrine'),
  B(112, 'Etofylline + Theophylline + Ambroxol'),
  B(113, 'Etofylline + Theophylline + Montelukast'),
  B(114, 'Ambroxol + Terbutaline + Ammonium Chloride + Guaiphenesin + Menthol'),
  B(115, 'Ambroxol + Salbutamol + Ammonium Chloride + Guaiphenesin + Menthol'),
  B(116, 'Cetirizine + Terbutaline + Ambroxol + Guaiphenesin'),
  B(117, 'Dextromethorphan + Chlorpheniramine + Ammonium Chloride + Sodium Citrate + Menthol'),
  B(118, 'Salbutamol + Bromhexine + Guaiphenesin + Ammonium Chloride + Menthol'),
  B(119, 'Terbutaline + Bromhexine + Chlorpheniramine'),
  B(120, 'Chlorpheniramine + P.G Sulphonate + Ammonium Chloride + Sodium Citrate + Menthol'),
  B(121, 'Aminophylline + Ammonium Chloride + Sodium Citrate'),
  B(122, 'Paracetamol + Chlorpheniramine + Phenyl Propanolamine'),
  B(123, 'Trithioparamethoxyphenyl Propene + Chlorpheniramine'),
  B(124, 'Aceclofenac + Paracetamol', 'oral liquid', [50, 125]),
  B(125, 'Aceclofenac + Paracetamol', 'tablet', [50, 125]),
  B(126, 'Adenosine triphosphate diphosphate + Magnesium Orotate'),
  B(127, 'Amoxicillin + Dicloxacillin + Lactobacillus'),
  B(128, 'Camylofin + Paracetamol', undefined, [25, 300]),
  B(129, 'Cefixime + Acetyl Cysteine'),
  B(130, 'Cephalexin + Serratiopeptidase'),
  B(131, 'Cetyl Myristoleate + Glucosamine + Methyl Sulfonyl methane'),
  B(132, 'Diacerein + Glucosamine + Methylsulphonyl Methane + Cetyl Myristoleate'),
  B(133, 'Paracetamol + Diclofenac + Caffeine'),
  B(134, 'Diclofenac + Thiocolchicoside', 'injection'),
  B(135, 'Doxycycline + Ornidazole + Bromelain + Lactobacillus Rhamnosus + Lactobacillus Reuteri RC'),
  B(136, 'Doxycycline + Betacyclodextrin + Serratiopeptidase'),
  B(137, 'Erythromycin + Lactic acid Bacillus'),
  B(138, 'Etodolac + Paracetamol + Serratiopeptidase'),
  B(139, 'Flupirtine + Paracetamol', 'tablet', [400, 325]),
  B(140, 'Glucosamine + Chondroitin', undefined, [410, 100]),
  B(141, 'Glucosamine + Methyl Sulphonyl Methane + Sodium Borate + Copper Sulphate pentahydrate + Manganese Sulphate + Vitamin D3'),
  B(142, 'Glucosamine + Sodium chloride + Manganese + Boron + Zinc + Copper'),
  B(143, 'Glucosamine + Chondroitin + Methylsulfonylmethane + Vitamin D3 + Vitamin E + Vitamin C + Selenium + Zinc + Manganese + Chromium + Copper + Boron'),
  B(144, 'Glucosamine + Methyl sulfonyl methane + Manganese sulphate + Vitamin E + Calcium Carbonate'),
  B(145, 'Glucosamine + Vitamin E + Calcium Pantothenate + Vitamin D3'),
  // S.O. 3430(E) (Glucosamine + oyster-shell calcium carbonate + …) is truncated in the published table; check the gazette.
  B(147, 'Cetyl Myristoleate + Glucosamine + Methyl sulfonyl methane'),
  B(148, 'Glucosamine + Methyl sulfonyl methane + Calcium carbonate + Vitamin E + Manganese'),
  B(149, 'Glucosamine + Calcium carbonate + Methyl sulfonyl methane + Vitamin D3'),
  B(150, 'Glucosamine + Methyl sulphate + Sulphonyl Methane + Chondroitin + Calcium Carbonate + Vitamin D3 + Sodium Borate + Cupric Oxide + Colloidal Silicon Dioxide + Manganese Chloride'),
  B(151, 'Methocarbamol + Diclofenac', 'injection'),
  B(152, 'Paracetamol + Pentazocine'),
  B(153, 'Sucralfate + Domperidone + Simethicone'),
  B(155, 'Tramadol + Dicyclomine + Domperidone'),
  B(156, 'Tramadol + Paracetamol + Caffeine + Taurine'),
  // June 2023 notification (combinations named in press reports; see CDSCO for the full 14)
  { components: splitCombination('Nimesulide + Paracetamol').map(p => p.ingredient), form: 'dispersible tablet', notification: 'June 2023 notification (14 FDCs)', label: 'Nimesulide + Paracetamol dispersible tablets' },
  { components: splitCombination('Chlorpheniramine + Codeine').map(p => p.ingredient), form: 'syrup', notification: 'June 2023 notification (14 FDCs)', label: 'Chlorpheniramine maleate + Codeine syrup' },
  { components: splitCombination('Pholcodine + Promethazine').map(p => p.ingredient), notification: 'June 2023 notification (14 FDCs)', label: 'Pholcodine + Promethazine' },
  { components: splitCombination('Amoxicillin + Bromhexine').map(p => p.ingredient), notification: 'June 2023 notification (14 FDCs)', label: 'Amoxicillin + Bromhexine' },
  { components: splitCombination('Bromhexine + Dextromethorphan + Ammonium Chloride + Menthol').map(p => p.ingredient), notification: 'June 2023 notification (14 FDCs)', label: 'Bromhexine + Dextromethorphan + Ammonium chloride + Menthol' },
  { components: splitCombination('Paracetamol + Bromhexine + Phenylephrine + Chlorpheniramine + Guaiphenesin').map(p => p.ingredient), notification: 'June 2023 notification (14 FDCs)', label: 'Paracetamol + Bromhexine + Phenylephrine + Chlorpheniramine + Guaiphenesin' },
  { components: splitCombination('Salbutamol + Bromhexine').map(p => p.ingredient), notification: 'June 2023 notification (14 FDCs)', label: 'Salbutamol + Bromhexine' }
];

const key = (components: string[]) => Array.from(new Set(components)).sort().join('|');
const INDEX = new Map<string, BannedFdc[]>();
for (const b of BANNED_FDCS) {
  const k = key(b.components);
  INDEX.set(k, [...(INDEX.get(k) || []), b]);
}

export interface BannedMatch { entry: BannedFdc; certainty: 'exact' | 'strength_unconfirmed' }

/**
 * Looks up a combination by its ingredients. `strengths` are in the same order as `ingredients`
 * when known. A notification that names strengths matches only those strengths; without stated
 * strengths on the prescription the match is reported as unconfirmed.
 */
export function findBannedFdc(ingredients: string[], strengths?: Array<number | undefined>): BannedMatch | null {
  if (ingredients.length < 2) return null;
  const entries = INDEX.get(key(ingredients));
  if (!entries) return null;
  for (const e of entries) {
    if (!e.strengthsMg) return { entry: e, certainty: 'exact' };
    const given = new Map<string, number | undefined>(ingredients.map((ing, i) => [ing, strengths?.[i]]));
    const known = e.components.every(c => given.get(c) !== undefined);
    if (!known) return { entry: e, certainty: 'strength_unconfirmed' };
    if (e.components.every((c, i) => Math.abs((given.get(c) as number) - e.strengthsMg![i]) < 0.01)) return { entry: e, certainty: 'exact' };
  }
  return null;
}
