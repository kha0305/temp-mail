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

  const fetchDomains = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/domains`);
      setDomains(response.data.domains || []);
    } catch (error) {
      console.error('Error fetching domains:', error);
      alert('Không thể tải danh sách domain');
    } finally {
      setLoading(false);
    }
  };

  const createEmail = async () => {
    if (!selectedService || !selectedDomain) {
      alert('Vui lòng chọn service và domain');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API}/create-email`, {
        service: selectedService,
        domain: selectedDomain
      });
      setCurrentEmail(response.data);
      setMessages([]);
      // Fetch messages immediately
      setTimeout(() => fetchMessages(response.data), 1000);
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

  // Group domains by service
  const groupedDomains = domains.reduce((acc, domain) => {
    if (!acc[domain.service]) {
      acc[domain.service] = [];
    }
    acc[domain.service].push(domain);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            📧 Temporary Email
          </h1>
          <p className="text-gray-600">
            Tạo email tạm thời với mail.tm và mail.gw
          </p>
        </div>

        {/* Email Creation Section */}
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Tạo Email Mới
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Service Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn Service
              </label>
              <select
                value={selectedService}
                onChange={(e) => {
                  setSelectedService(e.target.value);
                  setSelectedDomain('');
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Chọn Service --</option>
                <option value="mail.tm">mail.tm</option>
                <option value="mail.gw">mail.gw</option>
              </select>
            </div>

            {/* Domain Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn Domain
              </label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                disabled={!selectedService}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">-- Chọn Domain --</option>
                {selectedService && groupedDomains[selectedService]?.map((domain) => (
                  <option key={domain.id} value={domain.domain}>
                    @{domain.domain}
                  </option>
                ))}
              </select>
            </div>

            {/* Create Button */}
            <div className="flex items-end">
              <button
                onClick={createEmail}
                disabled={loading || !selectedService || !selectedDomain}
                className="w-full px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Đang tạo...' : 'Tạo Email'}
              </button>
            </div>
          </div>

          {/* Current Email Display */}
          {currentEmail && (
            <div className="mt-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Email của bạn:</p>
                  <p className="text-xl font-bold text-gray-800">
                    {currentEmail.email}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Service: {currentEmail.service}
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(currentEmail.email)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  📋 Copy
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Messages Section */}
        {currentEmail && (
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">
                📬 Inbox ({messages.length})
              </h2>
              <button
                onClick={() => fetchMessages()}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
              >
                🔄 Làm mới
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              ⏱ Tự động làm mới mỗi 1 phút
            </p>

            {messages.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">📭 Chưa có email nào</p>
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
                          <p className="text-sm text-gray-500 mt-2">
                            {message.intro}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 ml-4">
                        {new Date(message.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message Detail Modal */}
        {selectedMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
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
                    className="text-gray-400 hover:text-gray-600 text-2xl"
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
                  <pre className="whitespace-pre-wrap text-gray-700">
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
