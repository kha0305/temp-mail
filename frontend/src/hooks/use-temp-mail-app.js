import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { HERO_TITLES } from '@/constants/temp-mail';
import {
  createMailbox,
  deleteHistoryEmails,
  deleteMailbox,
  deleteSavedEmails,
  extendMailbox,
  exportHistoryArchive,
  getDomains,
  getHistoryMessageDetail,
  getHistoryMessages,
  getSavedEmailDetail,
  getServiceStats,
  loginMailbox,
  getMailboxMessageDetail,
  listHistoryEmails,
  listMailboxes,
  listSavedEmails,
  refreshMailboxMessages,
  saveMailboxMessage,
  saveMailboxSnapshot,
} from '@/services/temp-mail-api';
import { dedupeById, formatTimeLeft } from '@/utils/temp-mail';
import useBusyState from '@/hooks/temp-mail/use-busy-state';
import useMailboxExpiration from '@/hooks/temp-mail/use-mailbox-expiration';
import useMailboxSocket from '@/hooks/temp-mail/use-mailbox-socket';
import usePersistentPreferences from '@/hooks/temp-mail/use-persistent-preferences';

const getRandomHeroTitle = () => HERO_TITLES[Math.floor(Math.random() * HERO_TITLES.length)];

function useTempMailApp() {
  const [heroTitle] = useState(getRandomHeroTitle);
  const [currentEmail, setCurrentEmail] = useState(null);
  const [historyEmails, setHistoryEmails] = useState([]);
  const [savedEmails, setSavedEmails] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);
  const [selectedSavedIds, setSelectedSavedIds] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [selectedHistoryEmail, setSelectedHistoryEmail] = useState(null);
  const [historyMessages, setHistoryMessages] = useState([]);
  const [savedMessageDetail, setSavedMessageDetail] = useState(null);
  const [availableDomains, setAvailableDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceStats, setServiceStats] = useState({});
  const [providerCatalog, setProviderCatalog] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const { busyState, setBusy } = useBusyState();
  const {
    activeTab,
    setActiveTab,
    selectedService,
    setSelectedService,
    preferredDomains,
    setPreferredDomains,
  } = usePersistentPreferences();

  const knownMessageIdsRef = useRef(new Set());
  const domainRequestIdRef = useRef(0);
  const initializedRef = useRef(false);

  const resetCurrentMailboxView = () => {
    knownMessageIdsRef.current = new Set();
    setLastSyncAt(null);
    startTransition(() => {
      setMessages([]);
      setSelectedMessage(null);
    });
  };

  const setSelectedDomainForService = (service, domain, rememberPreference = true) => {
    setSelectedDomain(domain);

    if (!rememberPreference || !domain) {
      return;
    }

    setPreferredDomains((previousDomains) => {
      if (previousDomains[service] === domain) {
        return previousDomains;
      }

      return {
        ...previousDomains,
        [service]: domain,
      };
    });
  };

  const applyMessageList = (nextMessages, { notify = false } = {}) => {
    const dedupedMessages = dedupeById(Array.isArray(nextMessages) ? nextMessages : []);
    const previousIds = knownMessageIdsRef.current;
    const freshMessages = dedupedMessages.filter((message) => !previousIds.has(message.id));

    knownMessageIdsRef.current = new Set(dedupedMessages.map((message) => message.id));
    setLastSyncAt(new Date().toISOString());

    startTransition(() => {
      setMessages(dedupedMessages);
    });

    if (selectedMessage && !dedupedMessages.some((message) => message.id === selectedMessage.id)) {
      setSelectedMessage(null);
    }

    if (!notify || freshMessages.length === 0) {
      return;
    }

    const newestMessage = freshMessages[0];

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      new Notification(`New Email: ${newestMessage.subject || '(No Subject)'}`, {
        body: `From: ${newestMessage.from?.address || newestMessage.from?.name || 'Unknown'}`,
        icon: '/logo192.png',
        silent: true,
      });
    }

    toast.success(
      freshMessages.length === 1
        ? 'Bạn có 1 tin nhắn mới'
        : `Bạn có ${freshMessages.length} tin nhắn mới`,
    );
  };

  const loadHistory = async () => {
    setBusy('loadingHistory', true);

    try {
      const response = await listHistoryEmails();
      startTransition(() => {
        setHistoryEmails(dedupeById(response));
      });
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setBusy('loadingHistory', false);
    }
  };

  const loadSavedEmailList = async () => {
    setBusy('loadingSaved', true);

    try {
      const response = await listSavedEmails();
      startTransition(() => {
        setSavedEmails(dedupeById(response));
      });
    } catch (error) {
      console.error('Error loading saved emails:', error);
    } finally {
      setBusy('loadingSaved', false);
    }
  };

  const loadDomainsForService = async (service) => {
    const requestId = domainRequestIdRef.current + 1;
    domainRequestIdRef.current = requestId;
    setLoadingDomains(true);

    try {
      const response = await getDomains(service);

      if (domainRequestIdRef.current !== requestId) {
        return;
      }

      const domains = response.domains || [];
      const preferredDomain = preferredDomains[service];
      const resolvedDomain =
        preferredDomain && domains.includes(preferredDomain) ? preferredDomain : domains[0] || '';

      setAvailableDomains(domains);
      setSelectedDomainForService(service, resolvedDomain, Boolean(resolvedDomain));
    } catch (error) {
      console.error('Error loading domains:', error);

      if (domainRequestIdRef.current === requestId) {
        setAvailableDomains([]);
        setSelectedDomain('');
      }

      toast.error('Không thể tải domains', {
        description: 'Vui lòng thử lại hoặc chọn dịch vụ khác',
      });
    } finally {
      if (domainRequestIdRef.current === requestId) {
        setLoadingDomains(false);
      }
    }
  };

  const loadServiceStatus = async ({ showIndicator = false } = {}) => {
    if (showIndicator) {
      setBusy('refreshingServices', true);
    }

    try {
      const response = await getServiceStats();

      if (response?.stats) {
        setServiceStats(response.stats);
      }

      if (Array.isArray(response?.providers) && response.providers.length > 0) {
        setProviderCatalog(response.providers);
      } else if (response?.stats) {
        setProviderCatalog(
          Object.entries(response.stats).map(([key, value]) => ({
            key,
            label: value.label || key,
          })),
        );
      }
    } catch (error) {
      console.error('Error loading service stats:', error);
    } finally {
      if (showIndicator) {
        setBusy('refreshingServices', false);
      }
    }
  };

  const requestMailboxCreation = async ({
    service = selectedService,
    domain = selectedDomain,
    successTitle = 'Email mới đã được tạo!',
    showSuccessToast = true,
  } = {}) => {
    const payload = { service };

    if (domain) {
      payload.domain = domain;
    }

    const newEmail = await createMailbox(payload);

    resetCurrentMailboxView();
    setCurrentEmail(newEmail);
    setShowServiceForm(false);

    if (showSuccessToast) {
      toast.success(successTitle, {
        description: `${newEmail.address} (${newEmail.service_name || newEmail.provider})`,
      });
    }

    return newEmail;
  };

  const refreshMessages = async (emailId = currentEmail?.id, showToast = true) => {
    if (!emailId) {
      return;
    }

    setRefreshing(true);

    try {
      const response = await refreshMailboxMessages(emailId);
      applyMessageList(response.messages || []);

      if (response.warning) {
        toast.warning(response.warning);
      } else if (showToast) {
        toast.success(`Đã làm mới: ${response.count} tin nhắn`);
      }
    } catch (error) {
      console.error('Error refreshing messages:', error);

      if (error.response?.status === 404) {
        setCurrentEmail(null);
        resetCurrentMailboxView();
      }

      if (showToast) {
        toast.error('Không thể làm mới tin nhắn');
      }
    } finally {
      setRefreshing(false);
    }
  };

  const initializeApp = async () => {
    setBusy('initializing', true);

    try {
      const mailboxes = dedupeById(await listMailboxes());

      if (mailboxes.length > 0) {
        const latestMailbox = mailboxes[0];
        setCurrentEmail(latestMailbox);

        try {
          const messageResponse = await refreshMailboxMessages(latestMailbox.id);
          applyMessageList(messageResponse.messages || []);
        } catch (error) {
          console.error('Error loading initial messages:', error);
        }
      } else {
        const newEmail = await requestMailboxCreation({ showSuccessToast: false });
        await refreshMessages(newEmail.id, false);
      }
    } catch (error) {
      console.error('Error initializing app:', error);

      try {
        const newEmail = await requestMailboxCreation({ showSuccessToast: false });
        await refreshMessages(newEmail.id, false);
      } catch (createError) {
        toast.error('Không thể khởi tạo ứng dụng');
      }
    } finally {
      await Promise.allSettled([loadHistory(), loadServiceStatus()]);
      setBusy('initializing', false);
    }
  };

  const createNewEmail = async () => {
    setBusy('creatingMailbox', true);

    try {
      if (currentEmail?.id) {
        try {
          await deleteMailbox(currentEmail.id);
        } catch (error) {
          console.warn('Could not delete old email before creating new one:', error);
        }
      }

      const newEmail = await requestMailboxCreation();
      await Promise.allSettled([refreshMessages(newEmail.id, false), loadHistory()]);
    } catch (error) {
      toast.error('Không thể tạo email mới', {
        description: error.response?.data?.detail || 'Lỗi không xác định',
      });
    } finally {
      setBusy('creatingMailbox', false);
    }
  };

  const loginExistingMailbox = async ({ address, password, service }) => {
    setBusy('loggingInMailbox', true);

    try {
      const mailbox = await loginMailbox({
        address: String(address || '').trim(),
        password: String(password || '').trim(),
        service,
      });

      resetCurrentMailboxView();
      setCurrentEmail(mailbox);
      setShowServiceForm(false);
      await Promise.allSettled([refreshMessages(mailbox.id, false), loadHistory()]);

      toast.success('Đăng nhập mailbox thành công', {
        description: `${mailbox.address} (${mailbox.service_name || mailbox.provider})`,
      });

      return mailbox;
    } catch (error) {
      toast.error('Không thể đăng nhập mailbox', {
        description: error.response?.data?.detail || 'Lỗi không xác định',
      });
      return null;
    } finally {
      setBusy('loggingInMailbox', false);
    }
  };

  const deleteCurrentEmail = async () => {
    if (!currentEmail) {
      return;
    }

    setBusy('deletingMailbox', true);

    try {
      await deleteMailbox(currentEmail.id);
      setCurrentEmail(null);
      resetCurrentMailboxView();
      toast.success('Email đã được xóa');
      await loadHistory();
    } catch (error) {
      toast.error('Không thể xóa email');
    } finally {
      setBusy('deletingMailbox', false);
    }
  };

  const handleMailboxExpired = useEffectEvent(async () => {
    toast.info('Email đã hết hạn, đang tạo email mới tự động');

    try {
      const newEmail = await requestMailboxCreation({
        successTitle: 'Email mới đã được tạo tự động',
      });

      await Promise.allSettled([loadHistory(), refreshMessages(newEmail.id, false)]);
      return false;
    } catch (error) {
      console.error('Auto-create email error:', error);
      toast.error('Không thể tạo email mới tự động', {
        description: error.response?.data?.detail || 'Lỗi không xác định',
      });
      return true;
    }
  });

  const { timeLeft, resetExpirationGuard } = useMailboxExpiration({
    currentEmail,
    onExpired: handleMailboxExpired,
  });

  const addTime = async () => {
    if (!currentEmail) {
      return;
    }

    setBusy('extendingMailbox', true);

    try {
      const response = await extendMailbox(currentEmail.id);
      resetExpirationGuard();
      setCurrentEmail((previousEmail) => ({
        ...previousEmail,
        expires_at: response.expires_at,
      }));
      toast.success('Đã làm mới thời gian về 10 phút');
    } catch (error) {
      toast.error('Không thể gia hạn thời gian', {
        description: error.response?.data?.detail || 'Lỗi không xác định',
      });
    } finally {
      setBusy('extendingMailbox', false);
    }
  };

  const downloadHistoryArchive = async ({ ids = [], provider = 'all' } = {}) => {
    if (historyEmails.length === 0) {
      toast.warning('Lịch sử trống');
      return;
    }

    setBusy('exportingHistory', true);

    try {
      const { blob, filename } = await exportHistoryArchive({ ids, provider });
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');

      anchor.href = downloadUrl;
      anchor.download = filename || 'tempmail-history-export.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('Đã xuất file lịch sử');
    } catch (error) {
      toast.error('Không thể xuất file lịch sử', {
        description: error.response?.data?.detail || 'Lỗi không xác định',
      });
    } finally {
      setBusy('exportingHistory', false);
    }
  };

  const saveCurrentEmail = async () => {
    if (!currentEmail) {
      toast.error('Không có email để lưu');
      return;
    }

    setBusy('savingMailbox', true);

    try {
      const snapshotMessageId = `mailbox:${currentEmail.id}`;
      const alreadySaved = savedEmails.some((email) => email.message_id === snapshotMessageId);

      if (alreadySaved) {
        toast.warning('Email này đã được lưu rồi!');
        return;
      }

      const response = await saveMailboxSnapshot(currentEmail.id);

      setSavedEmails((previousSavedEmails) =>
        previousSavedEmails.some((email) => email.id === response.id)
          ? previousSavedEmails
          : [response, ...previousSavedEmails],
      );

      toast.success('Đã lưu email thành công');
    } catch (error) {
      toast.error('Không thể lưu email', {
        description: error.response?.data?.detail || 'Lỗi không xác định',
      });
    } finally {
      setBusy('savingMailbox', false);
    }
  };

  const selectMessage = async (message) => {
    if (!currentEmail) {
      return;
    }

    try {
      const response = await getMailboxMessageDetail(currentEmail.id, message.id);
      setSelectedMessage(response);
    } catch (error) {
      toast.error('Không thể tải chi tiết tin nhắn');
    }
  };

  const saveCurrentMessage = async () => {
    if (!currentEmail || !selectedMessage) {
      toast.warning('Không có email nào được chọn');
      return;
    }

    setBusy('savingMessage', true);

    try {
      const response = await saveMailboxMessage(currentEmail.id, selectedMessage.id);

      if (response.status === 'already_saved') {
        toast.info('Email đã được lưu trước đó');
      } else {
        toast.success('Email đã được lưu thành công');
        await loadSavedEmailList();
      }
    } catch (error) {
      toast.error('Không thể lưu email', {
        description: error.response?.data?.detail || 'Lỗi không xác định',
      });
    } finally {
      setBusy('savingMessage', false);
    }
  };

  const viewHistoryEmail = async (email) => {
    try {
      const response = await getHistoryMessages(email.id);
      setHistoryMessages(response.messages || []);
      setSelectedHistoryEmail(email);
      setSelectedMessage(null);
      setViewMode('detail');
      setActiveTab('history');
    } catch (error) {
      toast.error('Không thể tải tin nhắn từ lịch sử');
    }
  };

  const selectHistoryMessage = async (message) => {
    if (!selectedHistoryEmail) {
      return;
    }

    try {
      const response = await getHistoryMessageDetail(selectedHistoryEmail.id, message.id);
      setSelectedMessage(response);
    } catch (error) {
      toast.error('Không thể tải chi tiết tin nhắn');
    }
  };

  const deleteSelectedHistory = async () => {
    if (selectedHistoryIds.length === 0) {
      toast.warning('Chưa chọn email nào');
      return;
    }

    setBusy('deletingHistory', true);

    try {
      await deleteHistoryEmails(selectedHistoryIds);
      toast.success(`Đã xóa ${selectedHistoryIds.length} email`);
      setSelectedHistoryIds([]);
      await loadHistory();
    } catch (error) {
      toast.error('Không thể xóa email đã chọn');
    } finally {
      setBusy('deletingHistory', false);
    }
  };

  const deleteAllHistory = async () => {
    if (historyEmails.length === 0) {
      toast.warning('Lịch sử trống');
      return;
    }

    setBusy('deletingHistory', true);

    try {
      await deleteHistoryEmails(null);
      toast.success('Đã xóa tất cả lịch sử');
      setSelectedHistoryIds([]);
      setHistoryEmails([]);
    } catch (error) {
      toast.error('Không thể xóa tất cả lịch sử');
    } finally {
      setBusy('deletingHistory', false);
    }
  };

  const viewSavedEmail = async (savedEmail) => {
    try {
      const response = await getSavedEmailDetail(savedEmail.id);
      setSavedMessageDetail(response);
      setViewMode('detail');
      setActiveTab('saved');
    } catch (error) {
      toast.error('Không thể tải email đã lưu');
    }
  };

  const deleteSelectedSaved = async () => {
    if (selectedSavedIds.length === 0) {
      toast.warning('Chưa chọn email nào');
      return;
    }

    setBusy('deletingSaved', true);

    try {
      await deleteSavedEmails(selectedSavedIds);
      toast.success(`Đã xóa ${selectedSavedIds.length} email`);
      setSelectedSavedIds([]);
      await loadSavedEmailList();
    } catch (error) {
      toast.error('Không thể xóa email đã chọn');
    } finally {
      setBusy('deletingSaved', false);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Trình duyệt không hỗ trợ thông báo');
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      setNotificationsEnabled(true);
      toast.success('Đã bật thông báo trình duyệt');
      new Notification('Temp Mail', {
        body: 'Thông báo đã được kích hoạt',
        silent: true,
      });
    } else {
      setNotificationsEnabled(false);
      toast.warning('Bạn đã từ chối quyền thông báo');
    }
  };

  const handleSocketMessages = useEffectEvent((newMessages) => {
    applyMessageList(newMessages, { notify: true });
    setRefreshing(false);
  });

  const handleSocketError = useEffectEvent((payload) => {
    if (payload?.message) {
      toast.warning(payload.message);
    }
  });

  const { socketStatus } = useMailboxSocket({
    currentEmail,
    onMessages: handleSocketMessages,
    onSocketError: handleSocketError,
  });

  const pollCurrentMailbox = useEffectEvent(() => {
    if (currentEmail?.id) {
      refreshMessages(currentEmail.id, false);
    }
  });

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  useEffect(() => {
    loadDomainsForService(selectedService);
  }, [selectedService]);

  useEffect(() => {
    loadServiceStatus();
    const intervalId = setInterval(() => {
      loadServiceStatus();
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    initializeApp();
  }, []);

  useEffect(() => {
    if (!currentEmail?.id || currentEmail.isHistory || socketStatus === 'connected') {
      return;
    }

    const intervalId = setInterval(() => {
      pollCurrentMailbox();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [currentEmail?.id, currentEmail?.isHistory, socketStatus]);

  useEffect(() => {
    setViewMode('list');
    setSelectedMessage(null);
    setSavedMessageDetail(null);
    setHistoryMessages([]);
    setSelectedHistoryEmail(null);
  }, [activeTab]);

  const isPersistentMailbox = Boolean(currentEmail?.persistent || (currentEmail && !currentEmail.expires_at));

  return {
    activeTab,
    setActiveTab,
    notificationsEnabled,
    requestNotificationPermission,
    currentTab: {
      heroTitle,
      currentEmail,
      isPersistentMailbox,
      timeLeft,
      formattedTime: isPersistentMailbox ? 'Không giới hạn' : formatTimeLeft(timeLeft),
      busyState,
      onAddTime: addTime,
      onDeleteCurrentEmail: deleteCurrentEmail,
      onToggleServiceForm: () => setShowServiceForm((previous) => !previous),
      showServiceForm,
      onCreateNewEmail: createNewEmail,
      onLoginExistingMailbox: loginExistingMailbox,
      selectedService,
      onSelectService: setSelectedService,
      selectedDomain,
      onSelectDomain: (domain) => setSelectedDomainForService(selectedService, domain),
      availableDomains,
      loadingDomains,
      serviceStats,
      providerCatalog,
      onRefreshServiceStats: () => loadServiceStatus({ showIndicator: true }),
      messages,
      selectedMessage,
      onSelectMessage: selectMessage,
      onClearSelectedMessage: () => setSelectedMessage(null),
      onRefreshMessages: () => refreshMessages(currentEmail?.id, true),
      refreshing,
      socketStatus,
      lastSyncAt,
    },
    historyTab: {
      viewMode,
      historyEmails,
      selectedHistoryIds,
      busyState,
      onToggleHistorySelection: (emailId) =>
        setSelectedHistoryIds((previousIds) =>
          previousIds.includes(emailId)
            ? previousIds.filter((id) => id !== emailId)
            : [...previousIds, emailId],
        ),
      onToggleSelectAll: (targetIds = historyEmails.map((email) => email.id)) =>
        setSelectedHistoryIds((previousIds) => {
          const normalizedTargetIds = Array.from(new Set(targetIds.map((id) => String(id))));
          const allSelected =
            normalizedTargetIds.length > 0 &&
            normalizedTargetIds.every((id) => previousIds.some((selectedId) => String(selectedId) === id));

          if (allSelected) {
            return previousIds.filter((selectedId) => !normalizedTargetIds.includes(String(selectedId)));
          }

          return Array.from(new Set([...previousIds, ...targetIds]));
        }),
      onDeleteSelectedHistory: deleteSelectedHistory,
      onDeleteAllHistory: deleteAllHistory,
      onExportHistory: downloadHistoryArchive,
      onViewHistoryEmail: viewHistoryEmail,
      selectedHistoryEmail,
      historyMessages,
      selectedMessage,
      onSelectHistoryMessage: selectHistoryMessage,
      onBackToList: () => {
        setViewMode('list');
        setSelectedMessage(null);
      },
    },
    savedTab: {
      viewMode,
      savedEmails,
      selectedSavedIds,
      busyState,
      onToggleSavedSelection: (emailId) =>
        setSelectedSavedIds((previousIds) =>
          previousIds.includes(emailId)
            ? previousIds.filter((id) => id !== emailId)
            : [...previousIds, emailId],
        ),
      onToggleSelectAllSaved: () =>
        setSelectedSavedIds((previousIds) =>
          previousIds.length === savedEmails.length ? [] : savedEmails.map((email) => email.id),
        ),
      onDeleteSelectedSaved: deleteSelectedSaved,
      onViewSavedEmail: viewSavedEmail,
      savedMessageDetail,
      onBackToList: () => setViewMode('list'),
    },
  };
}

export default useTempMailApp;
