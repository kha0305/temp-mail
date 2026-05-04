export const STORAGE_KEYS = {
  activeTab: 'temp-mail.active-tab',
  selectedService: 'temp-mail.selected-service',
  preferredDomains: 'temp-mail.preferred-domains',
};

export const getStoredValue = (key, fallbackValue) => {
  if (typeof window === 'undefined') {
    return fallbackValue;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue || fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
};

export const getStoredJson = (key, fallbackValue) => {
  if (typeof window === 'undefined') {
    return fallbackValue;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
};

export const persistValue = (key, value) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Could not persist ${key}:`, error);
  }
};

export const persistJson = (key, value) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Could not persist ${key}:`, error);
  }
};
