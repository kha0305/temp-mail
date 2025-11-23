import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TempMail = () => {
  // Random hero titles
  const heroTitles = [
    "Email tạm thời của bạn",
    "Địa chỉ email 10 phút",
    "Email dùng một lần",
    "Hộp thư tức thời của bạn",
    "Email ảo an toàn",
    "Email nhanh và tiện lợi",
    "Hộp thư ẩn danh"
  ];
  const [heroTitle] = useState(() => heroTitles[Math.floor(Math.random() * heroTitles.length)]);
  
  const [activeTab, setActiveTab] = useState('current');
  const [domains, setDomains] = useState([]);
  const [selectedService, setSelectedService] = useState('edu');
  const [currentEmail, setCurrentEmail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [emailHistory, setEmailHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds

  // Fetch available domains on mount
  useEffect(() => {
    const initializeApp = async () => {
      await fetchDomains();
      loadEmailHistory();
    };
    
    initializeApp();
  }, []);

  // Auto-create email after domains are loaded
  useEffect(() => {
    if (domains.length > 0 && !currentEmail && !loading) {
      createEmail();
    }
  }, [domains]);

  // Timer countdown
  useEffect(() => {
    if (currentEmail && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentEmail, timeLeft]);

  // Auto refresh messages every 1 minute
  useEffect(() => {
    if (currentEmail && currentEmail.token && activeTab === 'current') {
      const interval = setInterval(() => {
        fetchMessages();
      }, 60000); // 60 seconds

      return () => clearInterval(interval);
    }
  }, [currentEmail, activeTab]);

  const loadEmailHistory = () => {
    const history = JSON.parse(localStorage.getItem('emailHistory') || '[]');
    setEmailHistory(history);
  };

  const saveToHistory = (email) => {
    const history = JSON.parse(localStorage.getItem('emailHistory') || '[]');
    const newHistory = [
      { ...email, createdAt: new Date().toISOString() },
      ...history.slice(0, 4), // Keep only last 5
    ];
    localStorage.setItem('emailHistory', JSON.stringify(newHistory));
    setEmailHistory(newHistory);
  };

  const fetchDomains = async () => {
    try {
      const response = await axios.get(`${API}/domains`);
      setDomains(response.data.domains || []);
    } catch (error) {
      console.error('Error fetching domains:', error);
    }
  };

  const createEmail = async () => {
    try {
      setLoading(true);
      
      // Prioritize Edu Mail if available
      let targetService = selectedService;
      if (domains.some(d => d.service === 'edu')) {
        targetService = 'edu';
      } else if (domains.some(d => d.service === 'custom1')) {
        targetService = 'custom1';
      }

      // Get domains for selected service
      const serviceDomains = domains.filter(d => d.service === targetService);
      if (serviceDomains.length === 0) {
        // Fallback to any available domain
        if (domains.length > 0) {
           targetService = domains[0].service;
        } else {
           alert('Không tìm thấy domain nào khả dụng');
           return;
        }
      }
      
      const domain = domains.find(d => d.service === targetService)?.domain;

      const response = await axios.post(`${API}/create-email`, {
        service: targetService,
        domain: domain
      });
      
      const newEmail = response.data;
      setCurrentEmail(newEmail);
      setMessages([]);
      setTimeLeft(600); // Reset timer to 10 minutes
      saveToHistory(newEmail);
      
      // Fetch messages immediately
      setTimeout(() => fetchMessages(newEmail), 1000);
    } catch (error) {
      console.error('Error creating email:', error);
      alert('Không thể tạo email. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (emailData = currentEmail) => {
    if (!emailData || !emailData.token) return;

    try {
      const response = await axios.post(`${API}/messages`, {
        email: emailData.email,
        token: emailData.token,
        service: emailData.service
      });
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const viewMessage = async (message) => {
    if (!currentEmail) return;

    try {
      const response = await axios.get(
        `${API}/messages/${message.id}?service=${currentEmail.service}&token=${currentEmail.token}`
      );
      setSelectedMessage(response.data);
    } catch (error) {
      console.error('Error fetching message detail:', error);
      alert('Không thể tải nội dung email');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Đã copy vào clipboard!');
  };

  const refreshTimer = () => {
    setTimeLeft(600); // Reset to 10 minutes
  };

  const changeEmail = () => {
    createEmail();
  };

  const deleteEmail = () => {
    if (window.confirm('Bạn có chắc muốn xóa email này?')) {
      setCurrentEmail(null);
      setMessages([]);
      setTimeLeft(600);
    }
  };

  const saveCurrentEmail = () => {
    if (!currentEmail) {
      alert('Không có email để lưu');
      return;
    }
    
    // Save to localStorage as saved email
    const savedEmails = JSON.parse(localStorage.getItem('savedEmails') || '[]');
    
    // Check if already saved
    const alreadySaved = savedEmails.some(email => email.email === currentEmail.email);
    if (alreadySaved) {
      alert('Email này đã được lưu rồi!');
      return;
    }
    
    const emailToSave = {
      ...currentEmail,
      savedAt: new Date().toISOString(),
      messages: messages // Save current messages
    };
    
    const newSavedEmails = [emailToSave, ...savedEmails];
    localStorage.setItem('savedEmails', JSON.stringify(newSavedEmails));
    
    alert('✅ Đã lưu email thành công!');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-blue-500">📧 TempMail</h1>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('current')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'current'
                  ? 'text-blue-500 border-b-2 border-blue-500 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              📧 Email hiện tại
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-blue-500 border-b-2 border-blue-500 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              📋 Lịch sử ({emailHistory.length})
            </button>
          </div>

          {/* Current Email Tab */}
          {activeTab === 'current' && (
            <div className="p-8">
              {!currentEmail ? (
                <div className="text-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Đang tạo email tạm thời...</p>
                </div>
              ) : (
                <>
                  {/* Title and Description */}
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {heroTitle}
                    </h2>
                    <p className="text-gray-600 text-sm max-w-3xl mx-auto">
                      Với 10 Minute Mail, hãy tránh thư rác, giữ hộp thư của bạn sạch sẽ và bảo vệ quyền riêng tư của bạn một cách dễ dàng.
                    </p>
                  </div>

                  {/* Email Display Box - Compact */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex-1 min-w-0">
                        <div className="text-lg font-mono text-gray-900 truncate" title={currentEmail.email}>
                          {currentEmail.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <span 
                          className={`text-3xl font-bold tabular-nums ${
                            timeLeft < 60 ? 'text-red-500' : 'text-gray-900'
                          }`}
                        >
                          {formatTime(timeLeft)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(currentEmail.email)}
                          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          title="Copy email"
                        >
                          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-center gap-3 mb-8">
                    <button
                      onClick={refreshTimer}
                      className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Làm mới 10 phút
                    </button>
                    <button
                      onClick={changeEmail}
                      disabled={loading}
                      className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium text-sm disabled:bg-gray-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Thay đổi
                    </button>
                    <button
                      onClick={deleteEmail}
                      className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Xóa
                    </button>
                    <button
                      onClick={saveCurrentEmail}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Lưu
                    </button>
                  </div>

                  {/* Messages Section */}
                  <div className="border-t border-gray-200 pt-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-gray-900">Tin nhắn</h3>
                      <button
                        onClick={() => fetchMessages()}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Làm mới
                      </button>
                    </div>

                    {messages.length === 0 ? (
                      <div className="text-center py-16">
                        <svg className="w-32 h-32 mx-auto mb-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <p className="text-lg font-medium text-gray-900 mb-2">📭 Chưa có email nào</p>
                        <p className="text-sm text-gray-500">Email mới sẽ xuất hiện ở đây</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            onClick={() => viewMessage(message)}
                            className="p-5 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900 text-base mb-1">
                                  {message.subject || '(No Subject)'}
                                </p>
                                <p className="text-sm text-gray-600 mb-2">
                                  From: {message.from?.address || message.from}
                                </p>
                                {message.intro && (
                                  <p className="text-sm text-gray-500 line-clamp-2">
                                    {message.intro}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                                {new Date(message.createdAt).toLocaleString('vi-VN')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Lịch sử Email</h2>
              {emailHistory.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <p className="text-lg">Chưa có lịch sử email</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emailHistory.map((email, index) => (
                    <div
                      key={index}
                      className="p-5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-mono font-semibold text-gray-900 text-base">{email.email}</p>
                          <p className="text-sm text-gray-600 mt-1">Service: {email.service}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400 mb-2">
                            {new Date(email.createdAt).toLocaleString('vi-VN')}
                          </p>
                          <button
                            onClick={() => copyToClipboard(email.email)}
                            className="text-sm text-blue-500 hover:text-blue-600 font-medium"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message Detail Modal */}
        {selectedMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedMessage(null)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {selectedMessage.subject || '(No Subject)'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-2">
                      From: {selectedMessage.from?.address || selectedMessage.from}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(selectedMessage.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="text-gray-400 hover:text-gray-600 text-3xl font-bold leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {selectedMessage.html && selectedMessage.html.length > 0 ? (
                  <div
                    className="prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedMessage.html[0] }}
                  />
                ) : selectedMessage.text ? (
                  <pre className="whitespace-pre-wrap text-gray-700 font-sans">
                    {selectedMessage.text}
                  </pre>
                ) : (
                  <p className="text-gray-500">No content</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TempMail;
