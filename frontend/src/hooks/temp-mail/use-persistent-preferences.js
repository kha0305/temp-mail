import { useEffect, useState } from 'react';
import {
  STORAGE_KEYS,
  getStoredJson,
  getStoredValue,
  persistJson,
  persistValue,
} from './storage';

const VALID_TABS = new Set(['current', 'history']);
const normalizeActiveTab = (value) => (VALID_TABS.has(value) ? value : 'current');

function usePersistentPreferences() {
  const [activeTab, setActiveTab] = useState(() => normalizeActiveTab(getStoredValue(STORAGE_KEYS.activeTab, 'current')));
  const [selectedService, setSelectedService] = useState(() =>
    getStoredValue(STORAGE_KEYS.selectedService, 'auto'),
  );
  const [preferredDomains, setPreferredDomains] = useState(() =>
    getStoredJson(STORAGE_KEYS.preferredDomains, {}),
  );

  useEffect(() => {
    persistValue(STORAGE_KEYS.activeTab, normalizeActiveTab(activeTab));
  }, [activeTab]);

  useEffect(() => {
    persistValue(STORAGE_KEYS.selectedService, selectedService);
  }, [selectedService]);

  useEffect(() => {
    persistJson(STORAGE_KEYS.preferredDomains, preferredDomains);
  }, [preferredDomains]);

  return {
    activeTab,
    setActiveTab,
    selectedService,
    setSelectedService,
    preferredDomains,
    setPreferredDomains,
  };
}

export default usePersistentPreferences;
