/**
 * Hospital identity printed on token slips and prescriptions. Set per deployment in the frontend
 * .env (VITE_HOSPITAL_*); the defaults are the AIIA pilot site.
 */
const env = import.meta.env;

export const HOSPITAL = {
  name: (env.VITE_HOSPITAL_NAME as string) || 'ALL INDIA INSTITUTE OF AYURVEDA',
  authority: (env.VITE_HOSPITAL_AUTHORITY as string) || 'Ministry of Ayush, Government of India',
  address: (env.VITE_HOSPITAL_ADDRESS as string) || 'Gautampuri, Sarita Vihar, New Delhi 110076',
  phone: (env.VITE_HOSPITAL_PHONE as string) || '',
  opdPrefix: (env.VITE_HOSPITAL_OPD_PREFIX as string) || 'AIIA/OPD',
  emblem: (env.VITE_HOSPITAL_EMBLEM as string) || '/ashoka-stambh-hd.png'
};
