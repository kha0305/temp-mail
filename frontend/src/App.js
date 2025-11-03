import { useState, useEffect } from 'react';
import '@/App.css';
import axios from 'axios';
import { ThemeProvider } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { 
  Mail, Plus, Copy, Trash2, RefreshCw, Sun, Moon, 
  Inbox, Clock, User, ChevronRight, CheckCircle 
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function ThemeToggle() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="theme-toggle"
      data-testid="theme-toggle-btn"
    >
      {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </Button>
  );
}

function App() {
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadEmails();
  }, []);

  useEffect(() => {
    if (selectedEmail?.id && autoRefresh) {
      const interval = setInterval(() => {
        // Double-check the ID is still valid before refreshing
        if (selectedEmail?.id) {
          refreshMessages(selectedEmail.id, false);
        }
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedEmail?.id, autoRefresh]);

  const loadEmails = async () => {
    try {
      const response = await axios.get(`${API}/emails`);
      const loadedEmails = response.data;
      setEmails(loadedEmails);
      
      // If an email is selected, sync it with the loaded data
      if (selectedEmail?.id) {
        const updatedEmail = loadedEmails.find(e => e.id === selectedEmail.id);
        if (updatedEmail) {
          setSelectedEmail(updatedEmail);
        } else {
          // Email was deleted, clear selection
          setSelectedEmail(null);
          setMessages([]);
          setSelectedMessage(null);
        }
      }
    } catch (error) {
      console.error('Error loading emails:', error);
    }
  };

  const createEmail = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/emails/create`, {});
      toast.success('Email tạo thành công!', {
        description: response.data.address
      });
      await loadEmails();
      const newEmail = response.data;
      setSelectedEmail(newEmail);
      await refreshMessages(newEmail.id);
    } catch (error) {
      toast.error('Không thể tạo email', {
        description: error.response?.data?.detail || 'Lỗi không xác định'
      });
    } finally {
      setLoading(false);
    }
  };

  const selectEmail = async (email) => {
    setSelectedEmail(email);
    setSelectedMessage(null);
    await refreshMessages(email.id);
  };

  const refreshMessages = async (emailId, showToast = true) => {
    // Guard against undefined or empty email IDs
    if (!emailId || emailId.trim() === '') {
      console.warn('Attempted to refresh messages with invalid email ID:', emailId);
      return;
    }
    
    try {
      const response = await axios.post(`${API}/emails/${emailId}/refresh`);
      setMessages(response.data.messages);
      if (showToast) {
        toast.success(`Đã làm mới: ${response.data.count} tin nhắn`);
      }
    } catch (error) {
      console.error('Error refreshing messages:', error);
      // If email not found, clear the selection
      if (error.response?.status === 404) {
        setSelectedEmail(null);
        setMessages([]);
      }
    }
  };

  const selectMessage = async (message) => {
    if (!selectedEmail) return;
    try {
      const response = await axios.get(
        `${API}/emails/${selectedEmail.id}/messages/${message.id}`
      );
      setSelectedMessage(response.data);
    } catch (error) {
      console.error('Error loading message:', error);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast.success('Đã sao chép vào clipboard!');
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          toast.success('Đã sao chép vào clipboard!');
        } catch (err) {
          toast.error('Không thể sao chép. Vui lòng copy thủ công.');
        }
        textArea.remove();
      }
    } catch (err) {
      // Silent fallback for permission issues
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('Đã sao chép vào clipboard!');
      } catch (fallbackErr) {
        toast.error('Không thể sao chép. Vui lòng copy thủ công.');
      }
      textArea.remove();
    }
  };

  const deleteEmail = async (emailId) => {
    try {
      await axios.delete(`${API}/emails/${emailId}`);
      toast.success('Đã xóa email');
      await loadEmails();
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
        setMessages([]);
        setSelectedMessage(null);
      }
    } catch (error) {
      toast.error('Không thể xóa email');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    return `${days} ngày trước`;
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <div className="app-container" data-testid="app-container">
        <Toaster position="top-right" />
        
        {/* Header */}
        <header className="app-header">
          <div className="header-content">
            <div className="logo-section">
              <Mail className="logo-icon" />
              <h1 className="logo-text">TempMail</h1>
            </div>
            <div className="header-actions">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="main-content">
          {/* Sidebar - Email List */}
          <aside className="sidebar">
            <div className="sidebar-header">
              <h2 className="sidebar-title">Email tạm thời</h2>
              <Button
                onClick={createEmail}
                disabled={loading}
                size="sm"
                className="create-email-btn"
                data-testid="create-email-btn"
              >
                <Plus className="h-4 w-4 mr-1" />
                Tạo mới
              </Button>
            </div>

            <ScrollArea className="email-list">
              {emails.length === 0 ? (
                <div className="empty-state">
                  <Mail className="empty-icon" />
                  <p>Chưa có email nào</p>
                  <p className="empty-subtitle">Nhấn "Tạo mới" để bắt đầu</p>
                </div>
              ) : (
                <div className="email-items">
                  {emails.map((email) => (
                    <Card
                      key={email.id}
                      className={`email-card ${selectedEmail?.id === email.id ? 'selected' : ''}`}
                      onClick={() => selectEmail(email)}
                      data-testid={`email-card-${email.id}`}
                    >
                      <CardContent className="email-card-content">
                        <div className="email-info">
                          <div className="email-address-row">
                            <User className="h-4 w-4" />
                            <span className="email-address">{email.address}</span>
                          </div>
                          <div className="email-meta">
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(email.created_at)}</span>
                            {email.message_count > 0 && (
                              <span className="message-badge">
                                {email.message_count}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="email-actions">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(email.address);
                            }}
                            data-testid={`copy-email-${email.id}`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteEmail(email.id);
                            }}
                            data-testid={`delete-email-${email.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </aside>

          {/* Main Area - Messages */}
          <main className="messages-area">
            {!selectedEmail ? (
              <div className="empty-state-large">
                <Inbox className="empty-icon-large" />
                <h3>Chọn một email để xem tin nhắn</h3>
                <p>Tạo email mới hoặc chọn từ danh sách bên trái</p>
              </div>
            ) : (
              <div className="messages-container">
                {/* Email Info Header */}
                <div className="email-info-header">
                  <div className="email-details">
                    <h2 className="email-title">{selectedEmail.address}</h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(selectedEmail.address)}
                      data-testid="copy-selected-email"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Sao chép
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshMessages(selectedEmail.id)}
                    data-testid="refresh-messages-btn"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Làm mới
                  </Button>
                </div>

                <Separator />

                {/* Messages List */}
                <div className="messages-content">
                  {!selectedMessage ? (
                    <div className="message-list-section">
                      {messages.length === 0 ? (
                        <div className="empty-messages">
                          <Inbox className="empty-icon" />
                          <p>Chưa có tin nhắn nào</p>
                          <p className="empty-subtitle">Email sẽ xuất hiện ở đây khi có người gửi</p>
                        </div>
                      ) : (
                        <ScrollArea className="message-scroll">
                          {messages.map((message) => (
                            <Card
                              key={message.id}
                              className="message-card"
                              onClick={() => selectMessage(message)}
                              data-testid={`message-card-${message.id}`}
                            >
                              <CardContent className="message-card-content">
                                <div className="message-header">
                                  <div className="message-from">
                                    <User className="h-4 w-4" />
                                    <span className="from-name">{message.from.name || message.from.address}</span>
                                  </div>
                                  <span className="message-time">{formatDate(message.createdAt)}</span>
                                </div>
                                <h3 className="message-subject">{message.subject}</h3>
                                <p className="message-preview">{message.intro || 'Không có nội dung xem trước'}</p>
                                <ChevronRight className="message-arrow" />
                              </CardContent>
                            </Card>
                          ))}
                        </ScrollArea>
                      )}
                    </div>
                  ) : (
                    <div className="message-detail-section">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedMessage(null)}
                        className="back-btn"
                        data-testid="back-to-messages-btn"
                      >
                        ← Quay lại
                      </Button>

                      <Card className="message-detail-card">
                        <CardHeader>
                          <CardTitle className="message-detail-subject">{selectedMessage.subject}</CardTitle>
                          <div className="message-detail-meta">
                            <div className="meta-row">
                              <strong>Từ:</strong>
                              <span>{selectedMessage.from.name || selectedMessage.from.address}</span>
                            </div>
                            <div className="meta-row">
                              <strong>Đến:</strong>
                              <span>{selectedMessage.to?.[0]?.address}</span>
                            </div>
                            <div className="meta-row">
                              <strong>Ngày:</strong>
                              <span>{new Date(selectedMessage.createdAt).toLocaleString('vi-VN')}</span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Tabs defaultValue="html" className="message-tabs">
                            <TabsList>
                              <TabsTrigger value="html" data-testid="html-tab">HTML</TabsTrigger>
                              <TabsTrigger value="text" data-testid="text-tab">Text</TabsTrigger>
                            </TabsList>
                            <TabsContent value="html" className="message-content">
                              {selectedMessage.html && selectedMessage.html.length > 0 ? (
                                <div
                                  className="html-content"
                                  dangerouslySetInnerHTML={{ __html: selectedMessage.html[0] }}
                                  data-testid="message-html-content"
                                />
                              ) : (
                                <p className="no-content">Không có nội dung HTML</p>
                              )}
                            </TabsContent>
                            <TabsContent value="text" className="message-content">
                              <pre className="text-content" data-testid="message-text-content">
                                {selectedMessage.text || 'Không có nội dung text'}
                              </pre>
                            </TabsContent>
                          </Tabs>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;