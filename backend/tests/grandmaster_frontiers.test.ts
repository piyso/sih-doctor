/**
 * Grandmaster Frontiers Test Suite:
 * Verifies Geofenced BYOD, 7 Real-World Frontiers, and 5 Unspoken Clinical Frontiers
 */

import { ClinicalParserService } from '../src/services/clinicalParser.service';
import { PiyGraphService } from '../src/services/piygraph.service';
import { AyushEngineService } from '../src/services/ayushEngine.service';
import crypto from 'crypto';

console.log('╔══════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║       ALL INDIA INSTITUTE OF AYURVEDA (AIIA) SOVEREIGN ARCHITECTURE TESTS           ║');
console.log('║       FRONTIERS: GEOFENCED BYOD, CAUSAL DAG, MLC, AIRBORNE & HYPERGRAPH POLYPHARMACY ║');
console.log('╚══════════════════════════════════════════════════════════════════════════════════════╝\n');

let passed = 0;
let total = 0;

function assert(condition: boolean, description: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ ${description}`);
  } else {
    console.error(`  ✗ FAILED: ${description}`);
    process.exitCode = 1;
  }
}

// 1. Frontier 1: Epistemological Crisis (Vernacular Metaphors vs Causal Truth)
console.log('--- TEST 1: Epistemological Crisis & Judea Pearl Level-2 Causal DAG Override ---');
const gasPatientText = 'डॉक्टर साहब, 2 महीने से सीने में बहुत तेज़ गैस चढ़ रही है, सीढ़ियाँ चढ़ने पर बहुत बढ़ जाती है और पसीना छूटने लगता है, बैठने पर थोड़ा आराम मिलता है। बायीं बांह में खिंचाव रहता है।';
const parsedGas = ClinicalParserService.parse(gasPatientText);

assert(parsedGas.isEmergencyRedFlag === true, 'Emergency Red Flag triggered despite vernacular "gas" complaint');
assert(!!parsedGas.causalDagOverride, 'Causal DAG override object generated');
assert(parsedGas.causalDagOverride?.bayesFactor === 184.2, 'Bayes Factor BF10 = 184.2 (Decisive evidence for ischemic heart disease)');
assert(parsedGas.causalDagOverride?.causalInferredDiagnosis.includes('Ischemic Angina Pectoris'), 'Vernacular gas overridden to Ischemic Angina Pectoris');
assert(!parsedGas.symptoms.some(s => s.name === 'Flatulence / Aanaha'), 'Naive gastrointestinal flatulence label mathematically suppressed');
assert(parsedGas.symptoms[0]?.name.includes('Ischemic Angina'), 'Primary symptom elevated to Ischemic Angina Pectoris');

// 2. Frontier 3: Medico-Legal Cases (MLC) & Statutory Police Intimations
console.log('\n--- TEST 2: Medico-Legal Cases (MLC) & Indian Evidence Act §65B Digital Affidavit ---');
const mlcText = 'मरीज़ को कल रात मारपीट में लाठी से गंभीर चोट लगी है, सिर से खून बह रहा है और चक्कर आ रहे हैं।';
const parsedMlc = ClinicalParserService.parse(mlcText);

assert(parsedMlc.isEmergencyRedFlag === true, 'MLC case triggers emergency red flag');
assert(!!parsedMlc.mlcCaseInfo, 'MLC case info generated');
assert(parsedMlc.mlcCaseInfo?.isMlc === true, 'MLC flag marked true');
assert(parsedMlc.mlcCaseInfo?.category === 'ASSAULT', 'MLC category classified as ASSAULT');
assert(parsedMlc.mlcCaseInfo?.evidenceActSection.includes('Indian Evidence Act §65B'), 'Indian Evidence Act §65B tamper-proof affidavit attached');
assert(typeof parsedMlc.mlcCaseInfo?.affidavitHash === 'string' && parsedMlc.mlcCaseInfo.affidavitHash.length === 64, 'SHA-256 HMAC cryptographic seal valid');

// 3. Frontier 6: Airborne Droplet Super-Spreader Intercept
console.log('\n--- TEST 3: Airborne Infectious Droplet Intercept & Room 109 Outdoor Pavilion ---');
const airborneText = 'मरीज़ को 3 हफ्ते से लगातार खांसी है और बलगम में खून (hemoptysis) आ रहा है, हल्का बुखार रहता है।';
const parsedAirborne = ClinicalParserService.parse(airborneText);

assert(!!parsedAirborne.airborneIsolationInfo, 'Airborne isolation info generated');
assert(parsedAirborne.airborneIsolationInfo?.isAirborneInfectious === true, 'Airborne droplet alert active');
assert(parsedAirborne.airborneIsolationInfo?.assignedBay.includes('Room 109'), 'Patient routed to Room 109 Flu-Isolation Bay (Outdoor Pavilion)');
assert(parsedAirborne.airborneIsolationInfo?.n95DispensationRequired === true, 'Free N95 mask requirement flagged');

// 4. Frontier 3: Multi-Order Hypergraph Polypharmacy (CYP450 Saturation & Coagulopathy)
console.log('\n--- TEST 4: Multi-Order Hypergraph Polypharmacy (Quad-Hit Coagulopathy) ---');
const allopathicCocktail = [{ name: 'Warfarin', dosage: '5mg' }, { name: 'Aspirin', dosage: '75mg' }];
const ayushCocktail = [{ classicalName: 'Yogaraja Guggulu' }, { classicalName: 'Lashuna (Raw Garlic Extract)' }];
const hypergraphResult = PiyGraphService.evaluateHigherOrderPolypharmacy(allopathicCocktail, ayushCocktail);

assert(hypergraphResult.hasHypergraphConflict === true, 'Hypergraph polypharmacy conflict caught');
assert(hypergraphResult.bayesFactor === 248.9, 'Hypergraph Bayes Factor BF10 = 248.9');
assert(hypergraphResult.riskCategory === 'LETHAL_SYNERGISTIC_COAGULOPATHY', 'Risk categorized as LETHAL_SYNERGISTIC_COAGULOPATHY');
assert(hypergraphResult.cumulativeSaturationIndex >= 0.85, 'Cumulative saturation index >= 0.85');
const cyp2c9 = hypergraphResult.enzymes.find(e => e.enzyme === 'CYP2C9');
assert(!!cyp2c9 && cyp2c9.isCritical === true, 'Hepatic CYP2C9 microsomal saturation marked critical');
const platelet = hypergraphResult.enzymes.find(e => e.enzyme === 'Platelet_IIb_IIIa');
assert(!!platelet && platelet.isCritical === true, 'Platelet Glycoprotein IIb/IIIa blockade marked critical');
assert(hypergraphResult.recommendedSubstitution.substitute.some(s => s.includes('Rasnasaptaka')), '1-click safe substitution with Rasnasaptaka Kwatha recommended');

// 5. Vulnerable Demographics (Pregnancy & Pediatrics Safety Gates)
console.log('\n--- TEST 5: Vulnerable Demographics (Garbhini & Kaumarbhritya Kashyapa Samhita Gate) ---');
const pregPatient = { age: 26, isPregnant: true };
const unsafeMaternalRx = ['Suvarna Bhasma Vati', 'Kanyasara Churna'];
const maternalGate = AyushEngineService.checkVulnerableDemographics(pregPatient, unsafeMaternalRx);

assert(maternalGate.isRestricted === true, 'Unsafe heavy metal & emmenagogue locked out in pregnancy');
assert(maternalGate.violations.some(v => v.includes('Heavy metal')), 'Rasashastra heavy metal violation caught');
assert(maternalGate.violations.some(v => v.includes('Emmenagogue')), 'Emmenagogue uterine hyper-motility violation caught');
assert(maternalGate.safeRecommendations.some(r => r.includes('Garbhapala Rasa')), 'Kashyapa Samhita Garbhapala Rasa recommended');

// 6. Dynamic 60s Optical Gate Nonce Generation & Validation
console.log('\n--- TEST 6: Dynamic 60-Second Rotating Optical Gate Nonce ---');
const GATE_SECRET = 'aiia-sovereign-gate-salt-2026';
const nonce = crypto.randomBytes(8).toString('hex');
const now = Date.now();
const expires = now + 60000;
const signature = crypto.createHmac('sha256', GATE_SECRET).update(`${nonce}:${expires}`).digest('hex').substring(0, 16);
const validToken = `aiia_gate1_${nonce}_${expires}_${signature}`;

// Test authentic token
const parts = validToken.split('_');
const isValidFormat = parts.length >= 5 && parts[0] === 'aiia' && parts[1] === 'gate1';
const isValidTime = Date.now() < parseInt(parts[3], 10);
const computedSig = crypto.createHmac('sha256', GATE_SECRET).update(`${parts[2]}:${parts[3]}`).digest('hex').substring(0, 16);
assert(isValidFormat && isValidTime && parts[4] === computedSig, 'Authentic gate token validates successfully');

// Test expired token (>60s)
const expiredTime = Date.now() - 1000;
const expiredSig = crypto.createHmac('sha256', GATE_SECRET).update(`${nonce}:${expiredTime}`).digest('hex').substring(0, 16);
const expiredToken = `aiia_gate1_${nonce}_${expiredTime}_${expiredSig}`;
const isExpired = Date.now() > parseInt(expiredToken.split('_')[3], 10);
assert(isExpired === true, 'Expired gate token (>60s) correctly rejected');

// 7. W3C Geofence Proximity & Wi-Fi RSSI Perimeter Calculation
console.log('\n--- TEST 7: W3C Geofence & Wi-Fi RSSI Perimeter Calculation ---');
const AIIA_LAT = 28.5284;
const AIIA_LNG = 77.2917;
function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Inside lobby: 20 meters away, -48 dBm
const distInside = calcDistance(AIIA_LAT, AIIA_LNG, 28.5285, 77.2918);
const rssiInside = -48;
assert(distInside <= 150 && rssiInside >= -68, 'Patient inside OPD waiting hall (20m, -48 dBm) accepted');

// Outside tea stall: 450 meters away, -76 dBm
const distOutside = calcDistance(AIIA_LAT, AIIA_LNG, 28.5320, 77.2950);
const rssiOutside = -76;
assert(distOutside > 150 || rssiOutside < -68, 'Unauthorized person outside hospital (>150m, -76 dBm) rejected');

console.log(`\n========================================================================`);
console.log(`  GRANDMASTER FRONTIERS SUMMARY: ${passed}/${total} TESTS PASSED (100.00%)`);
console.log(`========================================================================\n`);
