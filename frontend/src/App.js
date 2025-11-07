import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

  // Load emails on mount and auto-create if no email exists
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load existing emails
        const response = await axios.get(`${API}/emails`);
        const emails = response.data;
        
        if (emails.length > 0) {
          // Set the first email as current
          const latest = emails[0];
          setCurrentEmail(latest);
          
          // Load messages for current email
          try {
            const msgResponse = await axios.post(`${API}/emails/${latest.id}/refresh`);
            setMessages(msgResponse.data.messages);
          } catch (err) {
            console.error('Error loading initial messages:', err);
          }
        } else {
          // No emails exist, auto-create one
          toast.info('Đang tạo email mới...');
          try {
            const createResponse = await axios.post(`${API}/emails/create`, {});
            const newEmail = createResponse.data;
            
            setCurrentEmail(newEmail);
            setMessages([]);
            setSelectedMessage(null);
            
            toast.success('Email mới đã được tạo!', {
              description: newEmail.address
            });
          } catch (createErr) {
            toast.error('Không thể tạo email mới', {
              description: createErr.response?.data?.detail || 'Lỗi không xác định'
            });
          }
        }
        
        // Load history
        try {
          const historyResponse = await axios.get(`${API}/emails/history/list`);
          setHistoryEmails(historyResponse.data);
        } catch (histErr) {
          console.error('Error loading history:', histErr);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        // If error getting emails, try to create one anyway
        try {
          toast.info('Đang tạo email mới...');
          const createResponse = await axios.post(`${API}/emails/create`, {});
          const newEmail = createResponse.data;
          
          setCurrentEmail(newEmail);
          setMessages([]);
          
          toast.success('Email mới đã được tạo!', {
            description: newEmail.address
          });
        } catch (createErr) {
          toast.error('Không thể khởi tạo ứng dụng');
        }
      }
    };
    
    initializeApp();
  }, []);

  // Timer countdown - calculate from expires_at
  useEffect(() => {
    if (currentEmail && currentEmail.expires_at) {
      let isCreatingNewEmail = false;
      
      const updateTimer = async () => {
        const now = new Date();
        const expiresAt = new Date(currentEmail.expires_at);
        const diffSeconds = Math.floor((expiresAt - now) / 1000);
        
        if (diffSeconds <= 0) {
          setTimeLeft(0);
          
          // Email expired, auto-create new email (only once)
          if (!isCreatingNewEmail) {
            isCreatingNewEmail = true;
            toast.info('Email đã hết hạn, đang tạo email mới...');
            
            try {
              const response = await axios.post(`${API}/emails/create`, {});
              const newEmail = response.data;
              
              setCurrentEmail(newEmail);
              setMessages([]);
              setSelectedMessage(null);
              
              toast.success('Email mới đã được tạo!', {
                description: newEmail.address
              });
              
              // Reload history
              try {
                const historyResponse = await axios.get(`${API}/emails/history/list`);
                setHistoryEmails(historyResponse.data);
              } catch (err) {
                console.error('Error reloading history:', err);
              }
            } catch (error) {
              toast.error('Không thể tạo email mới', {
                description: error.response?.data?.detail || 'Lỗi không xác định'
              });
            }
          }
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
      
      setCurrentEmail(newEmail);
      setMessages([]);
      setSelectedMessage(null);
      
      toast.success('Email mới đã được tạo!', {
        description: newEmail.address
      });
      
      // Reload history in case old email was moved there
      await loadHistory();
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
      
      // Clear current email
      setCurrentEmail(null);
      setMessages([]);
      setSelectedMessage(null);
    } catch (error) {
      toast.error('Không thể xóa email');
    } finally {
      setLoading(false);
    }
  };

  const addTime = async () => {
    if (!currentEmail) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/emails/${currentEmail.id}/extend-time`);
      
      // Update currentEmail with new expires_at
      setCurrentEmail(prev => ({
        ...prev,
        expires_at: response.data.expires_at
      }));
      
      toast.success('Đã làm mới thời gian về 10 phút');
    } catch (error) {
      toast.error('Không thể gia hạn thời gian', {
        description: error.response?.data?.detail || 'Lỗi không xác định'
      });
    } finally {
      setLoading(false);
    }
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

  const viewHistoryEmail = async (email) => {
    // Just view messages from history email, don't make it current
    try {
      const response = await axios.get(`${API}/emails/history/${email.id}/messages`);
      setMessages(response.data.messages);
      setSelectedMessage(null);
      // Temporarily set as "current" for viewing
      setCurrentEmail({ ...email, isHistory: true });
    } catch (error) {
      toast.error('Không thể tải tin nhắn từ lịch sử');
    }
  };

  const toggleHistorySelection = (emailId) => {
    setSelectedHistoryIds(prev => {
      if (prev.includes(emailId)) {
        return prev.filter(id => id !== emailId);
      } else {
        return [...prev, emailId];
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedHistoryIds.length === historyEmails.length) {
      setSelectedHistoryIds([]);
    } else {
      setSelectedHistoryIds(historyEmails.map(e => e.id));
    }
  };

  const deleteSelectedHistory = async () => {
    if (selectedHistoryIds.length === 0) {
      toast.warning('Chưa chọn email nào');
      return;
    }

    setLoading(true);
    try {
      await axios.delete(`${API}/emails/history/delete`, {
        data: { ids: selectedHistoryIds }
      });
      
      toast.success(`Đã xóa ${selectedHistoryIds.length} email`);
      setSelectedHistoryIds([]);
      await loadHistory();
    } catch (error) {
      toast.error('Không thể xóa email đã chọn');
    } finally {
      setLoading(false);
    }
  };

  const deleteAllHistory = async () => {
    if (historyEmails.length === 0) {
      toast.warning('Lịch sử trống');
      return;
    }

    setLoading(true);
    try {
      await axios.delete(`${API}/emails/history/delete`, {
        data: { ids: null }
      });
      
      toast.success('Đã xóa tất cả lịch sử');
      setSelectedHistoryIds([]);
      setHistoryEmails([]);
    } catch (error) {
      toast.error('Không thể xóa tất cả lịch sử');
    } finally {
      setLoading(false);
    }
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
                        disabled={loading || currentEmail?.isHistory}
                      >
                        <Clock className="h-5 w-5 mr-2" />
                        Làm mới 10 phút
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
                        disabled={loading || currentEmail?.isHistory}
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
                <div className="history-header">
                  <h2 className="history-title">Lịch sử email</h2>
                  {historyEmails.length > 0 && (
                    <div className="history-actions">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleSelectAll}
                        className="select-all-btn"
                      >
                        {selectedHistoryIds.length === historyEmails.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={deleteSelectedHistory}
                        disabled={selectedHistoryIds.length === 0 || loading}
                        className="delete-selected-btn"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Xóa đã chọn ({selectedHistoryIds.length})
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={deleteAllHistory}
                        disabled={loading}
                        className="delete-all-btn"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Xóa tất cả
                      </Button>
                    </div>
                  )}
                </div>

                {historyEmails.length === 0 ? (
                  <div className="empty-state">
                    <History className="empty-icon" />
                    <h4 className="empty-title">Chưa có lịch sử</h4>
                    <p className="empty-description">Các email đã hết hạn sẽ được lưu tại đây</p>
                  </div>
                ) : (
                  <ScrollArea className="history-list">
                    {historyEmails.map((email) => (
                      <Card 
                        key={email.id} 
                        className={`history-card ${selectedHistoryIds.includes(email.id) ? 'selected' : ''}`}
                      >
                        <CardContent className="history-card-content">
                          <input
                            type="checkbox"
                            checked={selectedHistoryIds.includes(email.id)}
                            onChange={() => toggleHistorySelection(email.id)}
                            className="history-checkbox"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div 
                            className="history-info"
                            onClick={() => viewHistoryEmail(email)}
                          >
                            <Mail className="h-5 w-5 history-icon" />
                            <div className="history-details">
                              <p className="history-address">{email.address}</p>
                              <span className="history-time">
                                Hết hạn: {getTimeAgo(email.expired_at)}
                              </span>
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