import { API_BASE, ENDPOINTS } from '../utils/constants';

async function handleJsonResponse(res) {
  if (!res.ok) {
    let errMsg = '';
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const json = await res.json().catch(() => null);
      if (json) errMsg = json.error || JSON.stringify(json);
    } else {
      errMsg = await res.text().catch(() => '');
    }
    throw new Error(`Request failed: ${res.status} ${errMsg}`);
  }
  return res.json();
}

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
  return handleJsonResponse(res);
}

export async function submitManualCourses(formData) {
  const res = await fetch(`${API_BASE}${ENDPOINTS.submitManual}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student: formData.student || {},
      manualCourses: formData.manualCourses || [],
      courses: formData.courses || [],
      goals: formData.goals || '',
      notes: formData.notes || '',
    }),
  });
  return handleJsonResponse(res);
}

export async function extractBearCard(file) {
  const payload = new FormData();
  payload.append('bearCard', file);
  const res = await fetch(`${API_BASE}${ENDPOINTS.extractBearCard}`, {
    method: 'POST',
    body: payload,
  });
  return handleJsonResponse(res);
}

export async function textToSpeech({ text, languageCode = 'en-US', voiceName = '', speakingRate = 1 }) {
  const res = await fetch(`${API_BASE}${ENDPOINTS.textToSpeech}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, languageCode, voiceName, speakingRate }),
  });
  return handleJsonResponse(res);
}

export async function speechToText({ audioBlob, languageCode = 'en-US', saveAudio = false }) {
  const payload = new FormData();
  const extension = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
  payload.append('audio', audioBlob, `voice-prompt.${extension}`);
  payload.append('languageCode', languageCode);
  if (saveAudio) payload.append('saveAudio', 'true');

  const res = await fetch(`${API_BASE}${ENDPOINTS.speechToText}`, {
    method: 'POST',
    body: payload,
  });
  return handleJsonResponse(res);
}

/**
 * Opens an SSE connection to /api/chat and calls callbacks as data arrives.
 * Returns a cleanup function.
 */
export function streamChatMessage({ sessionId, message, context, onText, onDone, onError }) {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}${ENDPOINTS.chat}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message, context }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        onError(json.error || 'Chat request failed');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) onText(data.text);
            if (data.done) onDone();
            if (data.error) onError(data.error);
          } catch {
            // skip malformed SSE line
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') onError(err.message);
    }
  })();

  return () => controller.abort();
}

export async function runAudit({ sessionId, student, validation }) {
  const res = await fetch(`${API_BASE}${ENDPOINTS.audit}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, student, validation }),
  });
  return handleJsonResponse(res);
}

export async function runScheduleAgent({ sessionId, student, validation, goals, requestedCourses }) {
  const res = await fetch(`${API_BASE}${ENDPOINTS.scheduleAgent}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, student, validation, goals, requestedCourses }),
  });
  return handleJsonResponse(res);
}

export async function fetchSessions(netid) {
  const res = await fetch(`${API_BASE}${ENDPOINTS.sessions}/${encodeURIComponent(netid)}`);
  return handleJsonResponse(res);
}
