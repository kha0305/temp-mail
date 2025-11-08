import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TempMail = () => {
  const [activeTab, setActiveTab] = useState('current');
  const [domains, setDomains] = useState([]);
  const [selectedService, setSelectedService] = useState('mail.tm');
  const [currentEmail, setCurrentEmail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [emailHistory, setEmailHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds

  // Fetch available domains on mount
  useEffect(() => {
    fetchDomains();
    loadEmailHistory();
  }, []);

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
      ...history.slice(0, 15), // Keep only last 16
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
      
      // Get domains for selected service
      const serviceDomains = domains.filter(d => d.service === selectedService);
      if (serviceDomains.length === 0) {
        alert('Không tìm thấy domain cho service này');
        return;
      }

      // Use first available domain
      const domain = serviceDomains[0].domain;
      
      const response = await axios.post(`${API}/create-email`, {
        service: selectedService,
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">📧 TempMail</h1>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('current')}
              className={`flex-1 px-6 py-3 text-sm font-medium ${
                activeTab === 'current'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📧 Email hiện tại
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-6 py-3 text-sm font-medium ${
                activeTab === 'history'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📋 Lịch sử ({emailHistory.length})
            </button>
          </div>

          {/* Current Email Tab */}
          {activeTab === 'current' && (
            <div className="p-8">
              {!currentEmail ? (
                <div className="text-center py-12">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    Địa chỉ email 10 phút của bạn
                  </h2>
                  <p className="text-gray-600 mb-8">
                    Với 10 Minute Mail, hãy tránh thư rác, giữ hộp thư của bạn sạch sẽ và bảo vệ
                    quyền riêng tư của bạn một cách dễ dàng.
                  </p>
                  
                  {/* Service Selection */}
                  <div className="mb-6">
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={() => setSelectedService('mail.tm')}
                        className={`px-6 py-2 rounded-lg font-medium ${
                          selectedService === 'mail.tm'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        mail.tm
                      </button>
                      <button
                        onClick={() => setSelectedService('mail.gw')}
                        className={`px-6 py-2 rounded-lg font-medium ${
                          selectedService === 'mail.gw'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        mail.gw
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={createEmail}
                    disabled={loading}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                  >
                    {loading ? 'Đang tạo...' : '🚀 Tạo Email Ngay'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">
                      Địa chỉ email 10 phút của bạn
                    </h2>
                    <p className="text-gray-600">
                      Với 10 Minute Mail, hãy tránh thư rác, giữ hộp thư của bạn sạch sẽ và bảo vệ
                      quyền riêng tư của bạn một cách dễ dàng.
                    </p>
                  </div>

                  {/* Email Display */}
                  <div className="mb-6">
                    <div className="flex items-center justify-center gap-4 bg-gray-50 p-6 rounded-lg border-2 border-gray-200">
                      <div className="flex-1 text-center">
                        <div className="text-2xl font-mono font-semibold text-gray-800 break-all">
                          {currentEmail.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-3xl font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-gray-800'}`}>
                          {formatTime(timeLeft)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(currentEmail.email)}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Copy email"
                        >
                          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-center gap-4 mb-8">
                    <button
                      onClick={refreshTimer}
                      className="flex items-center gap-2 px-6 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Làm mới 10 phút
                    </button>
                    <button
                      onClick={changeEmail}
                      disabled={loading}
                      className="flex items-center gap-2 px-6 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:bg-gray-100"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Thay đổi
                    </button>
                    <button
                      onClick={deleteEmail}
                      className="flex items-center gap-2 px-6 py-2 bg-white border border-gray-300 rounded-lg hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Xóa
                    </button>
                  </div>

                  {/* Messages Section */}
                  <div className="border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-semibold text-gray-800">Tin nhắn</h3>
                      <button
                        onClick={() => fetchMessages()}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Làm mới
                      </button>
                    </div>

                    {messages.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <svg className="w-24 h-24 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <p className="text-lg font-medium">📭 Chưa có email nào</p>
                        <p className="text-sm mt-2">Email mới sẽ xuất hiện ở đây</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            onClick={() => viewMessage(message)}
                            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-800">
                                  {message.subject || '(No Subject)'}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                  From: {message.from?.address || message.from}
                                </p>
                                {message.intro && (
                                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">
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
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Lịch sử Email</h2>
              {emailHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">Chưa có lịch sử email</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emailHistory.map((email, index) => (
                    <div
                      key={index}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-mono font-semibold text-gray-800">{email.email}</p>
                          <p className="text-sm text-gray-600 mt-1">Service: {email.service}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">
                            {new Date(email.createdAt).toLocaleString('vi-VN')}
                          </p>
                          <button
                            onClick={() => copyToClipboard(email.email)}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
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
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">
                      {selectedMessage.subject || '(No Subject)'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      From: {selectedMessage.from?.address || selectedMessage.from}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(selectedMessage.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
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
