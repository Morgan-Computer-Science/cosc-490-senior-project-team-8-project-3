import { useState } from 'react';
import { isValidPDF } from '../utils/validators';
import { useAdvising } from '../context/AdvisingContext';

export function useFileUpload() {
  const { dispatch } = useAdvising();
  const [error, setError] = useState(null);

  const handleUpload = async (file) => {
    const validation = isValidPDF(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setError(null);
    dispatch({ type: 'SET_FILE', payload: file });
    dispatch({
      type: 'SET_TRANSCRIPT',
      payload: { id: null, parsed: [] },
    });
    dispatch({ type: 'SET_UPLOAD_RESULT', payload: null });
    dispatch({ type: 'SET_AI_SUGGESTIONS', payload: [] });
    return { stored: true };
  };

  return { handleUpload, uploading: false, error };
}
