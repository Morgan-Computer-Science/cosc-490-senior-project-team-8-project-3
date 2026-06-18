import { useAdvising } from '../context/AdvisingContext';

export function useTranscriptParse() {
  const { state } = useAdvising();

  return {
    transcriptId: state.transcriptId,
    parsedCourses: state.parsedTranscript || [],
    hasParsed: state.parsedTranscript !== null,
  };
}
