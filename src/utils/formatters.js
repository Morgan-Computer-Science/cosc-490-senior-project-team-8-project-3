export function formatGPA(gpa) {
  return Number(gpa).toFixed(2);
}

export function formatCredits(credits) {
  return `${credits} credit${credits !== 1 ? 's' : ''}`;
}

export function formatCourseCode(code) {
  return code.trim().toUpperCase();
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
