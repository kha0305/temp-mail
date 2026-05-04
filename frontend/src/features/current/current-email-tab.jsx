import { useDeferredValue, useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Edit,
  Inbox,
  Mail,
  MailOpen,
  Paperclip,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import EmailHtmlFrame from '@/components/email-html-frame';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  formatMessageDateTime,
  formatMessageTimestamp,
  getMessageAttachmentCount,
  getMessageHtmlContent,
  getMessageInitial,
  getMessagePreview,
  getMessageSender,
  getMessageSenderAddress,
  getMessageTextContent,
  isValidMailboxPassword,
} from '@/utils/temp-mail';

const MESSAGE_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'html', label: 'HTML' },
  { id: 'attachments', label: 'Đính kèm' },
];

const formatLastSyncTime = (value) => {
  if (!value) {
    return 'Chưa có';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Chưa có';
  }

  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getSyncMeta = (status) => {
  switch (status) {
    case 'connected':
      return {
        icon: Wifi,
        label: 'Realtime',
        showLiveDot: true,
        badgeClass:
          'rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      };
    case 'connecting':
      return {
        icon: Activity,
        label: 'Đang kết nối',
        showLiveDot: false,
        badgeClass:
          'rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
      };
    case 'polling':
      return {
        icon: WifiOff,
        label: 'Polling 30s',
        showLiveDot: false,
        badgeClass: 'rounded-full border border-border/70 bg-muted/40 text-muted-foreground',
      };
    default:
      return {
        icon: WifiOff,
        label: 'Chưa kết nối',
        showLiveDot: false,
        badgeClass: 'rounded-full border border-border/70 bg-muted/40 text-muted-foreground',
      };
  }
};

const getProviderStatusMeta = (status) => {
  if (status === 'active') {
    return {
      dotClass: 'bg-emerald-500',
      textClass: 'text-emerald-700 dark:text-emerald-300',
      showPulse: true,
    };
  }

  if (String(status || '').startsWith('cooldown')) {
    return {
      dotClass: 'bg-amber-500',
      textClass: 'text-amber-700 dark:text-amber-300',
      showPulse: false,
    };
  }

  return {
    dotClass: 'bg-slate-400',
    textClass: 'text-muted-foreground',
    showPulse: false,
  };
};

const getProviderHealthLabel = (stats) => {
  const successRate = String(stats?.success_rate || '').trim();
  const normalizedStatus = String(stats?.status || '').trim().toLowerCase();

  if (successRate && successRate !== 'N/A') {
    return successRate;
  }

  if (normalizedStatus.startsWith('cooldown')) {
    return 'Cooldown';
  }

  if (normalizedStatus === 'active') {
    return 'Live';
  }

  return 'Unknown';
};

function CurrentEmailTab({
  currentEmail,
  isPersistentMailbox,
  timeLeft,
  formattedTime,
  busyState,
  onAddTime,
  onDeleteCurrentEmail,
  onToggleServiceForm,
  showServiceForm,
  onCreateNewEmail,
  onLoginExistingMailbox,
  selectedService,
  onSelectService,
  selectedDomain,
  onSelectDomain,
  availableDomains,
  loadingDomains,
  serviceStats,
  providerCatalog,
  onRefreshServiceStats,
  messages,
  selectedMessage,
  onSelectMessage,
  onClearSelectedMessage,
  onRefreshMessages,
  refreshing,
  socketStatus,
  lastSyncAt,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [messageFilter, setMessageFilter] = useState('all');
  const [loginAddress, setLoginAddress] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [pendingLoginPrefill, setPendingLoginPrefill] = useState(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [servicePanelTab, setServicePanelTab] = useState('quick');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const copyCurrentEmail = async () => {
    if (!currentEmail?.address) {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentEmail.address);
      toast.success('Đã copy email');
    } catch (error) {
      toast.error('Không thể copy email');
    }
  };
  const mailboxPassword = String(currentEmail?.password || '');
  const hasMailboxPassword = isValidMailboxPassword(mailboxPassword);

  const copyCurrentPassword = async () => {
    if (!hasMailboxPassword) {
      return;
    }

    try {
      await navigator.clipboard.writeText(mailboxPassword);
      toast.success('Đã copy mật khẩu');
    } catch (error) {
      toast.error('Không thể copy mật khẩu');
    }
  };

  const handlePasswordCardClick = async () => {
    if (!hasMailboxPassword) {
      return;
    }

    setIsPasswordVisible((previousValue) => !previousValue);
    await copyCurrentPassword();
  };

  const htmlMessageCount = messages.filter((message) => Boolean(getMessageHtmlContent(message))).length;
  const attachmentMessageCount = messages.filter((message) => getMessageAttachmentCount(message) > 0).length;

  const normalizedQuery = deferredSearchQuery.trim().toLowerCase();
  const filteredMessages = messages.filter((message) => {
    const sender = getMessageSender(message).toLowerCase();
    const senderAddress = getMessageSenderAddress(message).toLowerCase();
    const subject = String(message.subject || '').toLowerCase();
    const preview = getMessagePreview(message).toLowerCase();
    const matchesQuery =
      !normalizedQuery ||
      sender.includes(normalizedQuery) ||
      senderAddress.includes(normalizedQuery) ||
      subject.includes(normalizedQuery) ||
      preview.includes(normalizedQuery);

    const matchesFilter =
      messageFilter === 'all' ||
      (messageFilter === 'html' && Boolean(getMessageHtmlContent(message))) ||
      (messageFilter === 'attachments' && getMessageAttachmentCount(message) > 0);

    return matchesQuery && matchesFilter;
  });

  const selectedMessageHtml = getMessageHtmlContent(selectedMessage);
  const selectedMessageText = getMessageTextContent(selectedMessage);
  const selectedMessageAttachments = Array.isArray(selectedMessage?.attachments) ? selectedMessage.attachments : [];
  const currentProviderLabel = currentEmail?.service_name || currentEmail?.provider || 'Chưa có';
  const syncMeta = getSyncMeta(socketStatus);
  const SyncIcon = syncMeta.icon;
  const lastSyncLabel = formatLastSyncTime(lastSyncAt);
  const quickProviderOptions = [
    { key: 'auto', value: 'auto', label: 'Tự động' },
    ...providerCatalog.map((provider) => ({
      ...provider,
      value: provider.key,
    })),
  ];
  const accountProviderOptions = providerCatalog
    .filter((provider) => provider.supports_login)
    .map((provider) => ({
      ...provider,
      value: provider.key,
    }));
  const providerStatusCards =
    providerCatalog.length > 0
      ? providerCatalog
      : Object.entries(serviceStats).map(([key, value]) => ({
          key,
          label: value.label || key,
        }));
  const mailboxHeadline = currentEmail
    ? 'Sẵn sàng nhận mail'
    : busyState.initializing
      ? 'Đang khởi tạo mailbox'
      : 'Chưa có mailbox';
  const messageFilterCounts = {
    all: messages.length,
    html: htmlMessageCount,
    attachments: attachmentMessageCount,
  };
  const visibleMessageLabel =
    messages.length === 0
      ? 'Hộp thư đang chờ email mới.'
      : filteredMessages.length === messages.length
        ? `${messages.length} email đang sẵn sàng để mở.`
        : `Đang hiển thị ${filteredMessages.length} trên ${messages.length} email.`;
  const selectedProviderMeta = providerCatalog.find((provider) => provider.key === selectedService) || null;
  const selectedProviderSupportsLogin = Boolean(selectedProviderMeta?.supports_login);
  const hasAccountProviders = accountProviderOptions.length > 0;
  const currentMailboxLoginProvider = accountProviderOptions.find(
    (provider) => provider.value === currentEmail?.provider,
  ) || null;
  const canUseCurrentMailboxForLogin =
    Boolean(currentEmail?.address) && hasMailboxPassword && Boolean(currentMailboxLoginProvider);
  const highlightedProviderKey =
    selectedService && selectedService !== 'auto' ? selectedService : currentEmail?.provider || null;
  const providerHealthSummary = providerStatusCards.reduce(
    (summary, provider) => {
      const status = String(serviceStats[provider.key]?.status || 'unknown');

      if (status === 'active') {
        summary.active += 1;
      } else if (status.startsWith('cooldown')) {
        summary.cooldown += 1;
      } else {
        summary.unavailable += 1;
      }

      return summary;
    },
    { active: 0, cooldown: 0, unavailable: 0 }
  );

  useEffect(() => {
    if (pendingLoginPrefill?.provider === selectedService) {
      setLoginAddress(pendingLoginPrefill.address);
      setLoginPassword(pendingLoginPrefill.password);
      setPendingLoginPrefill(null);
      return;
    }

    setLoginAddress('');
    setLoginPassword('');
  }, [selectedService, pendingLoginPrefill]);

  useEffect(() => {
    setIsPasswordVisible(false);
  }, [currentEmail?.id, mailboxPassword]);

  useEffect(() => {
    if (!showServiceForm) {
      return;
    }

    setServicePanelTab('quick');
  }, [showServiceForm]);

  const handleSwitchServicePanelTab = (nextTab) => {
    setServicePanelTab(nextTab);

    if (nextTab === 'account') {
      const fallbackProvider = accountProviderOptions.find((provider) => provider.value === selectedService)?.value
        || accountProviderOptions[0]?.value;

      if (fallbackProvider && fallbackProvider !== selectedService) {
        onSelectService(fallbackProvider);
      }

      return;
    }

    const fallbackProvider = quickProviderOptions.find((provider) => provider.value === selectedService)?.value || 'auto';

    if (fallbackProvider !== selectedService) {
      onSelectService(fallbackProvider);
    }
  };

  const handleServiceDialogOpenChange = (open) => {
    if (open !== showServiceForm) {
      onToggleServiceForm();
    }
  };

  const handleLoginExistingMailbox = async () => {
    if (!selectedProviderSupportsLogin) {
      toast.warning('Provider này chưa hỗ trợ đăng nhập tài khoản');
      return;
    }

    if (!loginAddress.trim() || !loginPassword.trim()) {
      toast.warning('Nhập đầy đủ email và mật khẩu');
      return;
    }

    const mailbox = await onLoginExistingMailbox({
      address: loginAddress,
      password: loginPassword,
      service: selectedService,
    });

    if (mailbox) {
      setLoginPassword('');
    }
  };

  const handlePasteCurrentMailboxCredentials = () => {
    if (!canUseCurrentMailboxForLogin) {
      toast.warning('Mailbox hiện tại không hỗ trợ dán vào form đăng nhập');
      return;
    }

    if (currentMailboxLoginProvider?.value && currentMailboxLoginProvider.value !== selectedService) {
      setPendingLoginPrefill({
        provider: currentMailboxLoginProvider.value,
        address: currentEmail.address,
        password: mailboxPassword,
      });
      onSelectService(currentMailboxLoginProvider.value);
      toast.success('Đã dán email và mật khẩu hiện tại');
      return;
    }

    setLoginAddress(currentEmail.address);
    setLoginPassword(mailboxPassword);
    toast.success('Đã dán email và mật khẩu hiện tại');
  };

  const renderSyncBadge = () => (
    <Badge variant="secondary" className={syncMeta.badgeClass}>
      {syncMeta.showLiveDot ? (
        <span className="relative mr-2 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
      ) : (
        <SyncIcon className="mr-1 h-3.5 w-3.5" />
      )}
      {syncMeta.label}
    </Badge>
  );

  const renderMessageList = () => (
    <div className="flex h-full min-h-0 w-full flex-col border-r border-border/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.02),transparent_28%)]">
      <div className="border-b border-border/70 bg-background/88 px-4 py-3 backdrop-blur md:px-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Inbox className="h-4.5 w-4.5" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">Hộp thư đến</h3>
                <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
                  {messages.length}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{visibleMessageLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px]">
            {renderSyncBadge()}
            <Badge variant="outline" className="rounded-full border-border/60">
              Sync {lastSyncLabel}
            </Badge>
          </div>

          <div className="grid gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Tìm theo người gửi, tiêu đề, nội dung..."
                className="h-10 rounded-2xl border-border/60 bg-background pl-9 shadow-sm"
                disabled={!messages.length}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {MESSAGE_FILTERS.map((filterOption) => (
                <Button
                  key={filterOption.id}
                  type="button"
                  size="sm"
                  variant={messageFilter === filterOption.id ? 'default' : 'outline'}
                  className="h-8 rounded-full px-3"
                  onClick={() => setMessageFilter(filterOption.id)}
                  disabled={!messages.length}
                >
                  {filterOption.label}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${
                      messageFilter === filterOption.id
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {messageFilterCounts[filterOption.id]}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border bg-muted/40">
              <Mail className="h-8 w-8 opacity-50" />
            </div>
            <p className="font-medium text-foreground">Chưa có tin nhắn nào</p>
            <p className="mt-2 max-w-xs text-sm">
              Email mới sẽ tự động xuất hiện ở đây. Bạn có thể bấm làm mới nếu muốn kiểm tra ngay.
            </p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border bg-muted/40">
              <Search className="h-8 w-8 opacity-50" />
            </div>
            <p className="font-medium text-foreground">Không có kết quả phù hợp</p>
            <p className="mt-2 max-w-xs text-sm">Thử đổi bộ lọc hoặc từ khóa tìm kiếm để xem lại danh sách email.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredMessages.map((message) => {
              const isSelected = selectedMessage?.id === message.id;
              const attachmentCount = getMessageAttachmentCount(message);
              const hasHtml = Boolean(getMessageHtmlContent(message));

              return (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => onSelectMessage(message)}
                  className={`group w-full px-4 py-3 text-left transition ${
                    isSelected
                      ? 'bg-primary/[0.08]'
                      : 'bg-transparent hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full transition ${
                        isSelected ? 'bg-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]' : 'bg-muted'
                      }`}
                    />
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold transition ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                      }`}
                    >
                      {getMessageInitial(message)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                              {getMessageSender(message)}
                            </p>
                            <p className="shrink-0 text-[11px] font-medium text-muted-foreground">
                              {formatMessageTimestamp(message.createdAt)}
                            </p>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {getMessageSenderAddress(message)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-6 text-foreground/95">
                          {message.subject || '(Không có tiêu đề)'}
                        </p>
                        {hasHtml && (
                          <Badge variant="secondary" className="h-5 rounded-full bg-muted px-2 text-[10px] text-foreground">
                            HTML
                          </Badge>
                        )}
                        {attachmentCount > 0 && (
                          <span className="inline-flex h-5 items-center rounded-full border border-border/70 bg-background/80 px-2 text-[10px] font-medium text-muted-foreground">
                            <Paperclip className="mr-1 h-3 w-3" />
                            {attachmentCount}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs leading-5 text-muted-foreground">
                        {getMessagePreview(message)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const renderMessageDetail = () => (
    <div className="flex h-full min-h-0 w-full flex-col bg-card/60">
      <div className="border-b bg-card/95 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
                {currentProviderLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {selectedMessageHtml ? 'HTML' : 'Text'}
              </Badge>
              {selectedMessageAttachments.length > 0 && (
                <Badge variant="outline" className="rounded-full">
                  <Paperclip className="mr-1 h-3 w-3" />
                  {selectedMessageAttachments.length} đính kèm
                </Badge>
              )}
            </div>

            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {selectedMessage?.subject || '(Không có tiêu đề)'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {getMessagePreview(selectedMessage)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onClearSelectedMessage} title="Quay lại">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-base font-semibold text-primary">
              {getMessageInitial(selectedMessage)}
            </div>
            <div className="grid flex-1 gap-1 text-sm">
              <p className="font-medium text-foreground">
                {getMessageSender(selectedMessage)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  &lt;{getMessageSenderAddress(selectedMessage)}&gt;
                </span>
              </p>
              <p className="text-muted-foreground">Tới: {currentEmail?.address || 'Email hiện tại'}</p>
              <p className="text-muted-foreground">Nhận lúc: {formatMessageDateTime(selectedMessage?.createdAt)}</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-5">
          <div className="rounded-3xl border bg-background/80 p-5 shadow-sm">
            {selectedMessageHtml ? (
              <EmailHtmlFrame html={selectedMessageHtml} title={selectedMessage?.subject || 'Email HTML preview'} />
            ) : selectedMessageText ? (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-7">{selectedMessageText}</pre>
            ) : (
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Tin nhắn này không có nội dung để hiển thị.
              </div>
            )}
          </div>

          {selectedMessageAttachments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold">Tệp đính kèm</h4>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {selectedMessageAttachments.map((attachment, index) => {
                  const canDownload = Boolean(attachment?.downloadUrl);
                  const sizeKb = attachment?.size ? Math.max(1, Math.round(attachment.size / 1024)) : null;

                  return (
                    <div
                      key={`${attachment?.id || attachment?.filename || 'attachment'}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/20 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {attachment?.filename || `Attachment ${index + 1}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sizeKb ? `${sizeKb} KB` : 'Kích thước không rõ'}
                        </p>
                      </div>

                      {canDownload ? (
                        <a
                          href={attachment.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
                        >
                          Mở
                        </a>
                      ) : (
                        <Badge variant="outline" className="rounded-full whitespace-nowrap">
                          Chưa hỗ trợ tải
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const renderMessageEmptyPreview = () => (
    <div className="hidden h-full min-h-[480px] w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_42%)] p-6 lg:flex">
      <div className="flex h-full min-h-[320px] max-w-md flex-col items-center justify-center rounded-[2rem] border border-border/70 bg-background/65 p-8 text-center text-muted-foreground shadow-[0_24px_60px_-48px_rgba(15,23,42,0.8)]">
        <div className="flex h-16 w-16 items-center justify-center rounded-[1.6rem] border border-border/70 bg-card/70 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        {messages.length > 0 ? (
          <>
            <p className="mt-5 text-lg font-semibold text-foreground">Chọn email để xem</p>
            <p className="mt-2 text-sm leading-7">
              Danh sách bên trái đã có thư. Chọn một email để mở nội dung trong khung này.
            </p>
          </>
        ) : (
          <>
            <p className="mt-5 text-lg font-semibold text-foreground">Hộp thư đang chờ email mới</p>
            <p className="mt-2 text-sm leading-7">
              Khi có thư đến, email sẽ xuất hiện trong danh sách bên trái để bạn mở trực tiếp.
            </p>
          </>
        )}
        <Button
          variant="outline"
          onClick={onRefreshMessages}
          disabled={refreshing || !currentEmail}
          className="mt-6 gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Kiểm tra lại
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden animate-in fade-in-50 duration-500">
      <Card className="shrink-0 overflow-hidden border-border/70 bg-card/80 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.45)]">
        <CardContent className="space-y-4 p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
                  {currentProviderLabel}
                </Badge>
                {renderSyncBadge()}
                <Badge variant="outline" className="rounded-full border-border/60">
                  {currentEmail
                    ? isPersistentMailbox
                      ? 'Mailbox thường trực'
                      : `TTL ${formattedTime}`
                    : 'TTL --:--'}
                </Badge>
                <Badge variant="outline" className="rounded-full border-border/60">
                  Inbox {messages.length}
                </Badge>
                <Badge variant="outline" className="rounded-full border-border/60">
                  Active {providerHealthSummary.active}
                </Badge>
              </div>

              {currentEmail ? (
                <div className="space-y-3">
                  <div className={`grid gap-3 ${hasMailboxPassword ? 'md:grid-cols-2' : ''}`}>
                    <button
                      type="button"
                      className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/[0.04]"
                      onClick={copyCurrentEmail}
                      disabled={busyState.creatingMailbox || busyState.deletingMailbox}
                      title="Bấm để copy email"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Email</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>Bấm để copy</span>
                          <Copy className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      <code className="mt-2 block break-all text-base font-semibold text-foreground md:text-lg">
                        {currentEmail.address}
                      </code>
                    </button>

                    {hasMailboxPassword && (
                      <button
                        type="button"
                        className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/[0.04]"
                        onClick={handlePasswordCardClick}
                        title="Bấm để hiện hoặc ẩn mật khẩu và copy"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Password
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{isPasswordVisible ? 'Bấm để ẩn + copy' : 'Bấm để hiện + copy'}</span>
                            {isPasswordVisible ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </div>
                        </div>
                        <code
                          className={`mt-2 block break-all text-base font-semibold text-foreground transition md:text-lg ${
                            isPasswordVisible ? '' : 'select-none blur-sm'
                          }`}
                        >
                          {mailboxPassword}
                        </code>
                      </button>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {mailboxHeadline}. {visibleMessageLabel}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-foreground">Chưa có mailbox</p>
                  <p className="text-sm text-muted-foreground">
                    Tạo email mới để bắt đầu nhận thư, rồi inbox bên dưới sẽ hoạt động giống giao diện mailbox.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <Button
                variant="outline"
                className="gap-2 rounded-xl"
                onClick={onRefreshMessages}
                disabled={refreshing || !currentEmail}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {!isPersistentMailbox && (
                <Button
                  variant="outline"
                  className="gap-2 rounded-xl"
                  onClick={onAddTime}
                  disabled={busyState.extendingMailbox || !currentEmail}
                >
                  <Clock className="h-4 w-4" />
                  Gia hạn
                </Button>
              )}
              <Button
                variant="outline"
                className="gap-2 rounded-xl"
                onClick={onToggleServiceForm}
                disabled={busyState.creatingMailbox || busyState.deletingMailbox}
              >
                  <Edit className="h-4 w-4" />
                  Tùy chọn
                </Button>
              <Button
                className="gap-2 rounded-xl"
                onClick={onCreateNewEmail}
                disabled={busyState.creatingMailbox || busyState.deletingMailbox}
              >
                {busyState.creatingMailbox ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Email Mới
              </Button>
              <Button
                variant="outline"
                className="gap-2 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onDeleteCurrentEmail}
                disabled={busyState.deletingMailbox || busyState.creatingMailbox || !currentEmail}
              >
                <Trash2 className="h-4 w-4" />
                Xóa
              </Button>
            </div>
          </div>

          <Dialog open={showServiceForm} onOpenChange={handleServiceDialogOpenChange}>
            <DialogContent className="max-h-[86vh] max-w-5xl overflow-hidden rounded-[1.5rem] border-border/70 bg-card/95 p-0 shadow-[0_32px_90px_-48px_rgba(15,23,42,0.95)]">
              <DialogHeader className="border-b border-border/70 px-6 py-5">
                <DialogTitle>Tùy chọn mailbox</DialogTitle>
                <DialogDescription>
                  Chọn provider để tạo mailbox mới hoặc đăng nhập mailbox có sẵn mà không làm vỡ layout chính.
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-[calc(86vh-92px)]">
                <div className="grid gap-4 p-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={servicePanelTab === 'quick' ? 'default' : 'outline'}
                        className="rounded-full px-4"
                        onClick={() => handleSwitchServicePanelTab('quick')}
                      >
                        Tạo mailbox
                      </Button>
                      {hasAccountProviders && (
                        <Button
                          type="button"
                          variant={servicePanelTab === 'account' ? 'default' : 'outline'}
                          className="rounded-full px-4"
                          onClick={() => handleSwitchServicePanelTab('account')}
                        >
                          Đăng nhập mailbox
                        </Button>
                      )}
                    </div>

                    {servicePanelTab === 'account' ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Chọn provider tài khoản:</label>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {accountProviderOptions.map((serviceOption) => (
                              <Button
                                key={serviceOption.key || serviceOption.value}
                                variant={selectedService === serviceOption.value ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => onSelectService(serviceOption.value)}
                                className="capitalize"
                              >
                                {serviceOption.label}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/75 p-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">Đăng nhập mailbox có sẵn</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              Chỉ riêng phần đăng nhập của Mail.tm và Mail.gw được tách ra đây để không lẫn với luồng tạo mailbox mới.
                            </p>
                          </div>

                          <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                            Chọn provider rồi nhập email và mật khẩu để đăng nhập mailbox có sẵn.
                          </div>

                          {selectedProviderSupportsLogin ? (
                            <div className="space-y-3">
                              {canUseCurrentMailboxForLogin && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="w-full justify-start gap-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/15"
                                  onClick={handlePasteCurrentMailboxCredentials}
                                >
                                  <Copy className="h-4 w-4" />
                                  Dán mailbox hiện tại
                                  <span className="truncate text-xs text-primary/80">
                                    {currentEmail?.address}
                                  </span>
                                </Button>
                              )}
                              <Input
                                value={loginAddress}
                                onChange={(event) => setLoginAddress(event.target.value)}
                                placeholder="Nhập email đầy đủ, ví dụ abc@mail.tm"
                                className="h-10 rounded-xl"
                              />
                              <Input
                                type="password"
                                value={loginPassword}
                                onChange={(event) => setLoginPassword(event.target.value)}
                                placeholder="Nhập mật khẩu mailbox"
                                className="h-10 rounded-xl"
                              />
                              <Button
                                variant="outline"
                                className="gap-2 rounded-xl"
                                onClick={handleLoginExistingMailbox}
                                disabled={busyState.loggingInMailbox}
                              >
                                {busyState.loggingInMailbox ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Mail className="h-4 w-4" />
                                )}
                                Đăng nhập mailbox
                              </Button>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Provider `{selectedProviderMeta?.label || selectedService}` hiện chưa hỗ trợ đăng nhập bằng tài khoản.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Chọn nhà cung cấp:</label>
                          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
                            {quickProviderOptions.map((serviceOption) => (
                              <Button
                                key={serviceOption.key || serviceOption.value}
                                variant={selectedService === serviceOption.value ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => onSelectService(serviceOption.value)}
                                className="capitalize"
                              >
                                {serviceOption.label}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Chọn tên miền:</label>
                          <select
                            className="w-full rounded-xl border border-border/70 bg-background px-3 py-2.5 text-sm"
                            value={selectedDomain}
                            onChange={(event) => onSelectDomain(event.target.value)}
                            disabled={loadingDomains}
                          >
                            {loadingDomains ? (
                              <option>Đang tải...</option>
                            ) : availableDomains.length > 0 ? (
                              availableDomains.map((domain) => (
                                <option key={domain} value={domain}>
                                  {domain}
                                </option>
                              ))
                            ) : (
                              <option value="">Tự động chọn</option>
                            )}
                          </select>
                        </div>

                        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/75 p-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">Tạo mailbox mới</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              Tất cả provider tạo mailbox đều nằm ở đây, gồm cả Mail.tm và Mail.gw.
                            </p>
                          </div>

                          <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                            Chọn provider hoặc để <span className="font-medium text-foreground">Tự động</span>, sau đó bấm
                            <span className="mx-1 font-medium text-foreground">Email Mới</span>
                            ở thanh trên để tạo mailbox mới.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-border/70 bg-background/75 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Provider Status
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">Tín hiệu live để chọn provider khi cần.</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl"
                        onClick={onRefreshServiceStats}
                        title="Refresh Status"
                        disabled={busyState.refreshingServices}
                      >
                        <RefreshCw className={`h-4 w-4 ${busyState.refreshingServices ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>

                    <div className="grid gap-2">
                      {providerStatusCards.map((provider) => {
                        const stats = serviceStats[provider.key] || {};
                        const statusMeta = getProviderStatusMeta(stats.status);
                        const isHighlightedProvider = highlightedProviderKey === provider.key;

                        return (
                          <div
                            key={provider.key}
                            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                              isHighlightedProvider
                                ? 'border-primary/40 bg-primary/10'
                                : 'border-border/70 bg-card/60'
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {statusMeta.showPulse ? (
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusMeta.dotClass} opacity-75`} />
                                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusMeta.dotClass}`} />
                                </span>
                              ) : (
                                <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dotClass}`}></span>
                              )}
                              <span className="truncate font-medium text-foreground">{provider.label}</span>
                            </div>
                            <span className={`shrink-0 text-xs font-medium ${statusMeta.textClass}`}>
                              {getProviderHealthLabel(stats)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-1 w-full flex-col overflow-hidden border-border/70 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.35)]">
        <div className="hidden h-full min-h-0 w-full lg:grid lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] xl:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]">
          {renderMessageList()}
          {selectedMessage ? renderMessageDetail() : renderMessageEmptyPreview()}
        </div>

        <div className="min-h-0 h-full w-full lg:hidden">
          {selectedMessage ? renderMessageDetail() : renderMessageList()}
        </div>
      </Card>
    </div>
  );
}

export default CurrentEmailTab;
