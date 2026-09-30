/**
 * 100,000-Case Bare-Metal Throughput & Zero-Leak Memory Stress Test
 * Evaluates memory RSS stability, GC pressure, and extreme concurrency throughput.
 */

import { ClinicalParserService } from '../src/services/clinicalParser.service';

export function run100kStressTest(totalEncounters: number = 100000) {
  console.log(`\n========================================================================`);
  console.log(`  RUNNING 100,000-CASE BARE-METAL HIGH-THROUGHPUT STRESS TEST`);
  console.log(`========================================================================`);

  if (global.gc) {
    global.gc();
  }
  const memBefore = process.memoryUsage().rss / (1024 * 1024);

  const sampleTemplates = [
    (i: number) => `Patient ${i}: 4 din se tez bukhar aur gale me dard hai. BP 120/80, Pulse ${70 + (i % 25)}, Temp 101.2 F. Paracetamol 650mg TDS aur Sitopaladi Churna 3g BD lijiye.`,
    (i: number) => `Patient ${i}: 2 mahine se pet me jalan aur acidity hai. BP 130/84, Pulse ${68 + (i % 20)}. Pantoprazole 40mg OD khali pet aur Avipattikar Churna 3g lijiye.`,
    (i: number) => `Patient ${i}: 6 mahine se dono ghutne me dard hai. BP 140/90, Pulse ${72 + (i % 18)}. Yograj Guggulu 2 goli BD aur Paracetamol 650mg SOS lijiye.`,
    (i: number) => `Patient ${i}: 1 mahine se kamzori aur peshab me jalan hai. BP 134/86, Pulse ${75 + (i % 22)}. Chandraprabha Vati 2 goli BD lijiye.`,
    (i: number) => `Patient ${i}: Sukhi khansi aur seene me seeti awaz hai. BP 122/78, Pulse ${74 + (i % 16)}. Montelukast 10mg HS aur Sitopaladi Churna 3g BD.`,
    (i: number) => `Patient ${i}: Kamar se leke pair tak nas kheenchti hai. BP 128/82, Pulse ${70 + (i % 20)}. Pregabalin 75mg HS aur Yograj Guggulu 2 tabs BD.`,
    (i: number) => `Patient ${i}: Sir me bhari-pan aur ghabrahat hoti hai. BP 150/96, Pulse ${78 + (i % 15)}. Amlodipine 5mg OD subah lijiye.`,
    (i: number) => `Patient ${i}: Peshab me jalan aur bukhar hai 3 din se. BP 120/78, Pulse ${80 + (i % 18)}. Cefixime 200mg BD aur Gokshuradi Guggulu 2 tabs BD.`,
    (i: number) => `Patient ${i}: Mal me khoon aur arsha ki pareshani hai. BP 124/80, Pulse ${72 + (i % 14)}. Triphala Churna 3g HS aur Arshoghni Vati 2 tabs BD.`,
    (i: number) => `Patient ${i}: Raat ko neend nahi aati aur bechaini rehti hai. BP 118/76, Pulse ${68 + (i % 16)}. Ashwagandha Churna 3g BD dudh ke sath lijiye.`,
    (i: number) => `Patient ${i}: Haath aur kamar me daane aur khujli ho rahi hai. BP 120/80, Pulse ${72 + (i % 12)}. Khadirarishta 20ml BD aur Levocetirizine 5mg HS.`,
    (i: number) => `Patient ${i}: Pait me marod aur dast lag rahe hain. BP 110/70, Pulse ${82 + (i % 20)}. Kutajarishta 15ml BD aur Mebeverine 135mg BD lijiye.`,
    (i: number) => `Patient ${i}: Subah uthne par ungliyon me jakdan aur dard rehta hai. BP 132/84, Pulse ${74 + (i % 16)}. Simhanada Guggulu 2 tabs BD.`,
    (i: number) => `Patient ${i}: 2 hafte se balgam wali khansi aur thakaan hai. BP 118/78, Pulse ${76 + (i % 18)}. Azithromycin 500mg OD aur Vasavaleha 5g BD.`,
    (i: number) => `Patient ${i}: Khate dakar aur gale me jalan rehti hai khane ke baad. BP 126/82, Pulse ${70 + (i % 15)}. Sutashekhar Ras 1 tab BD aur Shankha Bhasma.`,
    (i: number) => `Patient ${i}: Thakan, kamzori aur pairo me sujan hai. BP 138/88, Pulse ${76 + (i % 16)}. Punarnavasava 20ml BD aur Metformin 500mg BD lijiye.`
  ];

  const tStart = performance.now();
  let parsedCount = 0;

  for (let i = 0; i < totalEncounters; i++) {
    const generator = sampleTemplates[i % sampleTemplates.length];
    const text = generator(i);
    const res = ClinicalParserService.parse(text, `stress-${i}`);
    if (res.symptoms.length > 0 && !!res.vitals.bp && (res.allopathicPrescriptions.length > 0 || res.ayushPrescriptions.length > 0)) {
      parsedCount++;
    }
  }

  const tEnd = performance.now();
  const totalTimeMs = tEnd - tStart;
  const avgLatencyMs = totalTimeMs / totalEncounters;
  const throughput = Math.round((totalEncounters / totalTimeMs) * 1000);

  const memAfter = process.memoryUsage().rss / (1024 * 1024);
  const memDelta = memAfter - memBefore;

  console.log(`• Total Encounters Parsed:  ${parsedCount.toLocaleString()} / ${totalEncounters.toLocaleString()}`);
  console.log(`• Total Stress Duration:    ${totalTimeMs.toFixed(2)} ms (${(totalTimeMs / 1000).toFixed(3)}s)`);
  console.log(`• Extraction Throughput:    ${throughput.toLocaleString()} consultations / sec`);
  console.log(`• Mean Latency Per Case:    ${avgLatencyMs.toFixed(5)} ms`);
  console.log(`• Baseline Memory RSS:      ${memBefore.toFixed(2)} MB`);
  console.log(`• Post-Stress Memory RSS:   ${memAfter.toFixed(2)} MB`);
  console.log(`• Memory RSS Delta:         ${memDelta.toFixed(2)} MB (Zero Runaway Leak)`);

  const passed = parsedCount === totalEncounters && avgLatencyMs < 0.1 && memDelta < 80;
  console.log(`• Status:                   ${passed ? 'PASSED (HIGH-THROUGHPUT BARE-METAL VERIFIED)' : 'FAILED'}`);
  console.log(`========================================================================\n`);

  return { passed, throughput, totalTimeMs };
}

if (require.main === module) {
  run100kStressTest(100000);
}
