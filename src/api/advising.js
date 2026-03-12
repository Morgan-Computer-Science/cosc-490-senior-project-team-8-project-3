import { API_BASE, ENDPOINTS } from '../utils/constants';

export async function submitAdvisingForm(formData) {
  const payload = new FormData();
  payload.append('student', JSON.stringify(formData.student || {}));
  payload.append('courses', JSON.stringify(formData.courses || []));
  payload.append('goals', formData.goals || '');
  payload.append('notes', formData.notes || '');

  if (formData.transcriptFile) {
    payload.append('transcript', formData.transcriptFile);
  }

  if (formData.bearCardFile) {
    payload.append('bearCard', formData.bearCardFile);
  }

  const res = await fetch(`${API_BASE}${ENDPOINTS.submit}`, {
    method: 'POST',
    body: payload,
  });
  if (!res.ok) {
    let errMsg = '';
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const json = await res.json().catch(() => null);
      if (json) errMsg = json.error || JSON.stringify(json);
    } else {
      errMsg = await res.text().catch(() => '');
    }
    throw new Error(`Submit failed: ${res.status} ${errMsg}`);
  }
  return res.json();
}
