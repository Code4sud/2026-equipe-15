import { createContext, useCallback, useContext, useState } from 'react';
import { autresMetiers, metiers, rapport } from '../data/rapport.js';
import { enregistrerChoix, initialState, lireChoix } from './onboarding.js';

const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
  const [initial] = useState(() => {
    try {
      return { state: lireChoix(window.localStorage, rapport.id, metiers, autresMetiers), error: false };
    } catch {
      return { state: initialState(), error: true };
    }
  });
  const [state, setState] = useState(initial.state);
  const [storageError, setStorageError] = useState(initial.error);
  const update = useCallback((next) => {
    try {
      enregistrerChoix(window.localStorage, rapport.id, next);
      setStorageError(false);
    } catch { setStorageError(true); }
    setState(next);
  }, []);

  return <OnboardingContext.Provider value={{ state, update, storageError }}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('OnboardingProvider manquant');
  return [context.state, context.update];
}

export function useOnboardingStatus() {
  return [useContext(OnboardingContext).storageError];
}
