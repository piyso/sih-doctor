import meshData from './anatomicalMeshDatabase.json';

export type AnatomicalSystemLayer = 'all' | 'muscular' | 'skeletal' | 'vascular' | 'visceral' | 'marma';

export interface AnatomicalMeshRecord {
  name: string;
  regionId: string;
  system: 'muscular' | 'skeletal' | 'vascular' | 'visceral' | 'cartilage' | 'ligament';
  hindiName: string;
  marma: string;
  isLeft: boolean;
  isRight: boolean;
  center: [number, number, number];
  size: [number, number, number];
  vertexCount: number;
}

export interface MarmaPointDef {
  id: string;
  nameSanskrit: string;
  nameHindi: string;
  nameEn: string;
  category: 'Sadhyo Pranahara' | 'Kalantara Pranahara' | 'Vishalyaghna' | 'Vaikalyakara' | 'Rujakara';
  regionId: string;
  position: [number, number, number];
  significance: string;
  dosha: 'Prana Vata' | 'Vyana Vata' | 'Samana Vata' | 'Apana Vata' | 'Udana Vata' | 'Sadhaka Pitta' | 'Pachaka Pitta' | 'Avalambaka Kapha' | 'Kledaka Kapha' | 'Tarpaka Kapha';
}

export const ANATOMICAL_MESH_DATABASE: AnatomicalMeshRecord[] = meshData as AnatomicalMeshRecord[];

// Fast O(1) Mesh Name Map
const MESH_LOOKUP_MAP = new Map<string, AnatomicalMeshRecord>();
ANATOMICAL_MESH_DATABASE.forEach(m => {
  MESH_LOOKUP_MAP.set(m.name, m);
});

export function getMeshMetadata(meshName: string): AnatomicalMeshRecord | undefined {
  return MESH_LOOKUP_MAP.get(meshName);
}

export function getMeshesForRegion(regionId: string): AnatomicalMeshRecord[] {
  return ANATOMICAL_MESH_DATABASE.filter(m => m.regionId === regionId);
}

export function getMeshesForSystem(system: AnatomicalSystemLayer): AnatomicalMeshRecord[] {
  if (system === 'all') return ANATOMICAL_MESH_DATABASE;
  if (system === 'muscular') {
    return ANATOMICAL_MESH_DATABASE.filter(m => m.system === 'muscular' || m.system === 'ligament');
  }
  if (system === 'skeletal') {
    return ANATOMICAL_MESH_DATABASE.filter(m => m.system === 'skeletal' || m.system === 'cartilage');
  }
  if (system === 'vascular') {
    return ANATOMICAL_MESH_DATABASE.filter(m => m.system === 'vascular');
  }
  if (system === 'visceral') {
    return ANATOMICAL_MESH_DATABASE.filter(m => m.system === 'visceral' || /heart|stomach|liver|kidney|bladder|lung|aort|cava|splen|ren/i.test(m.name));
  }
  return ANATOMICAL_MESH_DATABASE;
}

// 107 Ayush Marma Points calibrated to 3D Human Model Space (+X: Left, -X: Right, Y: 0..170 -> scaled)
export const AYUSH_MARMA_POINTS: MarmaPointDef[] = [
  // --- SHIRO & GREEVA MARMA (Head & Neck) ---
  {
    id: 'adhipati',
    nameSanskrit: 'अधिपति मर्म (Adhipati Marma)',
    nameHindi: 'शीर्ष / ब्रह्मरंध्र मर्म',
    nameEn: 'Crown / Vertex Vital Center',
    category: 'Sadhyo Pranahara',
    regionId: 'Head',
    position: [0, 1.22, 0.02],
    significance: 'Master cerebral nerve confluence, Sahasrara chakra root, brain perfusion center',
    dosha: 'Prana Vata'
  },
  {
    id: 'sthapani',
    nameSanskrit: 'स्थपनी मर्म (Sthapani Marma)',
    nameHindi: 'ललाट / भ्रूमध्य मर्म',
    nameEn: 'Glabella / Frontal Third-Eye Locus',
    category: 'Vishalyaghna',
    regionId: 'Head',
    position: [0, 1.10, 0.10],
    significance: 'Prefrontal cortex, pituitary-hypothalamus axis, migraine trigger point',
    dosha: 'Prana Vata'
  },
  {
    id: 'simanta_anterior',
    nameSanskrit: 'सीमन्त मर्म (Simanta Marma)',
    nameHindi: 'कपाल संधि मर्म',
    nameEn: 'Cranial Sutures & Meningeal Junction',
    category: 'Kalantara Pranahara',
    regionId: 'Head',
    position: [0, 1.18, 0.06],
    significance: 'Coronal & sagittal sutures, sagittal sinus pressure regulation',
    dosha: 'Tarpaka Kapha'
  },
  {
    id: 'shankha_left',
    nameSanskrit: 'शंख मर्म (वाम) (Shankha Left)',
    nameHindi: 'बायां कनपटी मर्म',
    nameEn: 'Left Pterion & Temporal Artery Hub',
    category: 'Sadhyo Pranahara',
    regionId: 'Head',
    position: [0.16, 1.06, 0.04],
    significance: 'Middle meningeal artery, temporal headache, pterion fracture risk',
    dosha: 'Prana Vata'
  },
  {
    id: 'shankha_right',
    nameSanskrit: 'शंख मर्म (दक्षिण) (Shankha Right)',
    nameHindi: 'दायां कनपटी मर्म',
    nameEn: 'Right Pterion & Temporal Artery Hub',
    category: 'Sadhyo Pranahara',
    regionId: 'Head',
    position: [-0.16, 1.06, 0.04],
    significance: 'Middle meningeal artery, right temporal pressure hub',
    dosha: 'Prana Vata'
  },
  {
    id: 'phana_left',
    nameSanskrit: 'फण मर्म (वाम) (Phana Left)',
    nameHindi: 'बायां नासापुट मर्म',
    nameEn: 'Left Olfactory & Nasal Canal Locus',
    category: 'Vaikalyakara',
    regionId: 'Face & Sinus',
    position: [0.05, 0.98, 0.12],
    significance: 'Olfactory mucosa, sphenopalatine ganglion, sinus decongestion trigger',
    dosha: 'Prana Vata'
  },
  {
    id: 'phana_right',
    nameSanskrit: 'फण मर्म (दक्षिण) (Phana Right)',
    nameHindi: 'दायां नासापुट मर्म',
    nameEn: 'Right Olfactory & Nasal Canal Locus',
    category: 'Vaikalyakara',
    regionId: 'Face & Sinus',
    position: [-0.05, 0.98, 0.12],
    significance: 'Olfactory mucosa, right nasal patency',
    dosha: 'Prana Vata'
  },
  {
    id: 'apanga_left',
    nameSanskrit: 'अपाङ्ग मर्म (वाम) (Apanga Left)',
    nameHindi: 'बायीं आँख का बाहरी कोना',
    nameEn: 'Left Lateral Canthus & Lacrimal Hub',
    category: 'Vaikalyakara',
    regionId: 'Face & Sinus',
    position: [0.11, 1.02, 0.09],
    significance: 'Zygomaticofacial nerve, ophthalmic migraine relief',
    dosha: 'Tarpaka Kapha'
  },
  {
    id: 'apanga_right',
    nameSanskrit: 'अपाङ्ग मर्म (दक्षिण) (Apanga Right)',
    nameHindi: 'दायीं आँख का बाहरी कोना',
    nameEn: 'Right Lateral Canthus & Lacrimal Hub',
    category: 'Vaikalyakara',
    regionId: 'Face & Sinus',
    position: [-0.11, 1.02, 0.09],
    significance: 'Right orbital neurovascular bundle',
    dosha: 'Tarpaka Kapha'
  },
  {
    id: 'vidhura_left',
    nameSanskrit: 'विदुर मर्म (वाम) (Vidhura Left)',
    nameHindi: 'बायां कान का पिछला मर्म',
    nameEn: 'Left Retroauricular & Mastoid Hub',
    category: 'Vaikalyakara',
    regionId: 'Ear',
    position: [0.18, 1.02, -0.04],
    significance: 'Vestibulocochlear nerve, hearing loss, vertigo & mastoiditis',
    dosha: 'Prana Vata'
  },
  {
    id: 'vidhura_right',
    nameSanskrit: 'विदुर मर्म (दक्षिण) (Vidhura Right)',
    nameHindi: 'दायां कान का पिछला मर्म',
    nameEn: 'Right Retroauricular & Mastoid Hub',
    category: 'Vaikalyakara',
    regionId: 'Ear',
    position: [-0.18, 1.02, -0.04],
    significance: 'Right mastoid process, acoustic balance center',
    dosha: 'Prana Vata'
  },
  {
    id: 'krikanthika_left',
    nameSanskrit: 'कृकाटिका मर्म (Krikanthika Marma)',
    nameHindi: 'ग्रीवा-कपाल संधि (Atlanto-Occipital)',
    nameEn: 'Atlanto-Occipital & Suboccipital Hub',
    category: 'Vaikalyakara',
    regionId: 'Cervical Spine',
    position: [0.06, 0.90, -0.09],
    significance: 'Suboccipital nerve plexus, head rotation, cervical vertigo trigger',
    dosha: 'Prana Vata'
  },
  {
    id: 'manya_sira',
    nameSanskrit: 'मन्या व सिर मातृका (Manya & Sira)',
    nameHindi: 'ग्रीवा नाड़ी व कैरोटिड धमनी',
    nameEn: 'Carotid Sinus & Vagal Neurovascular Hub',
    category: 'Sadhyo Pranahara',
    regionId: 'Neck',
    position: [0.08, 0.82, 0.06],
    significance: 'Common carotid bifurcation, vagus nerve, arterial blood pressure baroreceptors',
    dosha: 'Udana Vata'
  },
  {
    id: 'kantha_nadi',
    nameSanskrit: 'कण्ठ नाड़ी मर्म (Kantha Nadi)',
    nameHindi: 'स्वरयंत्र व थाइरॉइड मर्म',
    nameEn: 'Laryngeal Prominence & Thyroid Hub',
    category: 'Vaikalyakara',
    regionId: 'Neck',
    position: [0, 0.80, 0.08],
    significance: 'Thyroid cartilage, recurrent laryngeal nerve, vocal cord function',
    dosha: 'Udana Vata'
  },

  // --- URAH & KOSHTHA MARMA (Thorax & Abdomen) ---
  {
    id: 'hridaya_marma',
    nameSanskrit: 'हृदय मर्म (Hridaya Marma)',
    nameHindi: 'हृदय संस्थान · महामर्म (Heart Center)',
    nameEn: 'Cardiac Center & Coronary Plexus (Precordium)',
    category: 'Sadhyo Pranahara',
    regionId: 'Left Chest / Precordium',
    position: [0.08, 0.55, 0.12],
    significance: 'Primary vital center (Mahamarma), Sadhaka Pitta root, angina & arrhythmia origin',
    dosha: 'Sadhaka Pitta'
  },
  {
    id: 'stanamula_left',
    nameSanskrit: 'स्तनमूला मर्म (वाम) (Stanamula Left)',
    nameHindi: 'बायां स्तन मूल मर्म',
    nameEn: 'Left Submammary & Intercostal Hub',
    category: 'Kalantara Pranahara',
    regionId: 'Left Chest / Precordium',
    position: [0.14, 0.48, 0.12],
    significance: 'Left 5th/6th intercostal space, pleuritic chest pain trigger, cardiac apex',
    dosha: 'Avalambaka Kapha'
  },
  {
    id: 'stanamula_right',
    nameSanskrit: 'स्तनमूला मर्म (दक्षिण) (Stanamula Right)',
    nameHindi: 'दायां स्तन मूल मर्म',
    nameEn: 'Right Submammary & Hepatic Dome Hub',
    category: 'Kalantara Pranahara',
    regionId: 'Right Chest',
    position: [-0.14, 0.48, 0.12],
    significance: 'Right 5th/6th intercostal space, liver dome, pleurisy & right lung base',
    dosha: 'Avalambaka Kapha'
  },
  {
    id: 'apastambha_left',
    nameSanskrit: 'अपस्तम्भ मर्म (वाम) (Apastambha Left)',
    nameHindi: 'बायां फुफ्फुस श्वासनली मर्म',
    nameEn: 'Left Bronchial & Pulmonary Artery Root',
    category: 'Sadhyo Pranahara',
    regionId: 'Left Chest / Precordium',
    position: [0.08, 0.62, 0.10],
    significance: 'Left main bronchus, pulmonary trunk, acute dyspnea / hemoptysis locus',
    dosha: 'Prana Vata'
  },
  {
    id: 'apastambha_right',
    nameSanskrit: 'अपस्तम्भ मर्म (दक्षिण) (Apastambha Right)',
    nameHindi: 'दायां फुफ्फुस श्वासनली मर्म',
    nameEn: 'Right Bronchial & Pulmonary Hilum',
    category: 'Sadhyo Pranahara',
    regionId: 'Right Chest',
    position: [-0.08, 0.62, 0.10],
    significance: 'Right bronchus, tracheobronchial lymph nodes, asthma & bronchitis locus',
    dosha: 'Prana Vata'
  },
  {
    id: 'amashaya_marma',
    nameSanskrit: 'आमाशय / अग्नि मर्म (Amashaya Marma)',
    nameHindi: 'ऊपरी पेट / पाचक अग्नि स्थान',
    nameEn: 'Epigastric Celiac Plexus & Gastric Agni Center',
    category: 'Kalantara Pranahara',
    regionId: 'Epigastrium',
    position: [0, 0.28, 0.12],
    significance: 'Celiac plexus, stomach fundus, gastritis, peptic ulcer & acid reflux',
    dosha: 'Pachaka Pitta'
  },
  {
    id: 'nabhi_marma',
    nameSanskrit: 'नाभि मर्म (Nabhi Marma)',
    nameHindi: 'नाभि संस्थान · महामर्म (Umbilicus)',
    nameEn: 'Umbilical Axis & Mesenteric Confluence',
    category: 'Sadhyo Pranahara',
    regionId: 'Umbilicus / Mid-Abdomen',
    position: [0, 0.02, 0.12],
    significance: 'Siravedha core, root of all 72,000 nadis, enteric nervous system center',
    dosha: 'Samana Vata'
  },
  {
    id: 'unduka_appendix',
    nameSanskrit: 'उण्डुक मर्म / मैकबर्नी (RLQ Appendix)',
    nameHindi: 'दायां निचला पेट (अपेंडिक्स बिंदु)',
    nameEn: 'Right Lower Quadrant & Cecal Locus',
    category: 'Sadhyo Pranahara',
    regionId: 'Right Lower Quadrant (RLQ)',
    position: [-0.14, -0.15, 0.11],
    significance: 'McBurney point, acute appendicitis, cecal colic & iliocecal valve',
    dosha: 'Apana Vata'
  },
  {
    id: 'basti_marma',
    nameSanskrit: 'बस्ति मर्म (Basti Marma)',
    nameHindi: 'मूत्राशय व पेडू महामर्म (Bladder & Pelvis)',
    nameEn: 'Hypogastric Pelvic Plexus & Urinary Bladder',
    category: 'Sadhyo Pranahara',
    regionId: 'Pelvic / Hypogastrium',
    position: [0, -0.18, 0.11],
    significance: 'Mahamarma of Apana Vata, urinary continence, pelvic floor visceral reflex',
    dosha: 'Apana Vata'
  },

  // --- PRISHTHA MARMA (Back & Spine) ---
  {
    id: 'brihati_left',
    nameSanskrit: 'बृहती मर्म (वाम) (Brihati Left)',
    nameHindi: 'बायां अंतर-स्कंध मर्म',
    nameEn: 'Left Interscapular Thoracic Hub',
    category: 'Kalantara Pranahara',
    regionId: 'Upper Back / Thoracic',
    position: [0.12, 0.55, -0.11],
    significance: 'T4-T6 paraspinal muscles, interscapular myofascial spasm, referred cardiac ache',
    dosha: 'Avalambaka Kapha'
  },
  {
    id: 'brihati_right',
    nameSanskrit: 'बृहती मर्म (दक्षिण) (Brihati Right)',
    nameHindi: 'दायां अंतर-स्कंध मर्म',
    nameEn: 'Right Interscapular Thoracic Hub',
    category: 'Kalantara Pranahara',
    regionId: 'Upper Back / Thoracic',
    position: [-0.12, 0.55, -0.11],
    significance: 'T4-T6 right paraspinal, gall-bladder referred pain locus',
    dosha: 'Avalambaka Kapha'
  },
  {
    id: 'kati_taruna',
    nameSanskrit: 'कटि-तरुण मर्म (Kati-Taruna Marma)',
    nameHindi: 'निचली कमर / कटि संधि (L4-L5 / L5-S1)',
    nameEn: 'Lumbosacral Junction & Sciatic Nerve Origin',
    category: 'Kalantara Pranahara',
    regionId: 'Lumbar Spine (Kati)',
    position: [0, 0.10, -0.11],
    significance: 'L4-L5 disc herniation, lumbago (Kati Shula), piriformis syndrome origin',
    dosha: 'Apana Vata'
  },
  {
    id: 'kukundara_left',
    nameSanskrit: 'कुकुन्दर मर्म (वाम) (Kukundara Left)',
    nameHindi: 'बायां नितंब खांच मर्म (Sacroiliac)',
    nameEn: 'Left Sciatic Notch & Sacroiliac Joint',
    category: 'Vaikalyakara',
    regionId: 'Sacral / Sciatica Origin',
    position: [0.12, -0.18, -0.11],
    significance: 'Greater sciatic foramen, sciatic nerve compression, gluteal trigger point',
    dosha: 'Vyana Vata'
  },
  {
    id: 'kukundara_right',
    nameSanskrit: 'कुकुन्दर मर्म (दक्षिण) (Kukundara Right)',
    nameHindi: 'दायां नितंब खांच मर्म (Sacroiliac)',
    nameEn: 'Right Sciatic Notch & Sacroiliac Joint',
    category: 'Vaikalyakara',
    regionId: 'Sacral / Sciatica Origin',
    position: [-0.12, -0.18, -0.11],
    significance: 'Right sciatic nerve compression point',
    dosha: 'Vyana Vata'
  },

  // --- SHAKHA MARMA (Upper & Lower Limbs) ---
  {
    id: 'amsa_left',
    nameSanskrit: 'अंस मर्म (वाम) (Amsa Left)',
    nameHindi: 'बायां कंधा संधि (Glenohumeral)',
    nameEn: 'Left Glenohumeral & Rotator Cuff Hub',
    category: 'Vaikalyakara',
    regionId: 'Left Shoulder',
    position: [0.32, 0.68, 0.02],
    significance: 'Rotator cuff, suprascapular nerve, frozen shoulder & shoulder impingement',
    dosha: 'Vyana Vata'
  },
  {
    id: 'amsa_right',
    nameSanskrit: 'अंस मर्म (दक्षिण) (Amsa Right)',
    nameHindi: 'दायां कंधा संधि (Glenohumeral)',
    nameEn: 'Right Glenohumeral & Rotator Cuff Hub',
    category: 'Vaikalyakara',
    regionId: 'Right Shoulder',
    position: [-0.32, 0.68, 0.02],
    significance: 'Right rotator cuff complex',
    dosha: 'Vyana Vata'
  },
  {
    id: 'kurpara_left',
    nameSanskrit: 'कूर्पर मर्म (वाम) (Kurpara Left)',
    nameHindi: 'बायीं कोहनी संधि (Elbow)',
    nameEn: 'Left Cubital Fossa & Medial Epicondyle',
    category: 'Vaikalyakara',
    regionId: 'Left Arm',
    position: [0.44, 0.22, 0.04],
    significance: 'Brachial artery, median nerve, tennis elbow & golfer elbow trigger',
    dosha: 'Vyana Vata'
  },
  {
    id: 'kurpara_right',
    nameSanskrit: 'कूर्पर मर्म (दक्षिण) (Kurpara Right)',
    nameHindi: 'दायीं कोहनी संधि (Elbow)',
    nameEn: 'Right Cubital Fossa & Medial Epicondyle',
    category: 'Vaikalyakara',
    regionId: 'Right Arm',
    position: [-0.44, 0.22, 0.04],
    significance: 'Right brachial artery and radial/ulnar nerve branch',
    dosha: 'Vyana Vata'
  },
  {
    id: 'manibandha_left',
    nameSanskrit: 'मणिबन्ध मर्म (वाम) (Manibandha Left)',
    nameHindi: 'बायीं कलाई (Wrist Joint)',
    nameEn: 'Left Radiocarpal & Carpal Tunnel Hub',
    category: 'Rujakara',
    regionId: 'Left Hand',
    position: [0.52, -0.12, 0.04],
    significance: 'Carpal tunnel, radial artery pulse examination (Nadi Pariksha root)',
    dosha: 'Vyana Vata'
  },
  {
    id: 'manibandha_right',
    nameSanskrit: 'मणिबन्ध मर्म (दक्षिण) (Manibandha Right)',
    nameHindi: 'दायीं कलाई (Wrist Joint)',
    nameEn: 'Right Radiocarpal & Carpal Tunnel Hub',
    category: 'Rujakara',
    regionId: 'Right Hand',
    position: [-0.52, -0.12, 0.04],
    significance: 'Right carpal tunnel and radial pulse examination',
    dosha: 'Vyana Vata'
  },
  {
    id: 'talahridaya_hand_left',
    nameSanskrit: 'तलहृदय मर्म (वाम हस्त) (Talahridaya Hand Left)',
    nameHindi: 'बायीं हथेली केंद्र (Palm Center)',
    nameEn: 'Left Palm Center & Palmar Arch',
    category: 'Kalantara Pranahara',
    regionId: 'Left Hand',
    position: [0.55, -0.18, 0.05],
    significance: 'Superficial palmar arch, median nerve terminal branches',
    dosha: 'Vyana Vata'
  },
  {
    id: 'talahridaya_hand_right',
    nameSanskrit: 'तलहृदय मर्म (दक्षिण हस्त) (Talahridaya Hand Right)',
    nameHindi: 'दायीं हथेली केंद्र (Palm Center)',
    nameEn: 'Right Palm Center & Palmar Arch',
    category: 'Kalantara Pranahara',
    regionId: 'Right Hand',
    position: [-0.55, -0.18, 0.05],
    significance: 'Right superficial palmar arch, median nerve branch',
    dosha: 'Vyana Vata'
  },
  {
    id: 'janu_left',
    nameSanskrit: 'जानु मर्म (वाम) (Janu Marma Left)',
    nameHindi: 'बायां घुटना संधि (Knee Joint)',
    nameEn: 'Left Knee Patellofemoral & Meniscal Hub',
    category: 'Vaikalyakara',
    regionId: 'Left Knee',
    position: [0.16, -0.70, 0.06],
    significance: 'Patellar tendon, cruciate ligaments, osteoarthritis (Sandhigata Vata)',
    dosha: 'Vyana Vata'
  },
  {
    id: 'janu_right',
    nameSanskrit: 'जानु मर्म (दक्षिण) (Janu Marma Right)',
    nameHindi: 'दायां घुटना संधि (Knee Joint)',
    nameEn: 'Right Knee Patellofemoral & Meniscal Hub',
    category: 'Vaikalyakara',
    regionId: 'Right Knee',
    position: [-0.16, -0.70, 0.06],
    significance: 'Right patellar tendon, cruciate ligaments, meniscal cartilage',
    dosha: 'Vyana Vata'
  },
  {
    id: 'indrabasti_calf_left',
    nameSanskrit: 'इन्द्रबस्ति मर्म (वाम पिंडली) (Indrabasti Calf)',
    nameHindi: 'बायीं पिंडली मांसपेशी (Gastrocnemius)',
    nameEn: 'Left Gastrocnemius & Tibial Nerve Pathway',
    category: 'Kalantara Pranahara',
    regionId: 'Sciatic Pathway / Calves',
    position: [0.16, -0.92, -0.08],
    significance: 'Peripheral venous pump, calf cramps, sciatica radiation terminus',
    dosha: 'Vyana Vata'
  },
  {
    id: 'indrabasti_calf_right',
    nameSanskrit: 'इन्द्रबस्ति मर्म (दक्षिण पिंडली) (Indrabasti Calf Right)',
    nameHindi: 'दायीं पिंडली मांसपेशी (Gastrocnemius)',
    nameEn: 'Right Gastrocnemius & Tibial Nerve Pathway',
    category: 'Kalantara Pranahara',
    regionId: 'Sciatic Pathway / Calves',
    position: [-0.16, -0.92, -0.08],
    significance: 'Right calf muscle pump and posterior tibial nerve',
    dosha: 'Vyana Vata'
  },
  {
    id: 'gulpha_left',
    nameSanskrit: 'गुल्फ मर्म (वाम) (Gulpha Left)',
    nameHindi: 'बायां टखना संधि (Ankle Joint)',
    nameEn: 'Left Talocrural & Deltoid Ligament Hub',
    category: 'Rujakara',
    regionId: 'Left Foot',
    position: [0.16, -1.12, 0.02],
    significance: 'Tibialis posterior tendon, ankle sprains, heel spur reflex',
    dosha: 'Vyana Vata'
  },
  {
    id: 'gulpha_right',
    nameSanskrit: 'गुल्फ मर्म (दक्षिण) (Gulpha Right)',
    nameHindi: 'दायां टखना संधि (Ankle Joint)',
    nameEn: 'Right Talocrural & Deltoid Ligament Hub',
    category: 'Rujakara',
    regionId: 'Right Foot',
    position: [-0.16, -1.12, 0.02],
    significance: 'Right talocrural ligament and ankle joint',
    dosha: 'Vyana Vata'
  },
  {
    id: 'talahridaya_foot_left',
    nameSanskrit: 'तलहृदय मर्म (वाम पाद) (Talahridaya Foot)',
    nameHindi: 'बायां पैर का तलवा (Sole Center)',
    nameEn: 'Left Plantar Reflex & Acupressure Center',
    category: 'Kalantara Pranahara',
    regionId: 'Left Foot',
    position: [0.16, -1.18, 0.08],
    significance: 'Plantar aponeurosis, autonomic grounding, kidney-adrenal meridian',
    dosha: 'Apana Vata'
  },
  {
    id: 'talahridaya_foot_right',
    nameSanskrit: 'तलहृदय मर्म (दक्षिण पाद) (Talahridaya Foot Right)',
    nameHindi: 'दायां पैर का तलवा (Sole Center)',
    nameEn: 'Right Plantar Reflex & Acupressure Center',
    category: 'Kalantara Pranahara',
    regionId: 'Right Foot',
    position: [-0.16, -1.18, 0.08],
    significance: 'Right plantar reflex and foot acupressure center',
    dosha: 'Apana Vata'
  }
];

// Optimal Camera Framing Coordinates in Three.js Space (+X: Patient Left, -X: Patient Right)
export const CAMERA_REGION_PRESETS: Record<string, {
  pos: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
}> = {
  'Head': { pos: [0, 1.12, 1.35], lookAt: [0, 1.12, 0.04], fov: 30 },
  'Face & Sinus': { pos: [0, 0.98, 1.25], lookAt: [0, 0.98, 0.06], fov: 28 },
  'Ear': { pos: [0.65, 1.02, 0.65], lookAt: [0.18, 1.02, 0.02], fov: 28 },
  'Neck': { pos: [0, 0.82, 1.30], lookAt: [0, 0.82, 0.04], fov: 30 },
  'Cervical Spine': { pos: [0, 0.82, -1.30], lookAt: [0, 0.82, -0.05], fov: 30 },

  'Left Chest / Precordium': { pos: [0.20, 0.55, 1.45], lookAt: [0.12, 0.55, 0.08], fov: 32 },
  'Right Chest': { pos: [-0.20, 0.55, 1.45], lookAt: [-0.12, 0.55, 0.08], fov: 32 },
  'Lungs & Respiration': { pos: [0, 0.55, 1.60], lookAt: [0, 0.55, 0.08], fov: 34 },
  'Upper Back / Thoracic': { pos: [0, 0.55, -1.55], lookAt: [0, 0.55, -0.06], fov: 34 },

  'Epigastrium': { pos: [0, 0.28, 1.35], lookAt: [0, 0.28, 0.06], fov: 30 },
  'Umbilicus / Mid-Abdomen': { pos: [0, 0.02, 1.35], lookAt: [0, 0.02, 0.06], fov: 30 },
  'Right Lower Quadrant (RLQ)': { pos: [-0.25, -0.15, 1.30], lookAt: [-0.14, -0.15, 0.08], fov: 30 },
  'Left Lower Quadrant (LLQ)': { pos: [0.25, -0.15, 1.30], lookAt: [0.14, -0.15, 0.08], fov: 30 },
  'Pelvic / Hypogastrium': { pos: [0, -0.18, 1.35], lookAt: [0, -0.18, 0.05], fov: 32 },

  'Lumbar Spine (Kati)': { pos: [0, 0.10, -1.40], lookAt: [0, 0.10, -0.06], fov: 30 },
  'Sacral / Sciatica Origin': { pos: [0, -0.18, -1.35], lookAt: [0, -0.18, -0.06], fov: 32 },
  'Sciatic Pathway / Calves': { pos: [0, -0.92, -1.55], lookAt: [0, -0.92, -0.05], fov: 34 },

  'Left Shoulder': { pos: [0.55, 0.68, 1.25], lookAt: [0.32, 0.68, 0.02], fov: 30 },
  'Right Shoulder': { pos: [-0.55, 0.68, 1.25], lookAt: [-0.32, 0.68, 0.02], fov: 30 },
  'Left Arm': { pos: [0.65, 0.22, 1.30], lookAt: [0.44, 0.22, 0.04], fov: 32 },
  'Right Arm': { pos: [-0.65, 0.22, 1.30], lookAt: [-0.44, 0.22, 0.04], fov: 32 },
  'Left Hand': { pos: [0.70, -0.12, 1.15], lookAt: [0.52, -0.12, 0.04], fov: 28 },
  'Right Hand': { pos: [-0.70, -0.12, 1.15], lookAt: [-0.52, -0.12, 0.04], fov: 28 },

  'Left Hip': { pos: [0.38, -0.22, 1.35], lookAt: [0.20, -0.22, 0.04], fov: 32 },
  'Right Hip': { pos: [-0.38, -0.22, 1.35], lookAt: [-0.20, -0.22, 0.04], fov: 32 },
  'Left Knee': { pos: [0.28, -0.70, 1.30], lookAt: [0.16, -0.70, 0.06], fov: 28 },
  'Right Knee': { pos: [-0.28, -0.70, 1.30], lookAt: [-0.16, -0.70, 0.06], fov: 28 },
  'Left Leg': { pos: [0.28, -0.92, 1.35], lookAt: [0.16, -0.92, 0.06], fov: 30 },
  'Right Leg': { pos: [-0.28, -0.92, 1.35], lookAt: [-0.16, -0.92, 0.06], fov: 30 },
  'Left Foot': { pos: [0.28, -1.15, 1.25], lookAt: [0.16, -1.15, 0.08], fov: 28 },
  'Right Foot': { pos: [-0.28, -1.15, 1.25], lookAt: [-0.16, -1.15, 0.08], fov: 28 },
  'Full Body': { pos: [0, 0.05, 4.30], lookAt: [0, 0.05, 0], fov: 38 }
};

export interface RegionColorDefinition {
  color: number;
  emissive: number;
  emissiveIntensity: number;
  pointLightColor: number;
  cssBg: string;
  cssText: string;
  cssBorder: string;
}

export const REGION_CHROMATIC_PALETTE: Record<string, RegionColorDefinition> = {
  'Head': {
    color: 0xf59e0b,
    emissive: 0xb45309,
    emissiveIntensity: 0.50,
    pointLightColor: 0xf59e0b,
    cssBg: 'bg-amber-500/15',
    cssText: 'text-amber-500',
    cssBorder: 'border-amber-500/40'
  },
  'Face & Sinus': {
    color: 0xf97316,
    emissive: 0xc2410c,
    emissiveIntensity: 0.50,
    pointLightColor: 0xf97316,
    cssBg: 'bg-orange-500/15',
    cssText: 'text-orange-500',
    cssBorder: 'border-orange-500/40'
  },
  'Ear': {
    color: 0xeab308,
    emissive: 0xa16207,
    emissiveIntensity: 0.50,
    pointLightColor: 0xeab308,
    cssBg: 'bg-yellow-500/15',
    cssText: 'text-yellow-500',
    cssBorder: 'border-yellow-500/40'
  },
  'Neck': {
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 0.48,
    pointLightColor: 0x06b6d4,
    cssBg: 'bg-cyan-500/15',
    cssText: 'text-cyan-500',
    cssBorder: 'border-cyan-500/40'
  },
  'Cervical Spine': {
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.50,
    pointLightColor: 0x10b981,
    cssBg: 'bg-emerald-500/15',
    cssText: 'text-emerald-500',
    cssBorder: 'border-emerald-500/40'
  },
  'Left Chest / Precordium': {
    color: 0xef4444,
    emissive: 0xb91c1c,
    emissiveIntensity: 0.65,
    pointLightColor: 0xef4444,
    cssBg: 'bg-rose-500/15',
    cssText: 'text-rose-500',
    cssBorder: 'border-rose-500/40'
  },
  'Right Chest': {
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.48,
    pointLightColor: 0x0284c7,
    cssBg: 'bg-sky-500/15',
    cssText: 'text-sky-500',
    cssBorder: 'border-sky-500/40'
  },
  'Lungs & Respiration': {
    color: 0x0ea5e9,
    emissive: 0x0284c7,
    emissiveIntensity: 0.50,
    pointLightColor: 0x0ea5e9,
    cssBg: 'bg-sky-500/15',
    cssText: 'text-sky-500',
    cssBorder: 'border-sky-500/40'
  },
  'Upper Back / Thoracic': {
    color: 0x059669,
    emissive: 0x047857,
    emissiveIntensity: 0.48,
    pointLightColor: 0x059669,
    cssBg: 'bg-emerald-500/15',
    cssText: 'text-emerald-500',
    cssBorder: 'border-emerald-500/40'
  },
  'Epigastrium': {
    color: 0xf97316,
    emissive: 0xc2410c,
    emissiveIntensity: 0.55,
    pointLightColor: 0xf97316,
    cssBg: 'bg-orange-500/15',
    cssText: 'text-orange-500',
    cssBorder: 'border-orange-500/40'
  },
  'Umbilicus / Mid-Abdomen': {
    color: 0xeab308,
    emissive: 0xa16207,
    emissiveIntensity: 0.55,
    pointLightColor: 0xeab308,
    cssBg: 'bg-amber-500/15',
    cssText: 'text-amber-500',
    cssBorder: 'border-amber-500/40'
  },
  'Right Lower Quadrant (RLQ)': {
    color: 0xe11d48,
    emissive: 0x9f1239,
    emissiveIntensity: 0.60,
    pointLightColor: 0xe11d48,
    cssBg: 'bg-rose-500/15',
    cssText: 'text-rose-500',
    cssBorder: 'border-rose-500/40'
  },
  'Left Lower Quadrant (LLQ)': {
    color: 0x8b5cf6,
    emissive: 0x6d28d9,
    emissiveIntensity: 0.52,
    pointLightColor: 0x8b5cf6,
    cssBg: 'bg-purple-500/15',
    cssText: 'text-purple-500',
    cssBorder: 'border-purple-500/40'
  },
  'Pelvic / Hypogastrium': {
    color: 0xa855f7,
    emissive: 0x7e22ce,
    emissiveIntensity: 0.52,
    pointLightColor: 0xa855f7,
    cssBg: 'bg-purple-500/15',
    cssText: 'text-purple-500',
    cssBorder: 'border-purple-500/40'
  },
  'Lumbar Spine (Kati)': {
    color: 0x0d9488,
    emissive: 0x0f766e,
    emissiveIntensity: 0.52,
    pointLightColor: 0x0d9488,
    cssBg: 'bg-teal-500/15',
    cssText: 'text-teal-500',
    cssBorder: 'border-teal-500/40'
  },
  'Sacral / Sciatica Origin': {
    color: 0x6366f1,
    emissive: 0x4338ca,
    emissiveIntensity: 0.52,
    pointLightColor: 0x6366f1,
    cssBg: 'bg-indigo-500/15',
    cssText: 'text-indigo-500',
    cssBorder: 'border-indigo-500/40'
  },
  'Sciatic Pathway / Calves': {
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 0.48,
    pointLightColor: 0x06b6d4,
    cssBg: 'bg-cyan-500/15',
    cssText: 'text-cyan-500',
    cssBorder: 'border-cyan-500/40'
  },
  'Left Shoulder': {
    color: 0x2563eb,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.55,
    pointLightColor: 0x2563eb,
    cssBg: 'bg-blue-500/15',
    cssText: 'text-blue-500',
    cssBorder: 'border-blue-500/40'
  },
  'Right Shoulder': {
    color: 0x2563eb,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.55,
    pointLightColor: 0x2563eb,
    cssBg: 'bg-blue-500/15',
    cssText: 'text-blue-500',
    cssBorder: 'border-blue-500/40'
  },
  'Left Arm': {
    color: 0x3b82f6,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.50,
    pointLightColor: 0x3b82f6,
    cssBg: 'bg-blue-500/15',
    cssText: 'text-blue-500',
    cssBorder: 'border-blue-500/40'
  },
  'Right Arm': {
    color: 0x3b82f6,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.50,
    pointLightColor: 0x3b82f6,
    cssBg: 'bg-blue-500/15',
    cssText: 'text-blue-500',
    cssBorder: 'border-blue-500/40'
  },
  'Left Hand': {
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.48,
    pointLightColor: 0x0284c7,
    cssBg: 'bg-sky-500/15',
    cssText: 'text-sky-500',
    cssBorder: 'border-sky-500/40'
  },
  'Right Hand': {
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.48,
    pointLightColor: 0x0284c7,
    cssBg: 'bg-sky-500/15',
    cssText: 'text-sky-500',
    cssBorder: 'border-sky-500/40'
  },
  'Left Hip': {
    color: 0x14b8a6,
    emissive: 0x0f766e,
    emissiveIntensity: 0.50,
    pointLightColor: 0x14b8a6,
    cssBg: 'bg-teal-500/15',
    cssText: 'text-teal-500',
    cssBorder: 'border-teal-500/40'
  },
  'Right Hip': {
    color: 0x14b8a6,
    emissive: 0x0f766e,
    emissiveIntensity: 0.50,
    pointLightColor: 0x14b8a6,
    cssBg: 'bg-teal-500/15',
    cssText: 'text-teal-500',
    cssBorder: 'border-teal-500/40'
  },
  'Left Knee': {
    color: 0x84cc16,
    emissive: 0x4d7c0f,
    emissiveIntensity: 0.55,
    pointLightColor: 0x84cc16,
    cssBg: 'bg-lime-500/15',
    cssText: 'text-lime-500',
    cssBorder: 'border-lime-500/40'
  },
  'Right Knee': {
    color: 0x84cc16,
    emissive: 0x4d7c0f,
    emissiveIntensity: 0.55,
    pointLightColor: 0x84cc16,
    cssBg: 'bg-lime-500/15',
    cssText: 'text-lime-500',
    cssBorder: 'border-lime-500/40'
  },
  'Left Leg': {
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.50,
    pointLightColor: 0x10b981,
    cssBg: 'bg-emerald-500/15',
    cssText: 'text-emerald-500',
    cssBorder: 'border-emerald-500/40'
  },
  'Right Leg': {
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.50,
    pointLightColor: 0x10b981,
    cssBg: 'bg-emerald-500/15',
    cssText: 'text-emerald-500',
    cssBorder: 'border-emerald-500/40'
  },
  'Left Foot': {
    color: 0x0ea5e9,
    emissive: 0x0284c7,
    emissiveIntensity: 0.48,
    pointLightColor: 0x0ea5e9,
    cssBg: 'bg-sky-500/15',
    cssText: 'text-sky-500',
    cssBorder: 'border-sky-500/40'
  },
  'Right Foot': {
    color: 0x0ea5e9,
    emissive: 0x0284c7,
    emissiveIntensity: 0.48,
    pointLightColor: 0x0ea5e9,
    cssBg: 'bg-sky-500/15',
    cssText: 'text-sky-500',
    cssBorder: 'border-sky-500/40'
  },
  'Full Body': {
    color: 0x0d9488,
    emissive: 0x0f766e,
    emissiveIntensity: 0.45,
    pointLightColor: 0x0d9488,
    cssBg: 'bg-teal-500/15',
    cssText: 'text-teal-500',
    cssBorder: 'border-teal-500/40'
  }
};

export const DEFAULT_REGION_COLOR: RegionColorDefinition = {
  color: 0x0d9488,
  emissive: 0x0f766e,
  emissiveIntensity: 0.45,
  pointLightColor: 0x0d9488,
  cssBg: 'bg-teal-500/15',
  cssText: 'text-teal-500',
  cssBorder: 'border-teal-500/40'
};
