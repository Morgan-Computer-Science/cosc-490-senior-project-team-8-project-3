import { useAdvising } from '../context/AdvisingContext';

export function useFormState() {
  const { state, dispatch } = useAdvising();

  return {
    step: state.step,
    totalSteps: 5,
    goNext: () => dispatch({ type: 'NEXT_STEP' }),
    goBack: () => dispatch({ type: 'PREV_STEP' }),
    goTo: (step) => dispatch({ type: 'SET_STEP', payload: step }),
    isFirst: state.step === 0,
    isLast: state.step === 4,
  };
}
