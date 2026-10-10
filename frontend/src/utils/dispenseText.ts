/** What the pharmacy did with a signed prescription, in the same words on every staff screen. */
const TEXT: Record<string, string> = {
  PENDING_VERIFICATION: 'not collected yet',
  DISPENSED: 'all given',
  PARTIAL: 'partly given',
  NOT_DISPENSED: 'not given',
  REFERRED_BACK: 'sent back to the doctor'
};

export const dispenseText = (status?: string | null): string =>
  TEXT[status || 'PENDING_VERIFICATION'] || String(status).replace(/_/g, ' ').toLowerCase();
