/**
 * Ayurvedic formulations and single drugs resolved to their *key* constituents, so statutory and
 * safety flags come from what is inside a medicine, not from its name. ("Ras" in a name does not
 * mean mercury; "Arogyavardhini Vati" contains Parada although its name does not say so.)
 *
 * Constituent lists name the constituents that matter for safety (Schedule E(1) items, minerals,
 * self-generated alcohol, interacting herbs). They are not full AFI compositions; verify against
 * the Ayurvedic Formulary of India / the product label before relying on a complete list.
 */

export type AyushFlag =
  | 'schedule_e1'          // Drugs & Cosmetics Rules 1945, Schedule E(1) (Ayurvedic poisonous substances)
  | 'mineral_heavy_metal'  // Mercury, arsenic, lead, copper, gold, silver, tin preparations
  | 'alcohol'              // Asava / Arishta: self-generated alcohol (roughly 5–10% v/v)
  | 'calcium'              // Praval, Mukta, Shankha, Kapardika, Godanti: chelate fluoroquinolones, tetracyclines, levothyroxine, iron
  | 'potassium_salt'       // Yavakshara and other ksharas
  | 'glycyrrhizin'         // Yashtimadhu: pseudo-aldosteronism, potassium loss
  | 'guggulsterone'        // Guggulu: thyroid-active, CYP effects, platelet effects
  | 'piperine'             // Pippali, Maricha, Trikatu: raises absorption of some drugs
  | 'aquaretic'            // Gokshura, Punarnava: diuresis (lithium)
  | 'hypoglycaemic'        // Karela, Gudmar, Vijaysar, Jamun, Methi, Nishamalaki, Shilajit
  | 'sedative'             // Jatamansi, Tagara, Sarpagandha, Ashwagandha, Brahmi, Shankhapushpi
  | 'antiplatelet'         // Lashuna (garlic), high-dose Haridra
  | 'reserpine'            // Sarpagandha
  | 'uterotonic_strong'    // Garbhapatana drugs: avoid in pregnancy
  | 'pregnancy_caution'    // Strong purgatives, Hingu, Guggulu, Haritaki in pregnancy
  | 'thyroid_active'       // Guggulu, Ashwagandha
  | 'immunomodulator'      // Guduchi, Ashwagandha
  | 'cardiac_glycoside'    // Karavira (oleander)
  | 'phenytoin_level'      // Shankhapushpi (reduced phenytoin levels reported)
  | 'external_only';       // Taila / lepa for external use

export interface AyushIngredient {
  id: string;
  name: string;
  latin?: string;
  aliases: string[];
  flags: AyushFlag[];
}

export interface AyushFormulation {
  id: string;
  name: string;
  aliases: string[];
  form: 'Vati' | 'Guggulu' | 'Churna' | 'Kwatha' | 'Asava-Arishta' | 'Bhasma / Pishti' | 'Rasaushadhi' | 'Avaleha' | 'Ghrita' | 'Taila' | 'Single drug' | 'Ghanavati' | 'Syrup';
  constituents: string[];
  flags?: AyushFlag[];
  external?: boolean;
}

const I = (id: string, name: string, aliases: string[], flags: AyushFlag[] = [], latin?: string): AyushIngredient => ({ id, name, aliases, flags, latin });

export const AYUSH_INGREDIENTS: AyushIngredient[] = [
  // Schedule E(1) botanicals and minerals (verify against the Schedule text)
  I('vatsanabha', 'Vatsanabha', ['vatsanabh', 'vachhnag', 'aconite', 'aconitum'], ['schedule_e1'], 'Aconitum ferox'),
  I('kupilu', 'Kupilu', ['vishamushti', 'nux vomica', 'nux-vomica', 'strychnos', 'kuchla'], ['schedule_e1'], 'Strychnos nux-vomica'),
  I('bhallataka', 'Bhallataka', ['bhilawa', 'marking nut', 'semecarpus'], ['schedule_e1', 'uterotonic_strong'], 'Semecarpus anacardium'),
  I('dhattura', 'Dhattura', ['dhatura', 'datura'], ['schedule_e1'], 'Datura metel'),
  I('gunja', 'Gunja', ['abrus', 'rosary pea'], ['schedule_e1', 'uterotonic_strong'], 'Abrus precatorius'),
  I('jayapala', 'Jayapala', ['jaipal', 'croton seed', 'croton tiglium'], ['schedule_e1', 'uterotonic_strong'], 'Croton tiglium'),
  I('karavira', 'Karavira', ['kaner', 'peela kaner', 'oleander', 'yellow oleander', 'thevetia', 'nerium'], ['schedule_e1', 'cardiac_glycoside'], 'Nerium indicum / Thevetia peruviana'),
  I('langali', 'Langali', ['kalihari', 'gloriosa'], ['schedule_e1', 'uterotonic_strong'], 'Gloriosa superba'),
  I('snuhi', 'Snuhi', ['thohar', 'euphorbia'], ['schedule_e1', 'uterotonic_strong'], 'Euphorbia neriifolia'),
  I('arka', 'Arka', ['aak', 'calotropis', 'madar'], ['schedule_e1'], 'Calotropis procera'),
  I('ahiphena', 'Ahiphena', ['afeem', 'opium'], ['schedule_e1', 'sedative'], 'Papaver somniferum'),
  I('bhanga', 'Bhanga', ['bhang', 'vijaya', 'cannabis'], ['schedule_e1', 'sedative'], 'Cannabis sativa'),
  I('parasika_yavani', 'Parasika Yavani', ['khurasani ajwain', 'khurasani yavani', 'hyoscyamus'], ['schedule_e1'], 'Hyoscyamus niger'),
  I('parada', 'Parada', ['shuddha parada', 'mercury'], ['schedule_e1', 'mineral_heavy_metal']),
  I('hingula', 'Hingula', ['shuddha hingula', 'cinnabar'], ['schedule_e1', 'mineral_heavy_metal']),
  I('rasasindura', 'Rasasindura', ['rasa sindura', 'ras sindoor', 'rassindur'], ['schedule_e1', 'mineral_heavy_metal']),
  I('kajjali', 'Kajjali', ['kajali'], ['schedule_e1', 'mineral_heavy_metal']),
  I('rasakarpura', 'Rasakarpura', ['ras kapoor', 'rasa karpura'], ['schedule_e1', 'mineral_heavy_metal']),
  I('hartala', 'Hartala', ['haratala', 'orpiment'], ['schedule_e1', 'mineral_heavy_metal']),
  I('manahshila', 'Manahshila', ['mansil', 'realgar'], ['schedule_e1', 'mineral_heavy_metal']),
  I('gauripashana', 'Gauripashana', ['somal', 'sankhiya', 'white arsenic'], ['schedule_e1', 'mineral_heavy_metal']),
  I('tuttha', 'Tuttha', ['copper sulphate', 'neela thotha'], ['schedule_e1', 'mineral_heavy_metal']),
  I('sindura', 'Sindura', ['sindoor', 'red lead'], ['schedule_e1', 'mineral_heavy_metal']),
  // Other minerals
  I('swarna_bhasma', 'Swarna Bhasma', ['swarna', 'gold bhasma'], ['mineral_heavy_metal']),
  I('rajata_bhasma', 'Rajata Bhasma', ['rajat bhasma', 'silver bhasma'], ['mineral_heavy_metal']),
  I('tamra_bhasma', 'Tamra Bhasma', ['tamra', 'copper bhasma'], ['mineral_heavy_metal']),
  I('naga_bhasma', 'Naga Bhasma', ['naag bhasma', 'lead bhasma'], ['mineral_heavy_metal']),
  I('vanga_bhasma', 'Vanga Bhasma', ['vang bhasma', 'tin bhasma'], ['mineral_heavy_metal']),
  I('lauha_bhasma', 'Lauha Bhasma', ['loha bhasma', 'lauh bhasma', 'kanta lauha', 'mandura'], []),
  I('abhraka_bhasma', 'Abhraka Bhasma', ['abhrak bhasma'], []),
  I('gandhaka', 'Gandhaka', ['shuddha gandhaka', 'sulphur'], []),
  I('praval', 'Praval (coral)', ['praval pishti', 'pravala', 'coral'], ['calcium']),
  I('mukta', 'Mukta (pearl)', ['mukta pishti', 'mukta shukti', 'pearl'], ['calcium']),
  I('shankha', 'Shankha Bhasma', ['shankh bhasma', 'shankha'], ['calcium']),
  I('kapardika', 'Kapardika Bhasma', ['kapardak bhasma', 'kaudi bhasma'], ['calcium']),
  I('godanti', 'Godanti Bhasma', ['godanti'], ['calcium']),
  I('yavakshara', 'Yavakshara', ['yavaksara', 'yava kshara', 'kshara'], ['potassium_salt']),
  I('shilajit', 'Shilajit', ['shilajatu', 'asphaltum'], ['hypoglycaemic']),
  // Herbs that matter for interactions or pregnancy
  I('guggulu', 'Guggulu', ['guggul', 'commiphora mukul'], ['guggulsterone', 'thyroid_active', 'antiplatelet', 'pregnancy_caution']),
  I('yashtimadhu', 'Yashtimadhu', ['mulethi', 'licorice', 'liquorice', 'glycyrrhiza', 'madhuyashti', 'jethimadh'], ['glycyrrhizin']),
  I('pippali', 'Pippali', ['long pepper', 'piper longum', 'pipli'], ['piperine']),
  I('maricha', 'Maricha', ['black pepper', 'kali mirch', 'piper nigrum'], ['piperine']),
  I('gokshura', 'Gokshura', ['gokhru', 'tribulus'], ['aquaretic']),
  I('punarnava', 'Punarnava', ['boerhavia'], ['aquaretic']),
  I('karela', 'Karavellaka', ['karela', 'bitter gourd', 'momordica'], ['hypoglycaemic']),
  I('gudmar', 'Meshashringi', ['gudmar', 'gurmar', 'gymnema'], ['hypoglycaemic']),
  I('vijaysar', 'Vijaysar', ['pterocarpus', 'bijasar'], ['hypoglycaemic']),
  I('jamun', 'Jambu', ['jamun', 'jambul', 'syzygium'], ['hypoglycaemic']),
  I('methi', 'Methika', ['methi', 'fenugreek'], ['hypoglycaemic']),
  I('haridra', 'Haridra', ['turmeric', 'haldi', 'curcuma', 'curcumin'], []),
  I('amalaki', 'Amalaki', ['amla', 'amalki', 'emblica'], []),
  I('jatamansi', 'Jatamansi', ['nardostachys', 'balchhad'], ['sedative'], 'Nardostachys jatamansi'),
  I('tagara', 'Tagara', ['valeriana wallichii', 'indian valerian', 'valerian'], ['sedative']),
  I('sarpagandha', 'Sarpagandha', ['rauwolfia', 'rauvolfia', 'reserpine'], ['sedative', 'reserpine']),
  I('ashwagandha', 'Ashwagandha', ['withania', 'asgandh'], ['sedative', 'thyroid_active', 'immunomodulator']),
  I('brahmi', 'Brahmi', ['bacopa'], ['sedative']),
  I('shankhapushpi', 'Shankhapushpi', ['shankhpushpi', 'convolvulus pluricaulis'], ['sedative', 'phenytoin_level']),
  I('vacha', 'Vacha', ['acorus', 'bach'], ['pregnancy_caution']),
  I('lashuna', 'Lashuna', ['garlic', 'lahsun', 'allium sativum'], ['antiplatelet']),
  I('guduchi', 'Guduchi', ['giloy', 'tinospora', 'amrita satva'], ['immunomodulator', 'hypoglycaemic']),
  I('kumari', 'Kumari', ['aloe', 'aloe vera', 'ghritkumari', 'kanya'], ['uterotonic_strong']),
  I('chitraka', 'Chitraka', ['chitrak', 'plumbago'], ['uterotonic_strong']),
  I('kalonji', 'Krishna Jeeraka (Kalonji)', ['kalonji', 'nigella'], ['uterotonic_strong']),
  I('hingu', 'Hingu', ['hing', 'asafoetida', 'ferula'], ['pregnancy_caution']),
  I('trivrit', 'Trivrit', ['nishoth', 'operculina'], ['pregnancy_caution']),
  I('danti', 'Danti', ['baliospermum'], ['pregnancy_caution']),
  I('senna', 'Swarnapatri', ['senna', 'sanay', 'cassia angustifolia'], ['pregnancy_caution']),
  I('eranda', 'Eranda', ['castor', 'eranda taila', 'ricinus'], ['pregnancy_caution']),
  I('haritaki', 'Haritaki', ['harad', 'terminalia chebula'], []),
  I('arjuna', 'Arjuna', ['terminalia arjuna'], []),
  I('shallaki', 'Shallaki', ['boswellia', 'salai guggul'], []),
  I('neem', 'Nimba', ['neem', 'azadirachta'], []),
  I('vasaka', 'Vasaka', ['adulsa', 'adhatoda', 'vasa'], []),
  I('shunthi', 'Shunthi', ['ginger', 'adrak', 'sonth', 'zingiber'], []),
  I('shatavari', 'Shatavari', ['asparagus racemosus'], []),
  I('kalmegh', 'Kalmegh', ['andrographis'], []),
  I('bhumyamalaki', 'Bhumyamalaki', ['bhui amla', 'phyllanthus'], []),
  I('katuki', 'Katuki', ['kutki', 'picrorhiza'], []),
  I('kutaja', 'Kutaja', ['holarrhena'], [])
];

const F = (id: string, name: string, aliases: string[], form: AyushFormulation['form'], constituents: string[], extra: Partial<AyushFormulation> = {}): AyushFormulation =>
  ({ id, name, aliases, form, constituents, ...extra });

export const AYUSH_FORMULATIONS: AyushFormulation[] = [
  // Guggulu kalpana
  F('yogaraja_guggulu', 'Yogaraja Guggulu', ['yograj guggulu', 'yogaraj guggulu', 'yograj guggul'], 'Guggulu', ['guggulu', 'pippali', 'maricha', 'shunthi', 'chitraka', 'gokshura']),
  F('mahayogaraja_guggulu', 'Mahayogaraja Guggulu', ['mahayograj guggulu', 'maha yograj guggulu'], 'Guggulu', ['guggulu', 'rasasindura', 'naga_bhasma', 'vanga_bhasma', 'lauha_bhasma', 'abhraka_bhasma', 'pippali', 'chitraka']),
  F('kaishore_guggulu', 'Kaishore Guggulu', ['kaishor guggulu', 'kaishore guggul'], 'Guggulu', ['guggulu', 'guduchi', 'trivrit', 'danti', 'pippali', 'maricha', 'shunthi']),
  F('kanchnar_guggulu', 'Kanchanara Guggulu', ['kanchnar guggulu', 'kanchanar guggulu', 'kanchnar guggul'], 'Guggulu', ['guggulu', 'pippali', 'maricha', 'shunthi']),
  F('triphala_guggulu', 'Triphala Guggulu', ['triphala guggul'], 'Guggulu', ['guggulu', 'pippali', 'amalaki', 'haritaki']),
  F('gokshuradi_guggulu', 'Gokshuradi Guggulu', ['gokshuradi guggul'], 'Guggulu', ['guggulu', 'gokshura', 'pippali', 'maricha', 'shunthi']),
  F('simhanada_guggulu', 'Simhanada Guggulu', ['sinhanad guggulu', 'simhanad guggulu'], 'Guggulu', ['guggulu', 'gandhaka', 'eranda', 'haritaki']),
  F('medohar_guggulu', 'Medohara (Navaka) Guggulu', ['medohar guggulu', 'navaka guggulu', 'medohar guggul'], 'Guggulu', ['guggulu', 'pippali', 'maricha', 'shunthi', 'chitraka']),
  F('lakshadi_guggulu', 'Lakshadi Guggulu', ['lakshadi guggul'], 'Guggulu', ['guggulu', 'arjuna', 'ashwagandha']),
  // Rasaushadhi and vati
  F('arogyavardhini_vati', 'Arogyavardhini Vati', ['arogyavardhini', 'arogyavardhini ras'], 'Rasaushadhi', ['parada', 'gandhaka', 'lauha_bhasma', 'abhraka_bhasma', 'tamra_bhasma', 'shilajit', 'guggulu', 'chitraka', 'katuki']),
  F('chandraprabha_vati', 'Chandraprabha Vati', ['chandraprabha'], 'Vati', ['shilajit', 'guggulu', 'lauha_bhasma', 'yavakshara', 'pippali', 'maricha', 'shunthi', 'gokshura']),
  F('sutshekhar_ras', 'Sutashekhara Rasa', ['sutshekhar ras', 'sutshekhar rasa', 'soota shekhar ras', 'sootshekhar ras'], 'Rasaushadhi', ['parada', 'gandhaka', 'swarna_bhasma', 'tamra_bhasma', 'vatsanabha', 'dhattura', 'shankha', 'pippali', 'maricha', 'shunthi']),
  F('laxmivilas_ras', 'Lakshmivilasa Rasa (Naradiya)', ['laxmivilas ras', 'lakshmi vilas ras', 'laxmi vilas ras'], 'Rasaushadhi', ['parada', 'gandhaka', 'abhraka_bhasma', 'dhattura']),
  F('sameerpannag_ras', 'Sameerapannaga Rasa', ['sameerpannag ras', 'samirpannag ras', 'sameer pannag ras'], 'Rasaushadhi', ['parada', 'gandhaka', 'hartala', 'manahshila', 'gauripashana']),
  F('tribhuvan_kirti_ras', 'Tribhuvanakirti Rasa', ['tribhuvan kirti ras', 'tribhuvankirti ras', 'tribhuvan kirti rasa'], 'Rasaushadhi', ['hingula', 'vatsanabha', 'pippali', 'maricha', 'shunthi']),
  F('anand_bhairav_ras', 'Anandabhairava Rasa', ['anand bhairav ras', 'anandbhairav ras', 'anand bhairav rasa'], 'Rasaushadhi', ['hingula', 'vatsanabha', 'pippali', 'maricha']),
  F('hinguleshwar_ras', 'Hinguleshwara Rasa', ['hinguleshwar ras', 'hingulesvara rasa'], 'Rasaushadhi', ['hingula', 'vatsanabha', 'pippali']),
  F('vatavidhwansan_ras', 'Vatavidhwansana Rasa', ['vatvidhwansan ras', 'vatavidhwansan ras', 'vata vidhwansan ras'], 'Rasaushadhi', ['parada', 'gandhaka', 'vatsanabha', 'naga_bhasma', 'vanga_bhasma', 'tamra_bhasma', 'lauha_bhasma', 'abhraka_bhasma']),
  F('ekangveer_ras', 'Ekangavira Rasa', ['ekangveer ras', 'ekang veer ras'], 'Rasaushadhi', ['rasasindura', 'lauha_bhasma', 'tamra_bhasma', 'naga_bhasma', 'vanga_bhasma']),
  F('smritisagar_ras', 'Smritisagara Rasa', ['smritisagar ras', 'smriti sagar ras'], 'Rasaushadhi', ['parada', 'gandhaka', 'hartala', 'manahshila', 'tamra_bhasma']),
  F('agnitundi_vati', 'Agnitundi Vati', ['agnitundika vati', 'agnitundi'], 'Rasaushadhi', ['kupilu', 'parada', 'gandhaka', 'pippali', 'maricha', 'shunthi', 'chitraka', 'yavakshara']),
  F('kamdudha_ras', 'Kamadugha Rasa', ['kamdudha ras', 'kamdudha rasa', 'kamadudha ras'], 'Rasaushadhi', ['mukta', 'praval', 'shankha', 'kapardika', 'guduchi']),
  F('rasasindura_f', 'Rasasindura', ['rasa sindura', 'ras sindoor'], 'Rasaushadhi', ['rasasindura']),
  F('kajjali_f', 'Kajjali', ['kajjali'], 'Rasaushadhi', ['kajjali']),
  F('lashunadi_vati', 'Lashunadi Vati', ['lashunadi vati', 'lasunadi vati'], 'Vati', ['lashuna', 'hingu']),
  F('chitrakadi_vati', 'Chitrakadi Vati', ['chitrakadi vati', 'chitrakadi'], 'Vati', ['chitraka', 'pippali', 'yavakshara', 'hingu', 'shunthi', 'maricha']),
  F('raja_pravartini_vati', 'Rajahpravartini Vati', ['raja pravartini vati', 'rajapravartini vati', 'rajah pravartini'], 'Vati', ['kumari', 'hingu']),
  F('kanya_lohadi_vati', 'Kanyalohadi Vati', ['kanya lohadi vati', 'kanyalohadi'], 'Vati', ['kumari', 'lauha_bhasma', 'hingu']),
  F('sanshamani_vati', 'Samshamani Vati', ['sanshamani vati', 'samshamani vati', 'giloy ghan vati'], 'Vati', ['guduchi']),
  F('sudarshana_ghanavati', 'Sudarshana Ghana Vati', ['sudarshana ghanavati', 'sudarshan ghan vati', 'sudarshana churna', 'sudarshan churna'], 'Ghanavati', ['kalmegh', 'guduchi']),
  F('guduchi_ghanavati', 'Guduchi Ghana Vati', ['guduchi ghanavati', 'giloy ghanvati', 'guduchi'], 'Ghanavati', ['guduchi']),
  F('brahmi_vati', 'Brahmi Vati', ['brahmi vati'], 'Vati', ['brahmi', 'shankhapushpi', 'vacha', 'jatamansi']),
  F('sarpagandha_vati', 'Sarpagandha Vati', ['sarpagandha vati', 'sarpagandha ghan vati', 'sarpagandha'], 'Vati', ['sarpagandha', 'jatamansi', 'parasika_yavani', 'bhanga']),
  F('shilajit_vati', 'Shilajatu Vati', ['shilajit vati', 'shilajit rasayana', 'shilajit', 'shilajatu'], 'Vati', ['shilajit']),
  F('nishamalaki_vati', 'Nisha Amalaki', ['nishamalaki vati', 'nisha amalaki', 'nishamalaki', 'nisha amalki', 'haridra amalaki'], 'Vati', ['haridra', 'amalaki']),
  F('gudmar_churna', 'Meshashringi (Gudmar) Churna', ['gudmar churna', 'gurmar churna', 'meshashringi churna'], 'Churna', ['gudmar']),
  F('karela_churna', 'Karavellaka (Karela) Churna', ['karela churna', 'karela juice'], 'Churna', ['karela']),
  F('jamun_churna', 'Jambu Beeja Churna', ['jamun churna', 'jamun beej churna'], 'Churna', ['jamun']),
  F('vijaysar_churna', 'Vijaysar Churna', ['vijaysar churna', 'vijaysar'], 'Churna', ['vijaysar']),
  F('methi_churna', 'Methika Churna', ['methi churna', 'methi powder'], 'Churna', ['methi']),
  // Churna
  F('triphala_churna', 'Triphala Churna', ['triphala churna', 'triphala'], 'Churna', ['amalaki', 'haritaki']),
  F('avipattikar_churna', 'Avipattikara Churna', ['avipattikar churna', 'avipattikar'], 'Churna', ['trivrit', 'pippali', 'maricha', 'shunthi', 'amalaki', 'haritaki']),
  F('hingvastak_churna', 'Hingvashtaka Churna', ['hingvastak churna', 'hingwashtak churna', 'hingvastak'], 'Churna', ['hingu', 'pippali', 'maricha', 'shunthi']),
  F('sitopaladi_churna', 'Sitopaladi Churna', ['sitopaladi churna', 'sitopaladi'], 'Churna', ['pippali']),
  F('talisadi_churna', 'Talisadi Churna', ['talisadi churna', 'talisadi'], 'Churna', ['pippali', 'maricha', 'shunthi']),
  F('trikatu_churna', 'Trikatu Churna', ['trikatu churna', 'trikatu'], 'Churna', ['pippali', 'maricha', 'shunthi']),
  F('pippali_churna', 'Pippali Churna', ['pippali churna'], 'Churna', ['pippali']),
  F('yashtimadhu_churna', 'Yashtimadhu Churna', ['yashtimadhu churna', 'mulethi churna', 'yashtimadhu', 'mulethi'], 'Churna', ['yashtimadhu']),
  F('haritaki_churna', 'Haritaki Churna', ['haritaki churna', 'harad churna'], 'Churna', ['haritaki']),
  F('panchasakar_churna', 'Panchasakara Churna', ['panchasakar churna', 'pancha sakar churna'], 'Churna', ['senna', 'shunthi', 'haritaki']),
  F('ashwagandha_churna', 'Ashwagandha Churna', ['ashwagandha churna', 'ashwagandha rasayana', 'ashwagandha', 'ashwagandhadi lehya'], 'Churna', ['ashwagandha']),
  F('shatavari_churna', 'Shatavari Churna', ['shatavari churna', 'shatavari kalpa', 'shatavari'], 'Churna', ['shatavari']),
  F('jatamansi_churna', 'Jatamansi Churna', ['jatamansi churna', 'jatamansi'], 'Churna', ['jatamansi']),
  F('shankhapushpi_f', 'Shankhapushpi', ['shankhapushpi syrup', 'shankhpushpi syrup', 'shankhapushpi churna', 'shankhpushpi', 'shankhapushpi'], 'Syrup', ['shankhapushpi']),
  F('haridra_khanda', 'Haridra Khanda', ['haridra khand', 'haridrakhand'], 'Avaleha', ['haridra', 'trivrit', 'pippali', 'maricha', 'shunthi']),
  F('kalonji_churna', 'Kalonji Churna', ['kalonji churna', 'kalonji'], 'Churna', ['kalonji']),
  F('lashuna_churna', 'Lashuna Churna', ['lashuna churna', 'garlic churna', 'lashuna'], 'Churna', ['lashuna']),
  F('isabgol_f', 'Ispaghula (Isabgol)', ['isabgol', 'sat isabgol'], 'Churna', []),
  // Asava-Arishta (self-generated alcohol)
  F('draksharishta', 'Draksharishta', ['draksharishta', 'drakshasava'], 'Asava-Arishta', ['pippali', 'maricha'], { flags: ['alcohol'] }),
  F('dashamoolarishta', 'Dashamoolarishta', ['dashmoolarishta', 'dashamularishta', 'dasamularishta'], 'Asava-Arishta', ['gokshura', 'pippali', 'chitraka'], { flags: ['alcohol'] }),
  F('ashwagandharishta', 'Ashwagandharishta', ['ashwagandharishta'], 'Asava-Arishta', ['ashwagandha'], { flags: ['alcohol'] }),
  F('kutajarishta', 'Kutajarishta', ['kutajarishta'], 'Asava-Arishta', ['kutaja'], { flags: ['alcohol'] }),
  F('punarnavasava', 'Punarnavasava', ['punarnavasava'], 'Asava-Arishta', ['punarnava', 'gokshura'], { flags: ['alcohol'] }),
  F('kumaryasava', 'Kumaryasava', ['kumari asava', 'kumaryasava', 'kumariasava'], 'Asava-Arishta', ['kumari', 'lauha_bhasma'], { flags: ['alcohol'] }),
  F('abhayarishta', 'Abhayarishta', ['abhayarishta'], 'Asava-Arishta', ['haritaki', 'trivrit'], { flags: ['alcohol'] }),
  F('arjunarishta', 'Arjunarishta (Partharishta)', ['arjunarishta', 'partharishta'], 'Asava-Arishta', ['arjuna'], { flags: ['alcohol'] }),
  F('lohasava', 'Lohasava', ['lohasava'], 'Asava-Arishta', ['lauha_bhasma'], { flags: ['alcohol'] }),
  F('amritarishta', 'Amritarishta', ['amritarishta'], 'Asava-Arishta', ['guduchi'], { flags: ['alcohol'] }),
  F('chandanasava', 'Chandanasava', ['chandanasava'], 'Asava-Arishta', [], { flags: ['alcohol'] }),
  F('saraswatarishta', 'Saraswatarishta', ['saraswatarishta', 'sarasvatarishta'], 'Asava-Arishta', ['brahmi', 'ashwagandha'], { flags: ['alcohol'] }),
  F('kanakasava', 'Kanakasava', ['kanakasava'], 'Asava-Arishta', ['dhattura', 'vasaka'], { flags: ['alcohol'] }),
  F('ashokarishta', 'Ashokarishta', ['ashokarishta'], 'Asava-Arishta', [], { flags: ['alcohol'] }),
  F('pippalyasava', 'Pippalyasava', ['pippalyasava'], 'Asava-Arishta', ['pippali', 'maricha'], { flags: ['alcohol'] }),
  F('usheerasava', 'Ushirasava', ['usheerasava', 'ushirasava'], 'Asava-Arishta', [], { flags: ['alcohol'] }),
  // Kwatha / kashaya
  F('rasnasaptaka_kwatha', 'Rasnasaptaka Kashaya', ['rasnasaptaka kwatha', 'rasnasaptak kwath', 'rasnasaptakam kashayam'], 'Kwatha', ['guduchi', 'gokshura', 'punarnava', 'eranda']),
  F('maharasnadi_kwatha', 'Maharasnadi Kashaya', ['maharasnadi kwatha', 'maharasnadi kashayam', 'maharasnadi kwath'], 'Kwatha', ['gokshura', 'punarnava', 'eranda', 'shunthi', 'ashwagandha']),
  F('dashamoola_kwatha', 'Dashamoola Kashaya', ['dashmool kwath', 'dashamoola kwatha', 'dashamoolam kashayam'], 'Kwatha', ['gokshura']),
  F('arjuna_kwatha', 'Arjuna Kshirapaka / Kwatha', ['arjuna kwatha', 'arjuna ksheerapaka', 'arjun chhal', 'arjuna churna', 'arjuna'], 'Kwatha', ['arjuna']),
  F('punarnavadi_kashaya', 'Punarnavadi Kashaya', ['punarnavadi kashaya', 'punarnavadi kwatha', 'punarnavadi mandura'], 'Kwatha', ['punarnava', 'lauha_bhasma']),
  F('phalatrikadi_kwatha', 'Phalatrikadi Kashaya', ['phalatrikadi kwatha', 'phalatrikadi kashayam'], 'Kwatha', ['amalaki', 'haritaki', 'katuki', 'guduchi']),
  F('vasavaleha', 'Vasavaleha', ['vasavaleha', 'vasa avaleha'], 'Avaleha', ['vasaka', 'pippali']),
  F('chyawanprash', 'Chyavanaprasha', ['chyawanprash', 'chyavanprash', 'chyawanprasha'], 'Avaleha', ['amalaki', 'pippali']),
  F('agastya_haritaki', 'Agastya Haritaki Rasayana', ['agastya haritaki', 'agasthya rasayanam'], 'Avaleha', ['haritaki', 'pippali']),
  F('kantakari_avaleha', 'Kantakari Avaleha', ['kantakari avaleha', 'kantkari avleha'], 'Avaleha', ['pippali']),
  // Bhasma / pishti
  F('praval_pishti', 'Praval Pishti', ['praval pishti', 'pravala pishti', 'praval bhasma'], 'Bhasma / Pishti', ['praval']),
  F('mukta_pishti', 'Mukta Pishti', ['mukta pishti', 'mukta shukti bhasma', 'mukta bhasma'], 'Bhasma / Pishti', ['mukta']),
  F('shankha_bhasma', 'Shankha Bhasma', ['shankha bhasma', 'shankh bhasma'], 'Bhasma / Pishti', ['shankha']),
  F('kapardika_bhasma', 'Kapardika Bhasma', ['kapardika bhasma', 'kapardak bhasma', 'kaudi bhasma'], 'Bhasma / Pishti', ['kapardika']),
  F('godanti_bhasma', 'Godanti Bhasma', ['godanti bhasma'], 'Bhasma / Pishti', ['godanti']),
  F('swarna_bhasma_f', 'Swarna Bhasma', ['swarna bhasma'], 'Bhasma / Pishti', ['swarna_bhasma']),
  F('tamra_bhasma_f', 'Tamra Bhasma', ['tamra bhasma'], 'Bhasma / Pishti', ['tamra_bhasma']),
  F('naga_bhasma_f', 'Naga Bhasma', ['naga bhasma', 'naag bhasma'], 'Bhasma / Pishti', ['naga_bhasma']),
  F('vanga_bhasma_f', 'Vanga Bhasma', ['vanga bhasma', 'vang bhasma'], 'Bhasma / Pishti', ['vanga_bhasma']),
  F('lauha_bhasma_f', 'Lauha Bhasma', ['lauha bhasma', 'loha bhasma', 'mandura bhasma'], 'Bhasma / Pishti', ['lauha_bhasma']),
  F('yavakshara_f', 'Yavakshara', ['yavakshara', 'yavaksara'], 'Bhasma / Pishti', ['yavakshara']),
  F('bhallatakadi', 'Bhallatakadi preparations', ['bhallatakadi', 'bhallatak', 'bhallataka'], 'Rasaushadhi', ['bhallataka']),
  // External oils (no systemic interaction checks)
  F('mahanarayana_taila', 'Mahanarayana Taila', ['mahanarayan taila', 'mahanarayan tel', 'mahanarayana oil'], 'Taila', ['ashwagandha', 'shatavari'], { external: true }),
  F('pinda_taila', 'Pinda Taila', ['pinda taila', 'pinda tailam'], 'Taila', [], { external: true }),
  F('murivenna', 'Murivenna', ['murivenna'], 'Taila', [], { external: true }),
  F('dhanwantaram_taila', 'Dhanwantaram Taila', ['dhanwantharam thailam', 'dhanwantaram taila'], 'Taila', [], { external: true }),
  F('kshirabala_taila', 'Kshirabala Taila', ['ksheerabala taila', 'kshirabala taila', 'ksheerabala thailam'], 'Taila', [], { external: true }),
  // Single-drug forms
  F('kumari_swarasa', 'Kumari Swarasa (Aloe juice)', ['aloe vera juice', 'kumari swarasa', 'aloe juice'], 'Single drug', ['kumari']),
  F('ginger_swarasa', 'Ardraka Swarasa (ginger juice)', ['ginger swarasa', 'adrak swarasa', 'ardraka swarasa', 'ginger juice'], 'Single drug', ['shunthi']),
  F('neem_f', 'Nimba', ['neem capsule', 'nimba churna', 'neem'], 'Single drug', ['neem']),
  F('shallaki_f', 'Shallaki', ['shallaki', 'boswellia', 'shallaki tablet'], 'Single drug', ['shallaki']),
  F('kalmegh_f', 'Kalmegh', ['kalmegh'], 'Single drug', ['kalmegh']),
  F('tagara_f', 'Tagara', ['tagara', 'tagar'], 'Single drug', ['tagara']),
  F('st_johns_wort', "St John's wort (not an Ayurvedic drug)", ["st john's wort", 'st johns wort', 'hypericum'], 'Single drug', [])
];

const ING_BY_ID = new Map(AYUSH_INGREDIENTS.map(i => [i.id, i]));
export const ayushIngredientById = (id: string) => ING_BY_ID.get(id);

/** All flags of a formulation, from its own flags plus its constituents. */
export function formulationFlags(f: AyushFormulation): Set<AyushFlag> {
  const flags = new Set<AyushFlag>(f.flags || []);
  for (const c of f.constituents) for (const fl of ING_BY_ID.get(c)?.flags || []) flags.add(fl);
  if (f.external) flags.add('external_only');
  return flags;
}

/** Constituents that carry a given flag (for explaining an alert). */
export function constituentsWithFlag(f: AyushFormulation, flag: AyushFlag): string[] {
  return f.constituents.filter(c => ING_BY_ID.get(c)?.flags.includes(flag)).map(c => ING_BY_ID.get(c)!.name);
}
