import { useState } from 'react';

export const DEFAULT_BUSY_STATE = {
  initializing: false,
  creatingMailbox: false,
  loggingInMailbox: false,
  deletingMailbox: false,
  extendingMailbox: false,
  savingMailbox: false,
  savingMessage: false,
  deletingHistory: false,
  deletingSaved: false,
  loadingHistory: false,
  loadingSaved: false,
  refreshingServices: false,
  exportingHistory: false,
};

function useBusyState() {
  const [busyState, setBusyState] = useState(DEFAULT_BUSY_STATE);

  const setBusy = (key, value) => {
    setBusyState((previousState) => {
      if (previousState[key] === value) {
        return previousState;
      }

      return {
        ...previousState,
        [key]: value,
      };
    });
  };

  return {
    busyState,
    setBusy,
  };
}

export default useBusyState;
