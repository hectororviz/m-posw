import { useEffect, useState } from 'react';

const EMBEDDED_KEYBOARD_KEY = 'm-posw:embedded-keyboard';

export const getEmbeddedKeyboardPreference = (): boolean => {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(EMBEDDED_KEYBOARD_KEY) : null;
  return stored ? stored === 'true' : true;
};

export const setEmbeddedKeyboardPreference = (value: boolean) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(EMBEDDED_KEYBOARD_KEY, value.toString());
  }
};

export const useEmbeddedKeyboard = () => {
  const [showEmbeddedKeyboard, setShowEmbeddedKeyboard] = useState(() => getEmbeddedKeyboardPreference());

  useEffect(() => {
    setEmbeddedKeyboardPreference(showEmbeddedKeyboard);
  }, [showEmbeddedKeyboard]);

  return {
    showEmbeddedKeyboard,
    setShowEmbeddedKeyboard,
  };
};
