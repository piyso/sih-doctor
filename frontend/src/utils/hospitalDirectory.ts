/**
 * Single source of truth for departments, rooms and doctors, shared by the kiosk token slip,
 * the doctor desk header and the printed prescription so they always agree.
 */
import { CareStream } from '../types/api';
import { SupportedKioskLanguage, normalizeLang } from './kioskLocalization';

export type DepartmentCode =
  | 'ER' | 'ISO' | 'MLC'
  | 'KAYA' | 'PKRM' | 'SHLK' | 'PRAS' | 'BALA' | 'SHAL'
  | 'GENMED' | 'PAED' | 'OBGY' | 'ORTH' | 'ENT';

type Names = Record<SupportedKioskLanguage, string>;

export interface Department {
  code: DepartmentCode;
  stream: CareStream | 'EMERGENCY';
  room: string;
  floor: 0 | 1 | 2;
  doctor: string;
  names: Names;
}

export const DEPARTMENTS: Record<DepartmentCode, Department> = {
  ER: { code: 'ER', stream: 'EMERGENCY', room: 'ER-1', floor: 0, doctor: 'Emergency duty doctor',
    names: { en: 'Emergency Room', hi: 'आपातकालीन कक्ष', mr: 'आपत्कालीन कक्ष', bn: 'জরুরি বিভাগ', ta: 'அவசர சிகிச்சைப் பிரிவு', te: 'అత్యవసర విభాగం', gu: 'કટોકટી વિભાગ', kn: 'ತುರ್ತು ಚಿಕಿತ್ಸಾ ಘಟಕ', ml: 'അത്യാഹിത വിഭാഗം', pa: 'ਐਮਰਜੈਂਸੀ ਵਿਭਾਗ', or: 'ଜରୁରୀକାଳୀନ ବିଭାଗ' } },
  ISO: { code: 'ISO', stream: 'EMERGENCY', room: '109', floor: 0, doctor: 'Dr. Rameshwar Dayal, MD (Pulmonary Medicine)',
    names: { en: 'Fever & cough isolation clinic', hi: 'बुखार-खाँसी आइसोलेशन क्लिनिक', mr: 'ताप-खोकला विलगीकरण क्लिनिक', bn: 'জ্বর-কাশি আইসোলেশন ক্লিনিক', ta: 'காய்ச்சல்-இருமல் தனிமைப்படுத்தல் மருத்துவமனை', te: 'జ్వరం-దగ్గు ఐసోలేషన్ క్లినిక్', gu: 'તાવ-ઉધરસ આઇસોલેશન ક્લિનિક', kn: 'ಜ್ವರ-ಕೆಮ್ಮು ಪ್ರತ್ಯೇಕ ಚಿಕಿತ್ಸಾಲಯ', ml: 'പനി-ചുമ ഐസൊലേഷൻ ക്ലിനിക്', pa: 'ਬੁਖ਼ਾਰ-ਖੰਘ ਆਈਸੋਲੇਸ਼ਨ ਕਲੀਨਿਕ', or: 'ଜ୍ୱର-କାଶ ଆଇସୋଲେସନ କ୍ଲିନିକ' } },
  MLC: { code: 'MLC', stream: 'EMERGENCY', room: 'ER-2', floor: 0, doctor: 'Casualty Medical Officer',
    names: { en: 'Casualty (medico-legal)', hi: 'कैजुअल्टी (मेडिको-लीगल)', mr: 'अपघात विभाग (मेडिको-लीगल)', bn: 'ক্যাজুয়ালটি (মেডিকো-লিগাল)', ta: 'விபத்துப் பிரிவு (மருத்துவ-சட்ட)', te: 'క్యాజువాలిటీ (మెడికో-లీగల్)', gu: 'કેઝ્યુઅલ્ટી (મેડિકો-લીગલ)', kn: 'ಅಪಘಾತ ವಿಭಾಗ (ವೈದ್ಯ-ಕಾನೂನು)', ml: 'കാഷ്വാലിറ്റി (മെഡിക്കോ-ലീഗൽ)', pa: 'ਕੈਜ਼ੂਅਲਟੀ (ਮੈਡੀਕੋ-ਲੀਗਲ)', or: 'କ୍ୟାଜୁଆଲଟି (ମେଡିକୋ-ଲିଗାଲ)' } },

  KAYA: { code: 'KAYA', stream: 'AYURVEDA', room: '204', floor: 2, doctor: 'Vaidya V. K. Sharma, BAMS, MD (Ayu)',
    names: { en: 'Ayurveda General Medicine (Kayachikitsa)', hi: 'आयुर्वेद सामान्य चिकित्सा (कायचिकित्सा)', mr: 'आयुर्वेद सामान्य चिकित्सा (कायचिकित्सा)', bn: 'আয়ুর্বেদ সাধারণ চিকিৎসা (কায়চিকিৎসা)', ta: 'ஆயுர்வேத பொது மருத்துவம் (காயசிகித்சா)', te: 'ఆయుర్వేద సాధారణ వైద్యం (కాయచికిత్స)', gu: 'આયુર્વેદ સામાન્ય ચિકિત્સા (કાયચિકિત્સા)', kn: 'ಆಯುರ್ವೇದ ಸಾಮಾನ್ಯ ಚಿಕಿತ್ಸೆ (ಕಾಯಚಿಕಿತ್ಸೆ)', ml: 'ആയുർവേദ ജനറൽ മെഡിസിൻ (കായചികിത്സ)', pa: 'ਆਯੁਰਵੇਦ ਆਮ ਇਲਾਜ (ਕਾਇਚਿਕਿਤਸਾ)', or: 'ଆୟୁର୍ବେଦ ସାଧାରଣ ଚିକିତ୍ସା (କାୟଚିକିତ୍ସା)' } },
  PKRM: { code: 'PKRM', stream: 'AYURVEDA', room: '105', floor: 1, doctor: 'Vaidya Pratibha Nair, BAMS, MD (Panchakarma)',
    names: { en: 'Panchakarma (joints, back & nerves)', hi: 'पंचकर्म (जोड़, कमर व नसें)', mr: 'पंचकर्म (सांधे, कंबर व नसा)', bn: 'পঞ্চকর্ম (গাঁট, কোমর ও স্নায়ু)', ta: 'பஞ்சகர்மா (மூட்டு, முதுகு, நரம்பு)', te: 'పంచకర్మ (కీళ్లు, వీపు, నరాలు)', gu: 'પંચકર્મ (સાંધા, કમર અને નસો)', kn: 'ಪಂಚಕರ್ಮ (ಕೀಲು, ಬೆನ್ನು & ನರಗಳು)', ml: 'പഞ്ചകർമ്മ (സന്ധി, മുതുക്, ഞരമ്പ്)', pa: 'ਪੰਚਕਰਮ (ਜੋੜ, ਕਮਰ ਅਤੇ ਨਸਾਂ)', or: 'ପଞ୍ଚକର୍ମ (ଗଣ୍ଠି, ପିଠି ଓ ସ୍ନାୟୁ)' } },
  SHLK: { code: 'SHLK', stream: 'AYURVEDA', room: '215', floor: 2, doctor: 'Vaidya Arvind Shastri, BAMS, MS (Shalakya)',
    names: { en: 'Eye & ENT (Shalakya)', hi: 'नेत्र, कान, नाक, गला (शालाक्य)', mr: 'डोळे, कान, नाक, घसा (शालाक्य)', bn: 'চোখ ও নাক-কান-গলা (শালাক্য)', ta: 'கண் & காது-மூக்கு-தொண்டை (சாலாக்யா)', te: 'కన్ను & చెవి-ముక్కు-గొంతు (శాలాక్య)', gu: 'આંખ અને કાન-નાક-ગળું (શાલાક્ય)', kn: 'ಕಣ್ಣು & ಕಿವಿ-ಮೂಗು-ಗಂಟಲು (ಶಾಲಾಕ್ಯ)', ml: 'കണ്ണ് & ചെവി-മൂക്ക്-തൊണ്ട (ശാലാക്യം)', pa: 'ਅੱਖ ਅਤੇ ਕੰਨ-ਨੱਕ-ਗਲਾ (ਸ਼ਾਲਾਕਿਆ)', or: 'ଆଖି ଓ କାନ-ନାକ-ଗଳା (ଶାଲାକ୍ୟ)' } },
  PRAS: { code: 'PRAS', stream: 'AYURVEDA', room: '206', floor: 2, doctor: 'Vaidya Sunita Pathak, BAMS, MS (Prasuti Tantra)',
    names: { en: 'Women’s health & pregnancy (Prasuti Tantra)', hi: 'महिला स्वास्थ्य व गर्भावस्था (प्रसूति तंत्र)', mr: 'महिला आरोग्य व गरोदरपणा (प्रसूती तंत्र)', bn: 'নারী স্বাস্থ্য ও গর্ভাবস্থা (প্রসূতি তন্ত্র)', ta: 'பெண்கள் நலம் & கர்ப்பம் (பிரசூதி தந்திரம்)', te: 'మహిళల ఆరోగ్యం & గర్భం (ప్రసూతి తంత్రం)', gu: 'સ્ત્રી આરોગ્ય અને ગર્ભાવસ્થા (પ્રસૂતિ તંત્ર)', kn: 'ಮಹಿಳಾ ಆರೋಗ್ಯ & ಗರ್ಭಧಾರಣೆ (ಪ್ರಸೂತಿ ತಂತ್ರ)', ml: 'സ്ത്രീകളുടെ ആരോഗ്യവും ഗർഭവും (പ്രസൂതി തന്ത്രം)', pa: 'ਔਰਤਾਂ ਦੀ ਸਿਹਤ ਅਤੇ ਗਰਭ (ਪ੍ਰਸੂਤੀ ਤੰਤਰ)', or: 'ମହିଳା ସ୍ୱାସ୍ଥ୍ୟ ଓ ଗର୍ଭାବସ୍ଥା (ପ୍ରସୂତି ତନ୍ତ୍ର)' } },
  BALA: { code: 'BALA', stream: 'AYURVEDA', room: '108', floor: 1, doctor: 'Vaidya Meenakshi Sunderam, BAMS, MD (Kaumarbhritya)',
    names: { en: 'Child health (Kaumarbhritya)', hi: 'बाल रोग (कौमारभृत्य)', mr: 'बालरोग (कौमारभृत्य)', bn: 'শিশু স্বাস্থ্য (কৌমারভৃত্য)', ta: 'குழந்தை நலம் (கௌமாரப்ருத்யா)', te: 'పిల్లల ఆరోగ్యం (కౌమారభృత్య)', gu: 'બાળ આરોગ્ય (કૌમારભૃત્ય)', kn: 'ಮಕ್ಕಳ ಆರೋಗ್ಯ (ಕೌಮಾರಭೃತ್ಯ)', ml: 'കുട്ടികളുടെ ആരോഗ്യം (കൗമാരഭൃത്യം)', pa: 'ਬੱਚਿਆਂ ਦੀ ਸਿਹਤ (ਕੌਮਾਰਭ੍ਰਿਤਿਆ)', or: 'ଶିଶୁ ସ୍ୱାସ୍ଥ୍ୟ (କୌମାରଭୃତ୍ୟ)' } },
  SHAL: { code: 'SHAL', stream: 'AYURVEDA', room: '112', floor: 1, doctor: 'Vaidya Harish Joshi, BAMS, MS (Shalya Tantra)',
    names: { en: 'Surgery, piles & wounds (Shalya Tantra)', hi: 'शल्य, बवासीर व घाव (शल्य तंत्र)', mr: 'शल्य, मूळव्याध व जखमा (शल्य तंत्र)', bn: 'শল্য, অর্শ ও ক্ষত (শল্য তন্ত্র)', ta: 'அறுவை, மூலம் & காயம் (சல்ய தந்திரம்)', te: 'శస్త్రచికిత్స, మొలలు & గాయాలు (శల్య తంత్రం)', gu: 'શલ્ય, મસા અને ઘા (શલ્ય તંત્ર)', kn: 'ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ, ಮೂಲವ್ಯಾಧಿ & ಗಾಯ (ಶಲ್ಯ ತಂತ್ರ)', ml: 'ശസ്ത്രക്രിയ, മൂലക്കുരു, മുറിവ് (ശല്യ തന്ത്രം)', pa: 'ਸਰਜਰੀ, ਬਵਾਸੀਰ ਅਤੇ ਜ਼ਖ਼ਮ (ਸ਼ਲਯ ਤੰਤਰ)', or: 'ଶଲ୍ୟ, ଅର୍ଶ ଓ କ୍ଷତ (ଶଲ୍ୟ ତନ୍ତ୍ର)' } },

  GENMED: { code: 'GENMED', stream: 'ALLOPATHY', room: '14', floor: 0, doctor: 'Dr. Ananya Sharma, MBBS, MD (General Medicine)',
    names: { en: 'General Medicine OPD', hi: 'सामान्य चिकित्सा ओपीडी', mr: 'सामान्य चिकित्सा ओपीडी', bn: 'সাধারণ চিকিৎসা ওপিডি', ta: 'பொது மருத்துவப் புறநோயாளர் பிரிவு', te: 'సాధారణ వైద్య ఓపీడీ', gu: 'સામાન્ય ચિકિત્સા ઓપીડી', kn: 'ಸಾಮಾನ್ಯ ವೈದ್ಯಕೀಯ ಒಪಿಡಿ', ml: 'ജനറൽ മെഡിസിൻ ഒപി', pa: 'ਆਮ ਦਵਾਈ ਓਪੀਡੀ', or: 'ସାଧାରଣ ଚିକିତ୍ସା ଓପିଡି' } },
  PAED: { code: 'PAED', stream: 'ALLOPATHY', room: '18', floor: 0, doctor: 'Dr. Kavita Rao, MBBS, MD (Paediatrics)',
    names: { en: 'Children’s OPD (Paediatrics)', hi: 'बाल रोग ओपीडी', mr: 'बालरोग ओपीडी', bn: 'শিশু বিভাগ ওপিডি', ta: 'குழந்தைகள் புறநோயாளர் பிரிவு', te: 'పిల్లల ఓపీడీ', gu: 'બાળકોની ઓપીડી', kn: 'ಮಕ್ಕಳ ಒಪಿಡಿ', ml: 'കുട്ടികളുടെ ഒപി', pa: 'ਬੱਚਿਆਂ ਦੀ ਓਪੀਡੀ', or: 'ଶିଶୁ ଓପିଡି' } },
  OBGY: { code: 'OBGY', stream: 'ALLOPATHY', room: '22', floor: 0, doctor: 'Dr. Meera Iyer, MBBS, MS (Obstetrics & Gynaecology)',
    names: { en: 'Women’s OPD (Obstetrics & Gynaecology)', hi: 'स्त्री रोग व प्रसूति ओपीडी', mr: 'स्त्रीरोग व प्रसूती ओपीडी', bn: 'স্ত্রীরোগ ও প্রসূতি ওপিডি', ta: 'மகளிர் & மகப்பேறு புறநோயாளர் பிரிவு', te: 'స్త్రీ వైద్య & ప్రసూతి ఓపీడీ', gu: 'સ્ત્રી રોગ અને પ્રસૂતિ ઓપીડી', kn: 'ಸ್ತ್ರೀರೋಗ & ಪ್ರಸೂತಿ ಒಪಿಡಿ', ml: 'സ്ത്രീരോഗ & പ്രസവ ഒപി', pa: 'ਔਰਤਾਂ ਅਤੇ ਜਣੇਪਾ ਓਪੀਡੀ', or: 'ସ୍ତ୍ରୀରୋଗ ଓ ପ୍ରସୂତି ଓପିଡି' } },
  ORTH: { code: 'ORTH', stream: 'ALLOPATHY', room: '16', floor: 0, doctor: 'Dr. Sanjay Verma, MBBS, MS (Orthopaedics)',
    names: { en: 'Bones & joints OPD (Orthopaedics)', hi: 'हड्डी व जोड़ ओपीडी (ऑर्थोपेडिक्स)', mr: 'हाडे व सांधे ओपीडी (ऑर्थोपेडिक्स)', bn: 'হাড় ও গাঁট ওপিডি (অর্থোপেডিক্স)', ta: 'எலும்பு & மூட்டு புறநோயாளர் பிரிவு', te: 'ఎముకలు & కీళ్ళ ఓపీడీ', gu: 'હાડકાં અને સાંધા ઓપીડી', kn: 'ಮೂಳೆ & ಕೀಲು ಒಪಿಡಿ', ml: 'അസ്ഥി & സന്ധി ഒപി', pa: 'ਹੱਡੀਆਂ ਅਤੇ ਜੋੜ ਓਪੀਡੀ', or: 'ହାଡ ଓ ଗଣ୍ଠି ଓପିଡି' } },
  ENT: { code: 'ENT', stream: 'ALLOPATHY', room: '20', floor: 0, doctor: 'Dr. Farah Khan, MBBS, MS (ENT)',
    names: { en: 'Eye & ENT OPD', hi: 'आँख, कान, नाक, गला ओपीडी', mr: 'डोळे, कान, नाक, घसा ओपीडी', bn: 'চোখ ও নাক-কান-গলা ওপিডি', ta: 'கண் & காது-மூக்கு-தொண்டை புறநோயாளர் பிரிவு', te: 'కన్ను & చెవి-ముక్కు-గొంతు ఓపీడీ', gu: 'આંખ અને કાન-નાક-ગળું ઓપીડી', kn: 'ಕಣ್ಣು & ಕಿವಿ-ಮೂಗು-ಗಂಟಲು ಒಪಿಡಿ', ml: 'കണ്ണ് & ചെവി-മൂക്ക്-തൊണ്ട ഒപി', pa: 'ਅੱਖ ਅਤੇ ਕੰਨ-ਨੱਕ-ਗਲਾ ਓਪੀਡੀ', or: 'ଆଖି ଓ କାନ-ନାକ-ଗଳା ଓପିଡି' } }
};

const FLOOR_NAMES: Record<0 | 1 | 2, Names> = {
  0: { en: 'Ground floor', hi: 'भूतल', mr: 'तळमजला', bn: 'নিচতলা', ta: 'தரைத்தளம்', te: 'గ్రౌండ్ ఫ్లోర్', gu: 'ગ્રાઉન્ડ ફ્લોર', kn: 'ನೆಲಮಹಡಿ', ml: 'താഴത്തെ നില', pa: 'ਹੇਠਲੀ ਮੰਜ਼ਿਲ', or: 'ତଳ ମହଲା' },
  1: { en: '1st floor', hi: 'पहली मंज़िल', mr: 'पहिला मजला', bn: 'দোতলা', ta: 'முதல் தளம்', te: 'మొదటి అంతస్తు', gu: 'પહેલો માળ', kn: 'ಮೊದಲ ಮಹಡಿ', ml: 'ഒന്നാം നില', pa: 'ਪਹਿਲੀ ਮੰਜ਼ਿਲ', or: 'ପ୍ରଥମ ମହଲା' },
  2: { en: '2nd floor', hi: 'दूसरी मंज़िल', mr: 'दुसरा मजला', bn: 'তিনতলা', ta: 'இரண்டாம் தளம்', te: 'రెండవ అంతస్తు', gu: 'બીજો માળ', kn: 'ಎರಡನೇ ಮಹಡಿ', ml: 'രണ്ടാം നില', pa: 'ਦੂਜੀ ਮੰਜ਼ਿਲ', or: 'ଦ୍ୱିତୀୟ ମହଲା' }
};

const ROOM_WORD: Names = { en: 'Room', hi: 'कक्ष', mr: 'कक्ष', bn: 'কক্ষ', ta: 'அறை', te: 'గది', gu: 'રૂમ', kn: 'ಕೊಠಡಿ', ml: 'മുറി', pa: 'ਕਮਰਾ', or: 'କୋଠରୀ' };

export const departmentName = (code: DepartmentCode, lang?: string) => DEPARTMENTS[code].names[normalizeLang(lang)];
export const floorName = (floor: 0 | 1 | 2, lang?: string) => FLOOR_NAMES[floor][normalizeLang(lang)];
export const roomLabel = (code: DepartmentCode, lang?: string) => `${ROOM_WORD[normalizeLang(lang)]} ${DEPARTMENTS[code].room}`;

/** The doctor profile shown on the doctor desk and printed on the prescription. */
export const DOCTOR_PROFILES: Record<'AYURVEDA' | 'ALLOPATHY', { name: string; title: string; registration: string; department: DepartmentCode; unit: string }> = {
  AYURVEDA: {
    name: 'Vaidya V. K. Sharma',
    title: 'BAMS, MD (Ayu) · Kayachikitsa',
    registration: 'CCIM Reg. AYU/84920',
    department: 'KAYA',
    unit: 'Kayachikitsa OPD (Unit I)'
  },
  ALLOPATHY: {
    name: 'Dr. Ananya Sharma',
    title: 'MBBS, MD · General Medicine',
    registration: 'DMC Reg. 98421',
    department: 'GENMED',
    unit: 'General Medicine OPD'
  }
};

/** Stable 3-digit token number from a session id (no fake fixed numbers). */
export const tokenFromSession = (code: DepartmentCode, sessionId: string) => {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) hash = (hash * 31 + sessionId.charCodeAt(i)) >>> 0;
  return `${code}-${String((hash % 900) + 100)}`;
};

interface RoutingInput {
  careStream: CareStream;
  age?: number;
  gender?: string;
  isPregnant?: boolean;
  isEmergency: boolean;
  isAirborne: boolean;
  isMlc: boolean;
  complaintText: string;
}

/** Chooses the department for a check-in. */
export const routeCheckIn = ({ careStream, age, gender, isPregnant, isEmergency, isAirborne, isMlc, complaintText }: RoutingInput): DepartmentCode => {
  if (isEmergency) return 'ER';
  if (isAirborne) return 'ISO';
  if (isMlc) return 'MLC';
  const text = complaintText.toLowerCase();
  const allopathy = careStream === 'ALLOPATHY';
  if (age !== undefined && age > 0 && age < 14) return allopathy ? 'PAED' : 'BALA';
  if (gender === 'FEMALE' && (isPregnant || /menstrual|period|pregnan|pelvic|discharge|मासिक|गर्भ/.test(text))) return allopathy ? 'OBGY' : 'PRAS';
  if (/eye|ear|nose|throat|tooth|face|sinus|neck/.test(text)) return allopathy ? 'ENT' : 'SHLK';
  if (/piles|fistula|wound|bleeding while passing stool|anus/.test(text)) return allopathy ? 'GENMED' : 'SHAL';
  if (/knee|joint|back|spine|hip|shoulder|sciatica|lumbar|cervical|stiff/.test(text)) return allopathy ? 'ORTH' : 'PKRM';
  return allopathy ? 'GENMED' : 'KAYA';
};
