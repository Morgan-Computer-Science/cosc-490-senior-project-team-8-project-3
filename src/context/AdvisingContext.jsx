import { createContext, useContext, useReducer } from 'react';

const AdvisingContext = createContext(null);

const initialState = {
  step: 0,
  studentInfo: { name: '', netid: '', major: '', year: 'Sophomore' },
  bearCardFile: null,
  bearCardPreview: null,
  uploadedFile: null,
  transcriptId: null,
  parsedTranscript: null,
  uploadResult: null, // full backend response after transcript upload
  courses: [],
  goals: '',
  advisorNotes: '',
  aiSuggestions: [],
  aiLoading: false,
  confirmationId: null,
};

function advisingReducer(state, action) {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'NEXT_STEP':
      return { ...state, step: Math.min(state.step + 1, 4) };
    case 'PREV_STEP':
      return { ...state, step: Math.max(state.step - 1, 0) };
    case 'SET_STUDENT_INFO':
      return { ...state, studentInfo: { ...state.studentInfo, ...action.payload } };
    case 'SET_BEAR_CARD':
      return { ...state, bearCardFile: action.payload.file, bearCardPreview: action.payload.preview };
    case 'CLEAR_BEAR_CARD':
      return { ...state, bearCardFile: null, bearCardPreview: null };
    case 'SET_FILE':
      return { ...state, uploadedFile: action.payload };
    case 'SET_TRANSCRIPT':
      return { ...state, transcriptId: action.payload.id, parsedTranscript: action.payload.parsed };
    case 'SET_UPLOAD_RESULT':
      return { ...state, uploadResult: action.payload };
    case 'ADD_COURSE':
      if (state.courses.includes(action.payload)) return state;
      return { ...state, courses: [...state.courses, action.payload] };
    case 'REMOVE_COURSE':
      return { ...state, courses: state.courses.filter(c => c !== action.payload) };
    case 'SET_GOALS':
      return { ...state, goals: action.payload };
    case 'SET_ADVISOR_NOTES':
      return { ...state, advisorNotes: action.payload };
    case 'SET_AI_SUGGESTIONS':
      return { ...state, aiSuggestions: action.payload, aiLoading: false };
    case 'SET_AI_LOADING':
      return { ...state, aiLoading: action.payload };
    case 'SET_CONFIRMATION':
      return { ...state, confirmationId: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function AdvisingProvider({ children }) {
  const [state, dispatch] = useReducer(advisingReducer, initialState);
  return (
    <AdvisingContext.Provider value={{ state, dispatch }}>
      {children}
    </AdvisingContext.Provider>
  );
}

export function useAdvising() {
  const ctx = useContext(AdvisingContext);
  if (!ctx) throw new Error('useAdvising must be used within AdvisingProvider');
  return ctx;
}
