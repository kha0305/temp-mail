import { ArrowLeft, Bookmark, Clock3, MailOpen, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import EmailHtmlFrame from '@/components/email-html-frame';

function SavedTab({
  viewMode,
  savedEmails,
  selectedSavedIds,
  busyState,
  onToggleSavedSelection,
  onToggleSelectAllSaved,
  onDeleteSelectedSaved,
  onViewSavedEmail,
  savedMessageDetail,
  onBackToList,
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6 md:p-8">
        {viewMode === 'list' ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Bookmark className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Email đã lưu</h2>
                    <p className="text-sm text-muted-foreground">Lưu lại mailbox snapshot và những tin nhắn quan trọng để xem sau.</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
                    Tổng {savedEmails.length}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    Đã chọn {selectedSavedIds.length}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedSavedIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onDeleteSelectedSaved}
                    disabled={busyState?.deletingSaved}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> {busyState?.deletingSaved ? 'Đang xóa...' : `Xóa (${selectedSavedIds.length})`}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleSelectAllSaved}
                  disabled={busyState?.deletingSaved || savedEmails.length === 0}
                >
                  {selectedSavedIds.length === savedEmails.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </Button>
              </div>
            </div>

            {savedEmails.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed bg-muted/20 py-16 text-center text-muted-foreground">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                  <Bookmark className="h-8 w-8" />
                </div>
                <p className="text-lg font-semibold text-foreground">Chưa có email nào được lưu</p>
                <p className="mt-2 text-sm">Các email hoặc mailbox snapshot bạn lưu sẽ xuất hiện ở đây.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {savedEmails.map((email) => (
                  <Card
                    key={email.id}
                    className={`cursor-pointer transition-all hover:-translate-y-1 hover:border-primary ${
                      selectedSavedIds.includes(email.id) ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <CardContent className="p-5">
                      <div className="mb-4 flex items-start justify-between">
                        <input
                          type="checkbox"
                          className="mt-1 rounded border-gray-300"
                          checked={selectedSavedIds.includes(email.id)}
                          onChange={(event) => {
                            event.stopPropagation();
                            onToggleSavedSelection(email.id);
                          }}
                        />
                        <div className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                          {new Date(email.saved_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="space-y-3" onClick={() => onViewSavedEmail(email)}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <MailOpen className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold" title={email.subject}>
                              {email.subject || '(No Subject)'}
                            </h3>
                            <p className="truncate text-sm text-muted-foreground">From: {email.from_name || email.from_address}</p>
                          </div>
                        </div>

                        <div className="rounded-2xl bg-muted/40 p-3 text-xs text-muted-foreground">
                          <div className="mb-1 font-medium text-foreground/90">Địa chỉ đã lưu</div>
                          <div className="truncate font-mono">{email.email_address}</div>
                        </div>

                        <div className="flex gap-2">
                          <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
                            Saved
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
                  <h2 className="text-2xl font-bold tracking-tight">Chi tiết Email đã lưu</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Xem lại mailbox snapshot hoặc nội dung email quan trọng bạn đã lưu.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
                  Saved Snapshot
                </Badge>
                {savedMessageDetail?.email_address && (
                  <Badge variant="outline" className="rounded-full">
                    {savedMessageDetail.email_address}
                  </Badge>
                )}
              </div>
            </div>

            {savedMessageDetail && (
              <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="rounded-[1.75rem] border border-border/70 bg-card/60 p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.8)]">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Bookmark className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Đã lưu</p>
                        <h3 className="text-lg font-bold">{savedMessageDetail.subject || '(Không có tiêu đề)'}</h3>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[1.25rem] border border-border/70 bg-background/50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Người gửi</p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {savedMessageDetail.from_name || savedMessageDetail.from_address || 'Unknown sender'}
                        </p>
                        {savedMessageDetail.from_address && (
                          <p className="mt-1 break-all text-xs text-muted-foreground">{savedMessageDetail.from_address}</p>
                        )}
                      </div>

                      <div className="rounded-[1.25rem] border border-border/70 bg-background/50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Người nhận</p>
                        <p className="mt-2 break-all text-sm font-medium text-foreground">{savedMessageDetail.email_address}</p>
                      </div>

                      <div className="rounded-[1.25rem] border border-border/70 bg-background/50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Thời gian lưu</p>
                        <div className="mt-2 flex items-center gap-2 text-sm text-foreground">
                          <Clock3 className="h-4 w-4 text-primary" />
                          {new Date(savedMessageDetail.saved_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-border/70 bg-card/60 p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.8)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tóm tắt nội dung</p>
                    <p className="mt-4 text-sm leading-7 text-muted-foreground">
                      {savedMessageDetail.text?.trim()
                        ? `${savedMessageDetail.text.trim().slice(0, 280)}${savedMessageDetail.text.trim().length > 280 ? '...' : ''}`
                        : 'Email này chủ yếu chứa nội dung HTML. Bản xem trước đầy đủ nằm ở panel bên phải.'}
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/60 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.8)]">
                  <div className="border-b border-border/70 bg-muted/10 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">
                            Saved Preview
                          </Badge>
                          <Badge variant="outline" className="rounded-full">
                            {savedMessageDetail.html ? 'HTML' : 'Text'}
                          </Badge>
                        </div>

                        <h3 className="mt-4 text-2xl font-bold tracking-tight">
                          {savedMessageDetail.subject || '(Không có tiêu đề)'}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Snapshot của email đã lưu được hiển thị lại nguyên vẹn trong khung bên dưới.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    {savedMessageDetail.html ? (
                      <EmailHtmlFrame html={savedMessageDetail.html} title={savedMessageDetail.subject || 'Saved email HTML preview'} />
                    ) : (
                      <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-6">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-foreground/90">
                          {savedMessageDetail.text || 'Email này không có nội dung để hiển thị.'}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SavedTab;
