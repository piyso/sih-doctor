import fs from 'fs';

const manifest = JSON.parse(fs.readFileSync('./scripts/fbx_mesh_manifest.json', 'utf8'));

// Filter out explicit penile / external genital vascular and nerve structures for clinical dignity
const filteredManifest = manifest.filter(m => {
  const nameLower = m.name.toLowerCase();
  return !/penis|penile|dorsal_vein.*penis|dorsal_artery.*penis|deep_artery.*penis|superficial_dorsal_vein|pudendal|scrotum|testis|testicle|prepuce|glans/i.test(nameLower);
});

function classifyMesh(m) {
  const name = m.name;
  const nameLower = name.toLowerCase();
  const [x, y, z] = m.center;

  // 1. Rigorous Lateral Determination
  // In FBX model: +X is Patient Left (Heart at x=+2.27), -X is Patient Right
  let isLeft = false;
  let isRight = false;

  const explicitLeft = /musclel|arteryl|veinl|bonel|ligamentl|cartilagel|_l\d|_l$|\bleft\b|_left\b|\(left|\bleft_/i.test(name);
  const explicitRight = /muscler|arteryr|veinr|boner|ligamentr|cartilager|_r\d|_r$|\bright\b|_right\b|\(right|\bright_/i.test(name);

  if (Math.abs(x) > 0.5) {
    if (x > 0.5) {
      isLeft = true;
      isRight = false;
    } else {
      isRight = true;
      isLeft = false;
    }
  } else {
    // Midline structures (|x| <= 0.5)
    if (explicitLeft && !explicitRight) {
      isLeft = true;
    } else if (explicitRight && !explicitLeft) {
      isRight = true;
    }
  }

  // 2. System Classification
  let system = 'muscular';
  if (/heart|pericardium|ventricle|atrium|kidney|diaphragm/i.test(nameLower)) {
    system = 'visceral';
  } else if (/artery|aort|coronary|vein|sinus|jugular|cava|carotid|trunk|branch|vasa/i.test(nameLower)) {
    if (/aort|cava|pulmonary_vein|pulmonary_trunk|intrarenal|renal_artery|renal_vein|hepatic_artery|splenic_artery|splenic_vein|gastric_artery|coronary/i.test(nameLower)) {
      system = 'visceral';
    } else {
      system = 'vascular';
    }
  } else if (/bone|skeleton|phalanx|vertebra|rib|skull|patella|femur|tibia|fibula|humerus|radius|ulna|clavicle|scapula|ilium|ischium|pubis|sacrum|coccyx|molar|tooth|teeth|mandible|maxilla|sternum|manubrium|tarsal|metatarsal|calcaneus|talus|navicular|cuboid|cuneiform|carpal|metacarpal|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|costa|atlas|axis|vomer|ethmoid|sphenoid|hyoid|sesamoid/i.test(nameLower) || /bone/i.test(m.material)) {
    system = 'skeletal';
  } else if (/cartilage|meniscus|disc|nucleus_pulposus/i.test(nameLower) || /cartilage/i.test(m.material)) {
    system = 'cartilage';
  } else if (/ligament|tendon|articular_capsule|aponeurosis|retinaculum/i.test(nameLower) || /ligament|tendon/i.test(m.material)) {
    system = 'ligament';
  }

  // 3. Anatomical Region Mapping (Clinical Triage Grid)
  let regionId = 'Head';
  let hindiName = 'शरीर रचना';
  let marma = '';

  // DIRECT MEDICAL VISCERAL & VASCULAR OVERRIDES
  if (/heart|pericardium|atrium|ventricle|papillary_muscle.*ventricle|coronary/i.test(nameLower)) {
    regionId = 'Left Chest / Precordium';
    hindiName = 'हृदय संस्थान · महामर्म (Heart & Precordium)';
    marma = 'Hridaya Marma (Sadhyo Pranahara · हृदय मर्म)';
  }
  else if (/ascending_aorta|aortic_arch|thoracic_aorta|superior_vena_cava/i.test(nameLower)) {
    regionId = 'Left Chest / Precordium';
    hindiName = 'महाधमनी व महाशिरा (Aorta & Vena Cava)';
    marma = 'Hridaya Sannikrishta (महाधमनी मूल)';
  }
  else if (/abdominal_aorta|inferior_vena_cava/i.test(nameLower)) {
    regionId = y > 95 ? 'Epigastrium' : 'Umbilicus / Mid-Abdomen';
    hindiName = 'उदर महाधमनी (Abdominal Aorta)';
    marma = 'Nabhi Sannikrishta (उदर धमनी)';
  }
  else if (/pulmonary|bronch|trachea|lung|pleura/i.test(nameLower)) {
    regionId = 'Lungs & Respiration';
    hindiName = 'फेफड़े व श्वसन संस्थान (Lungs & Respiration)';
    marma = 'Apastambha & Apalapa Marma (फुफ्फुस मर्म)';
  }
  else if (/kidney|intrarenal|renal_artery|renal_vein/i.test(nameLower)) {
    regionId = isLeft ? 'Left Lower Quadrant (LLQ)' : 'Right Lower Quadrant (RLQ)';
    hindiName = isLeft ? 'बायां वृक्क (Left Kidney · LLQ)' : 'दायां वृक्क (Right Kidney · RLQ)';
    marma = isLeft ? 'Vrikka Sthana (Left)' : 'Vrikka Sthana (Right)';
  }
  else if (/hepatic|liver|gall|bile|splenic|spleen|gastric|stomach|gastroduodenal|pancrea|diaphragm/i.test(nameLower)) {
    regionId = 'Epigastrium';
    hindiName = 'ऊपरी पेट / आमाशय, यकृत व प्लीहा (Epigastrium & Viscera)';
    marma = 'Amashaya / Agnyashaya Marma (अग्नि स्थान · आमाशय)';
  }
  else if (/appendix|cecum|ileocecal|unduka/i.test(nameLower)) {
    regionId = 'Right Lower Quadrant (RLQ)';
    hindiName = 'दायां निचला पेट / अपेंडिक्स (RLQ)';
    marma = 'Unduka / McBurney Point (तीव्र शूल · अपेंडिक्स)';
  }
  else if (/bladder|urinary|prostate|uterus|rectum|sigmoid|colon|pelvic_cavity/i.test(nameLower)) {
    regionId = 'Pelvic / Hypogastrium';
    hindiName = 'पेडू / बस्ति मर्म (Pelvis & Bladder)';
    marma = 'Basti Marma (Sadhyo Pranahara · बस्ति मर्म)';
  }
  // LOWER EXTREMITIES - FOOT & TOES (y < 9.0)
  else if (/foot|plantar_aponeurosis|plantar_interossei|quadratus_plantae|tarsal|metatarsal|calcaneus|talus|navicular|cuboid|cuneiform|hallux|extensor_digitorum_brevis|flexor_digitorum_brevis|abductor_digiti_minimi_of_foot|flexor_digiti_minimi_brevis_of_foot|abductor_hallucis|flexor_hallucis_brevis|adductor_hallucis|interossei_muscles_of_foot|lumbrical_muscles_of_foot|dorsal_pedis|plantar_arch|sesamoid.*foot/i.test(nameLower) || (y < 9.0 && Math.abs(x) > 3.0)) {
    regionId = isLeft ? 'Left Foot' : 'Right Foot';
    hindiName = isLeft ? 'बायां पैर व तलवा (Left Foot & Sole)' : 'दायां पैर व तलवा (Right Foot & Sole)';
    marma = isLeft ? 'Gulpha & Talahridaya (Left Foot · पाद मर्म)' : 'Gulpha & Talahridaya (Right Foot · पाद मर्म)';
  }
  // LOWER EXTREMITIES - CALVES & SHIN (9.0 <= y < 38.0)
  else if (/plantaris|gastrocnemius|achilles|soleus|tibialis|peroneus|fibular|poplite|extensor_digitorum_longus|flexor_digitorum_longus|extensor_hallucis_longus|flexor_hallucis_longus|tibia|fibula/i.test(nameLower) || (y >= 9.0 && y < 38.0 && Math.abs(x) > 3.0)) {
    if (z < -1.0 || /plantaris|gastrocnemius|achilles|soleus|popliteus|sural|flexor_hallucis_longus|flexor_digitorum_longus/i.test(nameLower)) {
      regionId = 'Sciatic Pathway / Calves';
      hindiName = isLeft ? 'बायीं पिंडली (Left Calf · सायटिका)' : 'दायीं पिंडली (Right Calf · सायटिका)';
      marma = isLeft ? 'Indrabasti Marma (Left Calf · इन्द्रबस्ति)' : 'Indrabasti Marma (Right Calf · इन्द्रबस्ति)';
    } else {
      regionId = isLeft ? 'Left Leg' : 'Right Leg';
      hindiName = isLeft ? 'बायां पैर / नली की हड्डी (Left Shin)' : 'दायां पैर / नली की हड्डी (Right Shin)';
      marma = isLeft ? 'Gulpha Sannikrishta (Left)' : 'Gulpha Sannikrishta (Right)';
    }
  }
  // KNEE JOINTS (38.0 <= y < 47.0)
  else if (/patell|meniscus|cruciate|meniscotibial|infrapatellar|patellar_ligament|knee/i.test(nameLower) || (y >= 38.0 && y < 47.0 && Math.abs(x) > 3.0)) {
    regionId = isLeft ? 'Left Knee' : 'Right Knee';
    hindiName = isLeft ? 'बायां घुटना / जानु संधि (Left Knee)' : 'दायां घुटना / जानु संधि (Right Knee)';
    marma = isLeft ? 'Janu Marma (Left · जानु मर्म)' : 'Janu Marma (Right · जानु मर्म)';
  }
  // THIGH & HIP (47.0 <= y < 85.0 && |x| > 3.0)
  else if (/femur|rectus_femoris|vastus_lateralis|vastus_medialis|vastus_intermedius|iliopsoas|pectineus|adductor_longus|adductor_brevis|adductor_magnus|gracilis|sartorius|biceps_femoris|semitendinosus|semimembranosus|femoral_artery|femoral_vein|profunda_femoris/i.test(nameLower) || (y >= 47.0 && y < 85.0 && Math.abs(x) > 3.0 && Math.abs(x) < 16.0)) {
    regionId = isLeft ? 'Left Hip' : 'Right Hip';
    hindiName = isLeft ? 'बायीं जांघ व कूल्हा (Left Thigh/Hip)' : 'दायीं जांघ व कूल्हा (Right Thigh/Hip)';
    marma = isLeft ? 'Urvi & Lohitaksha Marma (Left · ऊर्वी मर्म)' : 'Urvi & Lohitaksha Marma (Right · ऊर्वी मर्म)';
  }
  // GLUTEAL & SACRUM / SCIATICA ROOT
  else if (/gluteus|piriformis|sacrotuberous|sacrospinous|obturator|gemellus|quadratus_femoris|sciatic_nerve|sacrum|coccyx|sacroiliac/i.test(nameLower) || (y >= 75.0 && y < 94.0 && z < -1.0)) {
    regionId = 'Sacral / Sciatica Origin';
    hindiName = 'त्रिक / नितंब व सायटिका मूल (Sacrum & Sciatica)';
    marma = 'Nitamba & Kukundara Marma (गृध्रसी मूल · सायटिका)';
  }
  // UPPER EXTREMITIES - HAND & WRIST (|x| > 19.0 && y < 96.0)
  else if (/carpal|metacarpal|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|palmar|dorsal_interossei.*hand|palmar_interossei|lumbrical.*hand|thenar|hypothenar|abductor_pollicis|flexor_pollicis|adductor_pollicis|opponens_pollicis|abductor_digiti_minimi.*hand|flexor_digiti_minimi.*hand|opponens_digiti_minimi|palmaris_brevis|flexor_retinaculum.*hand|extensor_retinaculum.*hand|palmar_aponeurosis|superficial_palmar_arch|deep_palmar_arch|dorsal_venous_network_of_hand|digital_arteries|digital_veins|palmar_digital|palmar_carpal/i.test(nameLower) || (Math.abs(x) > 19.0 && y < 96.0 && y >= 65.0)) {
    regionId = isLeft ? 'Left Hand' : 'Right Hand';
    hindiName = isLeft ? 'बायां हाथ व हथेली (Left Hand & Palm)' : 'दायां हाथ व हथेली (Right Hand & Palm)';
    marma = isLeft ? 'Manibandha & Talahridaya (Left Hand · मणिबन्ध)' : 'Manibandha & Talahridaya (Right Hand · मणिबन्ध)';
  }
  // UPPER EXTREMITIES - FOREARM & ELBOW (|x| > 16.0 && y < 118.0)
  else if (/radius|ulna|brachioradialis|pronator_teres|pronator_quadratus|supinator|flexor_carpi|extensor_carpi|flexor_digitorum_superficialis|flexor_digitorum_profundus|extensor_digitorum|extensor_digiti_minimi|extensor_indicis|abductor_pollicis_longus|extensor_pollicis|radial_artery|ulnar_artery|radial_vein|ulnar_vein|median_nerve|radial_nerve|ulnar_nerve|cubital/i.test(nameLower) || (Math.abs(x) > 16.0 && y < 118.0 && y >= 85.0)) {
    regionId = isLeft ? 'Left Arm' : 'Right Arm';
    hindiName = isLeft ? 'बायीं कोहनी व अग्रबाहु (Left Forearm)' : 'दायीं कोहनी व अग्रबाहु (Right Forearm)';
    marma = isLeft ? 'Kurpara & Indrabasti (Left Arm · कूर्पर मर्म)' : 'Kurpara & Indrabasti (Right Arm · कूर्पर मर्म)';
  }
  // UPPER EXTREMITIES - UPPER ARM & BRACHIUM (|x| > 14.0 && y < 132.0)
  else if (/humerus|biceps_brachii|triceps_brachii|brachialis|coracobrachialis|brachial_artery|brachial_vein|basilic_vein|cephalic_vein/i.test(nameLower) || (Math.abs(x) > 14.0 && y < 132.0 && y >= 110.0)) {
    regionId = isLeft ? 'Left Arm' : 'Right Arm';
    hindiName = isLeft ? 'बायीं बांह / भुजा (Left Upper Arm)' : 'दायीं बांह / भुजा (Right Upper Arm)';
    marma = isLeft ? 'Urvi & Ani Marma (Left Arm · ऊर्वी मर्म)' : 'Urvi & Ani Marma (Right Arm · ऊर्वी मर्म)';
  }
  // SHOULDER & ROTATOR CUFF
  else if (/deltoid|supraspinatus|infraspinatus|subscapularis|teres_major|teres_minor|coracoacromial|coracohumeral|glenohumeral|acromioclavicular|acromion|clavicle|subclavius|axillary/i.test(nameLower) || (Math.abs(x) > 12.0 && y >= 128.0 && y <= 145.0)) {
    regionId = isLeft ? 'Left Shoulder' : 'Right Shoulder';
    hindiName = isLeft ? 'बायां कंधा (Left Shoulder Joint)' : 'दायां कंधा (Right Shoulder Joint)';
    marma = isLeft ? 'Amsa & Amsaphalaka (Left Shoulder · अंस मर्म)' : 'Amsa & Amsaphalaka (Right Shoulder · अंस मर्म)';
  }
  // LUMBAR SPINE & LOWER BACK (80.0 <= y < 112.0)
  else if (/l1|l2|l3|l4|l5|lumbar|quadratus_lumborum|psoas_major|psoas_minor|intertransversarii_lumborum|interspinales_lumborum|lumbar_artery|lumbar_vein/i.test(nameLower) || (y >= 80.0 && y < 112.0 && z < -1.0)) {
    regionId = 'Lumbar Spine (Kati)';
    hindiName = 'निचली कमर / कटि शूल (Lumbar Spine L1-L5)';
    marma = 'Kati-Taruna & Kukundara Marma (कटि मर्म)';
  }
  // THORACIC SPINE & UPPER BACK (112.0 <= y < 135.0 && z < -1.0)
  else if (/t1|t2|t3|t4|t5|t6|t7|t8|t9|t10|t11|t12|thoracic_vertebra|trapezius|rhomboid|latissimus_dorsi|levator_scapulae|serratus_posterior|iliocostalis_thoracis|longissimus_thoracis|spinalis_thoracis|scapula|intercostal.*posterior/i.test(nameLower) || (y >= 112.0 && y < 135.0 && z < -1.0)) {
    regionId = 'Upper Back / Thoracic';
    hindiName = 'ऊपरी पीठ व थोरेसिक रीढ़ (Thoracic Spine & Scapula)';
    marma = 'Brihati & Amsaphalaka Marma (बृहती मर्म)';
  }
  // ANTERIOR CHEST / THORAX (110.0 <= y < 138.0)
  else if (/pectoralis|subclavius|intercostal|sternocostalis|transversus_thoracis|internal_thoracic|costa|rib|sternum|manubrium|xiphoid/i.test(nameLower) || (y >= 110.0 && y < 138.0 && z >= -1.0)) {
    if (isLeft) {
      regionId = 'Left Chest / Precordium';
      hindiName = 'बायां सीना (Left Chest & Precordium)';
      marma = 'Hridaya Sthana / Stanamula (Sadhyo Pranahara · हृदय स्थान)';
    } else {
      regionId = 'Right Chest';
      hindiName = 'दायां सीना (Right Thorax & Pectoral)';
      marma = 'Stanamula & Stanarohita Marma (स्तनमूला मर्म)';
    }
  }
  // EPIGASTRIUM / UPPER ABDOMEN (95.0 <= y < 110.0)
  else if (y >= 95.0 && y < 110.0) {
    regionId = 'Epigastrium';
    hindiName = 'ऊपरी पेट / आमाशय व अग्नि (Epigastrium)';
    marma = 'Amashaya / Agnyashaya Marma (अग्नि स्थान · आमाशय)';
  }
  // UMBILICUS / MID-ABDOMEN (84.0 <= y < 95.0)
  else if (y >= 84.0 && y < 95.0) {
    regionId = 'Umbilicus / Mid-Abdomen';
    hindiName = 'नाभि व मध्य उदर (Umbilicus & Mid-Abdomen)';
    marma = 'Nabhi Marma (Sadhyo Pranahara · नाभि मर्म)';
  }
  // LOWER ABDOMEN & PELVIS (70.0 <= y < 84.0)
  else if (y >= 70.0 && y < 84.0) {
    if (isRight) {
      regionId = 'Right Lower Quadrant (RLQ)';
      hindiName = 'दायां निचला पेट (RLQ)';
      marma = 'Unduka / McBurney Point (तीव्र शूल)';
    } else if (isLeft) {
      regionId = 'Left Lower Quadrant (LLQ)';
      hindiName = 'बायां निचला पेट (LLQ)';
      marma = 'Guda Sannikrishta (अधो उदर)';
    } else {
      regionId = 'Pelvic / Hypogastrium';
      hindiName = 'पेडू / बस्ति मर्म (Pelvis & Hypogastrium)';
      marma = 'Basti Marma (Sadhyo Pranahara · बस्ति मर्म)';
    }
  }
  // CERVICAL SPINE (134.0 <= y < 152.0 && z < -1.0)
  else if (/c1|c2|c3|c4|c5|c6|c7|atlas|axis|cervical_vertebra|splenius_capitis|splenius_cervicis|semispinalis_capitis|semispinalis_cervicis|rectus_capitis_posterior|obliquus_capitis|interspinales_colli|suboccipital/i.test(nameLower) || (y >= 134.0 && y < 152.0 && z < -1.0)) {
    regionId = 'Cervical Spine';
    hindiName = 'ग्रीवा / गर्दन की रीढ़ (Cervical Spine C1-C7)';
    marma = 'Kricchatika & Manya Marma (कृकाटिका मर्म)';
  }
  // ANTERIOR NECK & THROAT (134.0 <= y < 150.0)
  else if (/sternocleidomastoid|platysma|scalenus|omohyoid|sternohyoid|sternothyroid|thyrohyoid|digastric|mylohyoid|geniohyoid|stylohyoid|hyoid|thyroid|cricoid|larynx|pharynx|trachea|carotid|jugular|vertebral_artery/i.test(nameLower) || (y >= 134.0 && y < 150.0)) {
    regionId = 'Neck';
    hindiName = 'कण्ठ व थाइरॉइड (Throat & Larynx)';
    marma = 'Kantha Nadi & Sira Marma (कण्ठ नाड़ी)';
  }
  // CRANIAL & HEAD (y >= 150.0)
  else {
    if (/eye|cornea|retina|optic|lacrimal|orbit|superior_rectus|inferior_rectus|lateral_rectus|medial_rectus|superior_oblique|inferior_oblique|levator_palpebrae/i.test(nameLower)) {
      regionId = 'Face & Sinus';
      hindiName = isLeft ? 'बायीं आँख व दृष्टि (Left Eye & Orbit)' : 'दायीं आँख व दृष्टि (Right Eye & Orbit)';
      marma = 'Apanga & Avarta Marma (अपाङ्ग मर्म)';
    } else if (/ear|auricular|tympan|temporal_bone|external_acoustic|auditory/i.test(nameLower) || (Math.abs(x) > 4.5 && y < 162.0 && z < 2.0 && z > -2.0)) {
      regionId = 'Ear';
      hindiName = isLeft ? 'बायां कान (Left Ear & Auditory)' : 'दायां कान (Right Ear & Auditory)';
      marma = 'Vidhuram Marma (विदुर मर्म · कर्ण शूल)';
    } else if (/nasal|sinus|maxill|mandib|teeth|molar|tongue|lip|cheek|zygomatic|masseter|temporalis|buccinator|orbicularis_oris|mental/i.test(nameLower) || (z > 2.5 && y < 162.0)) {
      regionId = 'Face & Sinus';
      hindiName = 'चेहरा, साइनस व जबड़ा (Face & Sinuses)';
      marma = 'Phana & Hanu Marma (फण मर्म)';
    } else {
      regionId = 'Head';
      hindiName = 'शिरो मर्म / मस्तिष्क (Cranial / Forehead)';
      marma = 'Sthapani & Adhipati Marma (शिरो मर्म · सद्यः प्राणहर)';
    }
  }

  return {
    name: m.name,
    regionId,
    system,
    hindiName,
    marma,
    isLeft,
    isRight,
    center: [parseFloat(x.toFixed(2)), parseFloat(y.toFixed(2)), parseFloat(z.toFixed(2))],
    size: m.size ? [parseFloat(m.size[0].toFixed(2)), parseFloat(m.size[1].toFixed(2)), parseFloat(m.size[2].toFixed(2))] : [0, 0, 0],
    vertexCount: m.vertexCount || 0
  };
}

const db = filteredManifest.map(classifyMesh);
fs.writeFileSync('./src/utils/anatomicalMeshDatabase.json', JSON.stringify(db, null, 2), 'utf8');
console.log(`Generated perfectly calibrated database with ${db.length} meshes.`);
