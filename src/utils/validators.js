import { MAX_FILE_SIZE_BYTES, ACCEPTED_FILE_TYPES } from './constants';

export function isValidCourseNumber(input) {
  return /^[A-Z]{2,5}\s?\d{4}$/i.test(input.trim());
}

export function isValidPDF(file) {
  if (!file) return { valid: false, error: 'No file provided' };
  if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
    return { valid: false, error: 'Only PDF files are accepted' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit` };
  }
  return { valid: true, error: null };
}

export function isValidStudentInfo(info) {
  const errors = {};
  if (!info.name?.trim()) errors.name = 'Name is required';
  if (!info.netid?.trim()) errors.netid = 'Student ID is required';
  if (!info.major?.trim()) errors.major = 'Major is required';
  return { valid: Object.keys(errors).length === 0, errors };
}
