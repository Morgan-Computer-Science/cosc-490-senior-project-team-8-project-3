// In development, talk to the Express backend directly so form posts do not depend on the Vite proxy.
export const API_BASE = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '');

export const STEP_LABELS = [
  'Student Info',
  'Transcript',
  'Courses',
  'Goals',
  'Review & AI',
];

export const ACCEPTED_FILE_TYPES = ['.pdf'];
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const YEAR_OPTIONS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad'];

export const ENDPOINTS = {
  submit: '/api/submit',
  submitManual: '/api/submit-manual',
  extractBearCard: '/api/bear-card/extract',
  chat: '/api/chat',
  textToSpeech: '/api/voice/tts',
  speechToText: '/api/voice/stt',
  audit: '/api/audit',
  scheduleAgent: '/api/schedule-agent',
  sessions: '/api/sessions',
};
