import { useEffect, useState } from 'react';
import { Bell, BellOff, Copy, Eye, EyeOff, History, Inbox, Mail } from 'lucide-react';
import { ThemeProvider } from 'next-themes';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import ThemeToggle from '@/features/app/theme-toggle';
import CurrentEmailTab from '@/features/current/current-email-tab';
import HistoryTab from '@/features/history/history-tab';
import useTempMailApp from '@/hooks/use-temp-mail-app';
import { isValidMailboxPassword } from '@/utils/temp-mail';

function App() {
  const {
    activeTab,
    setActiveTab,
    notificationsEnabled,
    requestNotificationPermission,
    currentTab,
    historyTab,
  } = useTempMailApp();

  const currentAddress = currentTab.currentEmail?.address || 'Chưa có mailbox';
  const currentProvider = currentTab.currentEmail?.service_name || currentTab.currentEmail?.provider || 'Tự động';
  const currentPassword = String(currentTab.currentEmail?.password || '');
  const hasCurrentPassword = isValidMailboxPassword(currentPassword);
  const isCurrentMailboxPersistent = Boolean(currentTab.isPersistentMailbox);
  const [isSidebarPasswordVisible, setIsSidebarPasswordVisible] = useState(false);
  const topbarTitle = activeTab === 'current' ? currentAddress : 'Lịch sử mailbox';
  const topbarSubtitle =
    activeTab === 'current'
      ? currentTab.currentEmail
        ? isCurrentMailboxPersistent
          ? `${currentTab.messages.length} email, mailbox thường trực`
          : `${currentTab.messages.length} email, TTL ${currentTab.formattedTime}`
        : 'Tạo mailbox mới để bắt đầu nhận email'
      : 'Lưu toàn bộ mailbox trong 24 giờ để xem lại hoặc xuất file';

  useEffect(() => {
    setIsSidebarPasswordVisible(false);
  }, [currentAddress, currentPassword]);

  const copyValue = async (value, label) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Đã copy ${label}`);
    } catch (error) {
      toast.error(`Không thể copy ${label}`);
    }
  };

  const handleCopyCurrentAddress = () => copyValue(currentTab.currentEmail?.address, 'email');

  const handleSidebarPasswordClick = async () => {
    if (!hasCurrentPassword) {
      return;
    }

    setIsSidebarPasswordVisible((previousValue) => !previousValue);
    await copyValue(currentPassword, 'mật khẩu');
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-screen overflow-hidden bg-background text-foreground">
        <Toaster position="top-right" expand={true} richColors />

        <div className="flex h-screen overflow-hidden">
          <aside className="hidden h-screen w-[260px] shrink-0 overflow-hidden border-r border-border/70 bg-card/55 lg:flex lg:flex-col">
            <div className="border-b border-border/70 px-5 py-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">TempMail</p>
                  <p className="text-xs text-muted-foreground">Disposable inbox</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 px-4 py-5">
              <TabsList className="flex h-auto w-full flex-col items-stretch justify-start gap-1 rounded-none border-0 bg-transparent p-0 shadow-none">
                <TabsTrigger value="current" className="justify-start gap-3 rounded-xl px-4 py-3">
                  <Inbox className="h-4 w-4" /> Hộp thư
                </TabsTrigger>
                <TabsTrigger value="history" className="justify-start gap-3 rounded-xl px-4 py-3">
                  <History className="h-4 w-4" /> Lịch sử
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="mt-auto space-y-4 border-t border-border/70 px-5 py-5">
              <div className="space-y-2 rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Mailbox</p>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-primary/5"
                  onClick={handleCopyCurrentAddress}
                  disabled={!currentTab.currentEmail}
                  title={currentTab.currentEmail ? 'Bấm để copy email' : undefined}
                >
                  <p className="truncate text-sm font-medium text-foreground">{currentAddress}</p>
                  {currentTab.currentEmail && <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </button>
                {hasCurrentPassword && (
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-primary/5"
                    onClick={handleSidebarPasswordClick}
                    title="Bấm để hiện hoặc ẩn mật khẩu và copy"
                  >
                    <p className="min-w-0 truncate text-xs text-muted-foreground">
                      <span className="mr-1 text-muted-foreground/80">Pass:</span>
                      <span
                        className={`inline-block max-w-full truncate font-medium text-foreground transition ${
                          isSidebarPasswordVisible ? '' : 'select-none blur-sm'
                        }`}
                      >
                        {currentPassword}
                      </span>
                    </p>
                    {isSidebarPasswordVisible ? (
                      <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full">
                    {currentProvider}
                  </Badge>
                  {currentTab.currentEmail && (
                    <Badge variant="outline" className="rounded-full">
                      {isCurrentMailboxPersistent ? 'Persistent' : `TTL ${currentTab.formattedTime}`}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/80 p-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  onClick={requestNotificationPermission}
                  title={notificationsEnabled ? 'Thông báo đang bật' : 'Bật thông báo'}
                >
                  {notificationsEnabled ? (
                    <Bell className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <BellOff className="h-5 w-5" />
                  )}
                </Button>
                <ThemeToggle />
              </div>
            </div>
          </aside>

          <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(15,23,42,0.03),transparent_20%)]">
            <header className="border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur md:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary md:flex">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      {activeTab === 'current' && currentTab.currentEmail ? (
                        <button
                          type="button"
                          className="flex min-w-0 max-w-full items-center gap-2 rounded-lg text-left transition hover:text-primary"
                          onClick={handleCopyCurrentAddress}
                          title="Bấm để copy email"
                        >
                          <p className="truncate text-base font-semibold text-foreground">{topbarTitle}</p>
                          <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </button>
                      ) : (
                        <p className="truncate text-base font-semibold text-foreground">{topbarTitle}</p>
                      )}
                      <p className="truncate text-sm text-muted-foreground">{topbarSubtitle}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="lg:hidden">
                    <TabsList className="grid h-auto w-full min-w-[180px] grid-cols-2 rounded-xl border border-border/70 bg-card/70 p-1 shadow-none">
                      <TabsTrigger value="current" className="gap-2 rounded-lg px-3 py-2">
                        <Inbox className="h-4 w-4" />
                      </TabsTrigger>
                      <TabsTrigger value="history" className="gap-2 rounded-lg px-3 py-2">
                        <History className="h-4 w-4" />
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl lg:hidden"
                    onClick={requestNotificationPermission}
                    title={notificationsEnabled ? 'Thông báo đang bật' : 'Bật thông báo'}
                  >
                    {notificationsEnabled ? (
                      <Bell className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <BellOff className="h-5 w-5" />
                    )}
                  </Button>
                  <div className="lg:hidden">
                    <ThemeToggle />
                  </div>
                </div>
              </div>
            </header>

            <div className="flex-1 min-h-0 overflow-hidden p-4 md:p-6">
              <TabsContent value="current" className="mt-0 h-full min-h-0 w-full overflow-hidden">
                <CurrentEmailTab {...currentTab} />
              </TabsContent>

              <TabsContent value="history" className="mt-0 h-full min-h-0 w-full overflow-auto animate-in fade-in-50 duration-500">
                <HistoryTab {...historyTab} />
              </TabsContent>
            </div>
          </main>
        </div>
      </Tabs>
    </ThemeProvider>
  );
}

export default App;
