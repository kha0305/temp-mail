import { useEffect, useState } from 'react';
import { ArrowLeft, Clock3, Download, History, MailOpen, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import EmailHtmlFrame from '@/components/email-html-frame';
import { ScrollArea } from '@/components/ui/scroll-area';

const getHistoryServiceKey = (email) => String(email?.provider || email?.service || 'unknown');
const getHistoryServiceLabel = (email) =>
  String(email?.service_name || email?.service || email?.provider || 'Unknown');

function HistoryTab({
  viewMode,
  historyEmails,
  selectedHistoryIds,
  busyState,
  onToggleHistorySelection,
  onToggleSelectAll,
  onDeleteSelectedHistory,
  onDeleteAllHistory,
  onExportHistory,
  onViewHistoryEmail,
  selectedHistoryEmail,
  historyMessages,
  selectedMessage,
  onSelectHistoryMessage,
  onBackToList,
}) {
  const [serviceFilter, setServiceFilter] = useState('all');

  useEffect(() => {
    if (serviceFilter === 'all') {
      return;
    }

    const hasSelectedService = historyEmails.some((email) => getHistoryServiceKey(email) === serviceFilter);
    if (!hasSelectedService) {
      setServiceFilter('all');
    }
  }, [historyEmails, serviceFilter]);

  const serviceMap = historyEmails.reduce((groups, email) => {
    const serviceKey = getHistoryServiceKey(email);

    if (!groups.has(serviceKey)) {
      groups.set(serviceKey, {
        key: serviceKey,
        label: getHistoryServiceLabel(email),
        count: 0,
      });
    }

    groups.get(serviceKey).count += 1;
    return groups;
  }, new Map());

  const serviceOptions = [
    { key: 'all', label: 'Tất cả', count: historyEmails.length },
    ...Array.from(serviceMap.values()).sort((left, right) => left.label.localeCompare(right.label, 'vi')),
  ];

  const filteredHistoryEmails = historyEmails
    .filter((email) => serviceFilter === 'all' || getHistoryServiceKey(email) === serviceFilter)
    .sort((left, right) => {
      if (serviceFilter === 'all') {
        const serviceCompare = getHistoryServiceLabel(left).localeCompare(getHistoryServiceLabel(right), 'vi');
        if (serviceCompare !== 0) {
          return serviceCompare;
        }
      }

      return (
        new Date(right.expired_at || right.created_at || 0).getTime() -
        new Date(left.expired_at || left.created_at || 0).getTime()
      );
    });

  const selectedHistoryIdSet = new Set(selectedHistoryIds.map((id) => String(id)));
  const filteredHistoryIds = filteredHistoryEmails.map((email) => email.id);
  const areAllFilteredSelected =
    filteredHistoryIds.length > 0 && filteredHistoryIds.every((id) => selectedHistoryIdSet.has(String(id)));

  const handleExportHistory = () =>
    onExportHistory({
      ids: selectedHistoryIds,
      provider: selectedHistoryIds.length > 0 ? 'all' : serviceFilter,
    });

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6 md:p-8">
        {viewMode === 'list' ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Lịch sử email</h2>
                    <p className="text-sm text-muted-foreground">
                      Lưu toàn bộ mailbox trong 24 giờ, lọc theo từng dịch vụ và xuất file lưu trữ khi cần.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
                    Tổng {historyEmails.length}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    Đang xem {filteredHistoryEmails.length}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    Đã chọn {selectedHistoryIds.length}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportHistory}
                  disabled={busyState?.exportingHistory || filteredHistoryEmails.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {busyState?.exportingHistory ? 'Đang xuất...' : 'Xuất file'}
                </Button>
                {selectedHistoryIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onDeleteSelectedHistory}
                    disabled={busyState?.deletingHistory}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> {busyState?.deletingHistory ? 'Đang xóa...' : `Xóa (${selectedHistoryIds.length})`}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDeleteAllHistory}
                  disabled={busyState?.deletingHistory || historyEmails.length === 0}
                >
                  {busyState?.deletingHistory ? 'Đang xử lý...' : 'Xóa tất cả'}
                </Button>
              </div>
            </div>

            {historyEmails.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {serviceOptions.map((option) => (
                  <Button
                    key={option.key}
                    type="button"
                    size="sm"
                    variant={serviceFilter === option.key ? 'default' : 'outline'}
                    className="rounded-full px-3.5"
                    onClick={() => setServiceFilter(option.key)}
                  >
                    {option.label}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${
                        serviceFilter === option.key
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {option.count}
                    </span>
                  </Button>
                ))}
              </div>
            )}

            {historyEmails.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed bg-muted/20 py-16 text-center text-muted-foreground">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                  <History className="h-8 w-8" />
                </div>
                <p className="text-lg font-semibold text-foreground">Chưa có lịch sử email nào</p>
                <p className="mt-2 text-sm">Mailbox đã đóng trong vòng 24 giờ sẽ xuất hiện ở đây để bạn xem lại hoặc xuất archive.</p>
              </div>
            ) : filteredHistoryEmails.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed bg-muted/20 py-16 text-center text-muted-foreground">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                  <History className="h-8 w-8" />
                </div>
                <p className="text-lg font-semibold text-foreground">Không có mailbox cho dịch vụ này</p>
                <p className="mt-2 text-sm">Đổi bộ lọc để xem lại các mailbox đã lưu của dịch vụ khác.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/50">
                <div className="hidden grid-cols-12 gap-4 border-b bg-muted/30 px-4 py-4 text-sm font-semibold md:grid">
                  <div className="col-span-1 flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={areAllFilteredSelected}
                      onChange={() => onToggleSelectAll(filteredHistoryIds)}
                    />
                  </div>
                  <div className="col-span-5">Email</div>
                  <div className="col-span-2">Service</div>
                  <div className="col-span-2">Tin nhắn</div>
                  <div className="col-span-2 text-right">Lưu đến</div>
                </div>

                <div className="divide-y">
                  {filteredHistoryEmails.map((email) => (
                    <div key={email.id} className="grid gap-3 px-4 py-4 text-sm transition-colors hover:bg-muted/20 md:grid-cols-12 md:items-center">
                      <div className="md:col-span-1 md:flex md:items-center md:justify-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedHistoryIdSet.has(String(email.id))}
                          onChange={() => onToggleHistorySelection(email.id)}
                        />
                      </div>
                      <div className="min-w-0 cursor-pointer font-mono text-primary hover:underline md:col-span-5" onClick={() => onViewHistoryEmail(email)}>
                        {email.address}
                      </div>
                      <div className="text-xs font-semibold text-muted-foreground md:col-span-2">
                        {getHistoryServiceLabel(email)}
                      </div>
                      <div className="text-muted-foreground md:col-span-2">{email.message_count || 0} tin nhắn</div>
                      <div className="text-xs text-muted-foreground md:col-span-2 md:text-right">
                        {new Date(email.expired_at || email.created_at).toLocaleString('vi-VN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <Button variant="outline" size="sm" onClick={onBackToList} title="Quay lại">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
                </Button>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{selectedHistoryEmail?.address}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Lịch sử tin nhắn của mailbox đã hết hạn.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
                  {historyMessages.length} tin nhắn
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {selectedHistoryEmail?.service || selectedHistoryEmail?.provider || 'Archive'}
                </Badge>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/60 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.8)]">
                <div className="border-b border-border/70 bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">Danh sách tin nhắn</p>
                      <p className="mt-1 text-xs text-muted-foreground">Chọn một email để xem lại nội dung đã lưu trong history.</p>
                    </div>
                    <div className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {historyMessages.length} items
                    </div>
                  </div>
                </div>

                <ScrollArea className="h-[680px]">
                  {historyMessages.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">Không có tin nhắn nào</div>
                  ) : (
                    <div className="divide-y">
                      {historyMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`cursor-pointer px-4 py-4 transition-colors hover:bg-muted/40 ${
                            selectedMessage?.id === message.id ? 'bg-primary/10' : ''
                          }`}
                          onClick={() => onSelectHistoryMessage(message)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-medium">{message.from}</div>
                              <div className="mt-1 truncate text-xs text-muted-foreground">
                                {message.subject || '(Không có tiêu đề)'}
                              </div>
                            </div>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {message.createdAt
                                ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/60 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.8)]">
                {selectedMessage ? (
                  <div className="flex min-h-[680px] flex-col">
                    <div className="border-b border-border/70 bg-muted/10 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
                              Archive Preview
                            </Badge>
                            <Badge variant="outline" className="rounded-full">
                              {selectedMessage.html?.length > 0 ? 'HTML' : 'Text'}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                              <MailOpen className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold">{selectedMessage.subject || '(Không có tiêu đề)'}</h3>
                              <p className="text-sm text-muted-foreground">{selectedMessage.from}</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[1.25rem] border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock3 className="h-4 w-4 text-primary" />
                            {selectedMessage.createdAt
                              ? new Date(selectedMessage.createdAt).toLocaleString()
                              : 'Không rõ thời gian'}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 rounded-[1.5rem] border border-border/70 bg-background/40 p-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Người gửi</p>
                          <p className="mt-2 text-sm font-medium text-foreground">{selectedMessage.from || 'Unknown sender'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nguồn lưu</p>
                          <p className="mt-2 text-sm font-medium text-foreground">{selectedHistoryEmail?.address}</p>
                        </div>
                      </div>
                    </div>

                    <ScrollArea className="flex-1">
                      <div className="space-y-5 p-5">
                        {selectedMessage.html?.length > 0 ? (
                          <EmailHtmlFrame html={selectedMessage.html[0]} title={selectedMessage.subject || 'History email HTML preview'} />
                        ) : (
                          <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-6">
                            <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-foreground/90">
                              {selectedMessage.text || 'Tin nhắn này không có nội dung văn bản.'}
                            </pre>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="flex min-h-[680px] flex-1 items-center justify-center p-8 text-center text-muted-foreground">
                    <div className="flex flex-col items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <MailOpen className="h-5 w-5" />
                      </div>
                      <p className="mt-4 text-lg font-semibold text-foreground">Chọn tin nhắn để xem</p>
                      <p className="mt-2 max-w-sm text-sm">
                        Danh sách bên trái chứa toàn bộ email trong history. Chọn một mục để mở bản xem trước rõ hơn.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default HistoryTab;
