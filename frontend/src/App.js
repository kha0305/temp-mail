import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ThemeProvider } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { 
  Mail, Copy, Trash2, RefreshCw, Sun, Moon, 
  Clock, Edit, Inbox, History
} from 'lucide-react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function ThemeToggle() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
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
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </Button>
  );
}

function App() {
  const [currentEmail, setCurrentEmail] = useState(null);
  const [historyEmails, setHistoryEmails] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // Calculated from expires_at
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('current');
  const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);

  // Load emails on mount
  useEffect(() => {
    loadEmails();
    loadHistory();
  }, []);

  // Timer countdown - calculate from expires_at
  useEffect(() => {
    if (currentEmail && currentEmail.expires_at) {
      const updateTimer = () => {
        const now = new Date();
        const expiresAt = new Date(currentEmail.expires_at);
        const diffSeconds = Math.floor((expiresAt - now) / 1000);
        
        if (diffSeconds <= 0) {
          setTimeLeft(0);
          // Email expired, reload to get new email created by backend
          toast.info('Email đã hết hạn, đang tải email mới...');
          loadEmails();
        } else {
          setTimeLeft(diffSeconds);
        }
      };
      
      // Update immediately
      updateTimer();
      
      // Update every second
      const timer = setInterval(updateTimer, 1000);
      return () => clearInterval(timer);
    }
  }, [currentEmail]);

  // Auto refresh messages
  useEffect(() => {
    if (currentEmail?.id && autoRefresh) {
      const interval = setInterval(() => {
        if (currentEmail?.id) {
          refreshMessages(currentEmail.id, false);
        }
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [currentEmail?.id, autoRefresh]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadEmails = async () => {
    try {
      const response = await axios.get(`${API}/emails`);
      const emails = response.data;
      
      if (emails.length > 0) {
        // Set the first email as current (most recent active email)
        const latest = emails[0];
        setCurrentEmail(latest);
        await refreshMessages(latest.id, false);
      } else {
        setCurrentEmail(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading emails:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await axios.get(`${API}/emails/history/list`);
      setHistoryEmails(response.data);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const createNewEmail = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/emails/create`, {});
      const newEmail = response.data;
      
      // Move current email to history if exists
      if (currentEmail) {
        setHistoryEmails(prev => [currentEmail, ...prev]);
      }
      
      setCurrentEmail(newEmail);
      setMessages([]);
      setSelectedMessage(null);
      setTimeLeft(600); // Reset timer to 10 minutes
      
      toast.success('Email mới đã được tạo!', {
        description: newEmail.address
      });
      
      await refreshMessages(newEmail.id, false);
    } catch (error) {
      toast.error('Không thể tạo email mới', {
        description: error.response?.data?.detail || 'Lỗi không xác định'
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteCurrentEmail = async () => {
    if (!currentEmail) return;
    
    setLoading(true);
    try {
      await axios.delete(`${API}/emails/${currentEmail.id}`);
      
      toast.success('Email đã được xóa');
      
      // Load next email from history or create new
      if (historyEmails.length > 0) {
        const nextEmail = historyEmails[0];
        setCurrentEmail(nextEmail);
        setHistoryEmails(prev => prev.slice(1));
        await refreshMessages(nextEmail.id, false);
        setTimeLeft(600);
      } else {
        setCurrentEmail(null);
        setMessages([]);
        setSelectedMessage(null);
      }
    } catch (error) {
      toast.error('Không thể xóa email');
    } finally {
      setLoading(false);
    }
  };

  const addTime = () => {
    setTimeLeft(prev => prev + 600); // Add 10 more minutes
    toast.success('Đã thêm 10 phút');
  };

  const refreshMessages = async (emailId, showToast = true) => {
    if (!emailId || emailId.trim() === '') {
      console.warn('Invalid email ID');
      return;
    }
    
    setRefreshing(true);
    try {
      const response = await axios.post(`${API}/emails/${emailId}/refresh`);
      setMessages(response.data.messages);
      if (showToast) {
        toast.success(`Đã làm mới: ${response.data.count} tin nhắn`);
      }
    } catch (error) {
      console.error('Error refreshing messages:', error);
      if (error.response?.status === 404) {
        setCurrentEmail(null);
        setMessages([]);
      }
      if (showToast) {
        toast.error('Không thể làm mới tin nhắn');
      }
    } finally {
      setRefreshing(false);
    }
  };

  const selectMessage = async (message) => {
    if (!currentEmail) return;
    
    try {
      const response = await axios.get(
        `${API}/emails/${currentEmail.id}/messages/${message.id}`
      );
      setSelectedMessage(response.data);
    } catch (error) {
      toast.error('Không thể tải chi tiết tin nhắn');
    }
  };

  const switchToHistoryEmail = async (email) => {
    // Move current to history
    if (currentEmail) {
      setHistoryEmails(prev => [currentEmail, ...prev.filter(e => e.id !== email.id)]);
    }
    
    // Set selected history email as current
    setCurrentEmail(email);
    setHistoryEmails(prev => prev.filter(e => e.id !== email.id));
    setTimeLeft(600);
    setMessages([]);
    setSelectedMessage(null);
    await refreshMessages(email.id, false);
    setActiveTab('current');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép vào clipboard');
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <div className="app-container">
        <Toaster position="top-right" />
        
        {/* Header */}
        <header className="app-header-new">
          <div className="header-content-new">
            <div className="logo-section">
              <Mail className="h-8 w-8" />
              <h1 className="logo-text">TempMail</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Main Content */}
        <main className="main-content-new">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="main-tabs">
            <TabsList className="tabs-list-new">
              <TabsTrigger value="current" className="tab-trigger-new">
                <Inbox className="h-4 w-4 mr-2" />
                Email hiện tại
              </TabsTrigger>
              <TabsTrigger value="history" className="tab-trigger-new">
                <History className="h-4 w-4 mr-2" />
                Lịch sử ({historyEmails.length})
              </TabsTrigger>
            </TabsList>

            {/* Current Email Tab */}
            <TabsContent value="current" className="tab-content-new">
              {currentEmail ? (
                <>
                  {/* Hero Section */}
                  <div className="hero-section">
                    <h2 className="hero-title">Địa chỉ email 10 phút của bạn</h2>
                    <p className="hero-description">
                      Với 10 Minute Mail, hãy tránh thư rác, giữ hộp thư của bạn sạch sẽ 
                      và bảo vệ quyền riêng tư của bạn một cách dễ dàng.
                    </p>

                    {/* Email Display */}
                    <div className="email-display-box">
                      <div className="email-address-container">
                        <span className="email-address">{currentEmail.address}</span>
                        <div className="email-actions-inline">
                          <span className={`timer ${timeLeft <= 60 ? 'timer-warning' : ''}`}>
                            {formatTime(timeLeft)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(currentEmail.address)}
                            className="copy-btn-inline"
                          >
                            <Copy className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="action-buttons-group">
                      <Button
                        onClick={addTime}
                        className="action-btn"
                        variant="outline"
                        disabled={timeLeft >= 1200}
                      >
                        <Clock className="h-5 w-5 mr-2" />
                        Thêm 10 phút nữa
                      </Button>
                      <Button
                        onClick={createNewEmail}
                        className="action-btn"
                        variant="outline"
                        disabled={loading}
                      >
                        <Edit className="h-5 w-5 mr-2" />
                        Thay đổi
                      </Button>
                      <Button
                        onClick={deleteCurrentEmail}
                        className="action-btn action-btn-danger"
                        variant="outline"
                        disabled={loading}
                      >
                        <Trash2 className="h-5 w-5 mr-2" />
                        Xóa
                      </Button>
                    </div>
                  </div>

                  <Separator className="section-separator" />

                  {/* Messages Section */}
                  <div className="messages-section">
                    <div className="messages-header">
                      <h3 className="messages-title">Tin nhắn</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshMessages(currentEmail.id)}
                        disabled={refreshing}
                        className="refresh-btn-new"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Đang tải...' : 'Làm mới'}
                      </Button>
                    </div>

                    {!selectedMessage ? (
                      <div className="inbox-area">
                        {messages.length === 0 ? (
                          <div className="empty-state">
                            <Mail className="empty-icon" />
                            <h4 className="empty-title">Hộp thư của bạn trống</h4>
                            <p className="empty-description">Đang chờ email đến</p>
                          </div>
                        ) : (
                          <ScrollArea className="messages-list">
                            {messages.map((msg) => (
                              <Card
                                key={msg.id}
                                className="message-card"
                                onClick={() => selectMessage(msg)}
                              >
                                <CardContent className="message-card-content">
                                  <div className="message-info">
                                    <h4 className="message-from">{msg.from?.name || msg.from?.address}</h4>
                                    <p className="message-subject">{msg.subject}</p>
                                    <span className="message-time">{getTimeAgo(msg.createdAt)}</span>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </ScrollArea>
                        )}
                      </div>
                    ) : (
                      <div className="message-detail">
                        <Button
                          variant="ghost"
                          onClick={() => setSelectedMessage(null)}
                          className="back-btn"
                        >
                          ← Quay lại
                        </Button>
                        
                        <Card className="detail-card">
                          <CardContent className="detail-content">
                            <div className="detail-header">
                              <h3 className="detail-subject">{selectedMessage.subject}</h3>
                              <div className="detail-meta">
                                <div className="meta-row">
                                  <span className="meta-label">Từ:</span>
                                  <span className="meta-value">
                                    {selectedMessage.from?.name} ({selectedMessage.from?.address})
                                  </span>
                                </div>
                                <div className="meta-row">
                                  <span className="meta-label">Ngày:</span>
                                  <span className="meta-value">
                                    {new Date(selectedMessage.createdAt).toLocaleString('vi-VN')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <Separator className="detail-separator" />

                            <Tabs defaultValue="html" className="message-tabs">
                              <TabsList>
                                <TabsTrigger value="html">HTML</TabsTrigger>
                                <TabsTrigger value="text">Text</TabsTrigger>
                              </TabsList>
                              <TabsContent value="html" className="message-content">
                                {selectedMessage.html && selectedMessage.html.length > 0 ? (
                                  <div
                                    className="html-content"
                                    dangerouslySetInnerHTML={{ __html: selectedMessage.html[0] }}
                                  />
                                ) : (
                                  <p className="no-content">Không có nội dung HTML</p>
                                )}
                              </TabsContent>
                              <TabsContent value="text" className="message-content">
                                {selectedMessage.text && selectedMessage.text.length > 0 ? (
                                  <div className="text-content">{selectedMessage.text[0]}</div>
                                ) : (
                                  <p className="no-content">Không có nội dung text</p>
                                )}
                              </TabsContent>
                            </Tabs>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state-main">
                  <Mail className="empty-icon-large" />
                  <h3 className="empty-title-large">Chưa có email nào</h3>
                  <p className="empty-description-large">Tạo email mới để bắt đầu</p>
                  <Button onClick={createNewEmail} disabled={loading} className="create-btn-large">
                    <Mail className="h-5 w-5 mr-2" />
                    Tạo email mới
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="tab-content-new">
              <div className="history-section">
                <h2 className="history-title">Lịch sử email</h2>
                {historyEmails.length === 0 ? (
                  <div className="empty-state">
                    <History className="empty-icon" />
                    <h4 className="empty-title">Chưa có lịch sử</h4>
                    <p className="empty-description">Các email cũ sẽ được lưu tại đây</p>
                  </div>
                ) : (
                  <ScrollArea className="history-list">
                    {historyEmails.map((email) => (
                      <Card key={email.id} className="history-card" onClick={() => switchToHistoryEmail(email)}>
                        <CardContent className="history-card-content">
                          <div className="history-info">
                            <Mail className="h-5 w-5 history-icon" />
                            <div className="history-details">
                              <p className="history-address">{email.address}</p>
                              <span className="history-time">{getTimeAgo(email.created_at)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </ScrollArea>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;