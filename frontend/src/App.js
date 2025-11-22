import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Clock, Edit, Inbox, History, Server, Bookmark, Bell, BellOff
} from 'lucide-react';
import { io } from 'socket.io-client';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Sound effect for new mail (Base64 to avoid file dependency issues)
const NOTIFICATION_SOUND = 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'; 
// Note: The above is a placeholder. In a real app, use a real file or a full base64 string. 
// I will use a simple beep function or just rely on browser notification for now to keep code clean.

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
  // Random hero titles
  const heroTitles = [
    "Email tạm thời của bạn",
    "Địa chỉ email 10 phút",
    "Email dùng một lần",
    "Hộp thư tức thời của bạn",
    "Email ảo an toàn"
  ];
  const [heroTitle] = useState(() => heroTitles[Math.floor(Math.random() * heroTitles.length)]);
  
  const [currentEmail, setCurrentEmail] = useState(null);
  const [historyEmails, setHistoryEmails] = useState([]);
  const [savedEmails, setSavedEmails] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('current');
  const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);
  const [selectedSavedIds, setSelectedSavedIds] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'
  const [selectedHistoryEmail, setSelectedHistoryEmail] = useState(null);
  const [selectedSavedEmail, setSelectedSavedEmail] = useState(null);
  const [historyMessages, setHistoryMessages] = useState([]);
  const [savedMessageDetail, setSavedMessageDetail] = useState(null);
  
  // Service & Domain selection
  const [selectedService, setSelectedService] = useState('auto'); // Default: Auto
  const [availableDomains, setAvailableDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  
  // Notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Refs to prevent race conditions
  const isCreatingEmailRef = useRef(false);
  const lastEmailIdRef = useRef(null);
  const socketRef = useRef(null);
  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')); // Simple bell sound

  // Request Notification Permission
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Trình duyệt không hỗ trợ thông báo');
      return;
    }
    
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      toast.success('Đã bật thông báo trình duyệt');
      new Notification('Temp Mail', { body: 'Thông báo đã được kích hoạt!' });
    } else {
      setNotificationsEnabled(false);
      toast.warning('Bạn đã từ chối quyền thông báo');
    }
  };

  // Socket.io Connection
  useEffect(() => {
    // Connect to socket
    socketRef.current = io(BACKEND_URL);

    socketRef.current.on('connect', () => {
      console.log('🟢 Socket connected');
    });

    socketRef.current.on('messages_update', (newMessages) => {
      console.log('📨 Socket received messages:', newMessages.length);
      
      setMessages(prevMessages => {
        // Check if there are actually new messages
        if (newMessages.length > prevMessages.length) {
          const diff = newMessages.length - prevMessages.length;
          
          // Play sound
          try {
            audioRef.current.play().catch(e => console.log('Audio play failed:', e));
          } catch (e) {}

          // Show notification
          if (Notification.permission === 'granted' && document.hidden) {
            const latestMsg = newMessages[0];
            new Notification(`New Email: ${latestMsg.subject || '(No Subject)'}`, {
              body: `From: ${latestMsg.from.address || latestMsg.from.name || 'Unknown'}`,
              icon: '/logo192.png'
            });
          }

          toast.success(`Bạn có ${diff} tin nhắn mới! 📬`);
        }
        return newMessages;
      });
      
      setRefreshing(false);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Watch current email via Socket
  useEffect(() => {
    if (currentEmail && socketRef.current && !currentEmail.isHistory) {
      console.log('👀 Start watching email:', currentEmail.address);
      socketRef.current.emit('watch_email', {
        email: currentEmail.address,
        token: currentEmail.token,
        service: currentEmail.service || currentEmail.provider, // Handle inconsistent naming
        account_id: currentEmail.account_id
      });
    }
  }, [currentEmail]);

  // Check for duplicate IDs in historyEmails
  useEffect(() => {
    if (historyEmails.length > 0) {
      const ids = historyEmails.map(e => e.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        console.error('🚨 DUPLICATE IDS in historyEmails:', {
          totalEmails: ids.length,
          uniqueIds: uniqueIds.size,
          ids: ids,
          duplicates: ids.filter((id, index) => ids.indexOf(id) !== index)
        });
      } else {
        console.log('✅ No duplicate IDs in historyEmails', ids);
      }
    }
  }, [historyEmails]);

  // Check for duplicate IDs in savedEmails
  useEffect(() => {
    if (savedEmails.length > 0) {
      const ids = savedEmails.map(e => e.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        console.error('🚨 DUPLICATE IDS in savedEmails:', {
          totalEmails: ids.length,
          uniqueIds: uniqueIds.size,
          ids: ids,
          duplicates: ids.filter((id, index) => ids.indexOf(id) !== index)
        });
      } else {
        console.log('✅ No duplicate IDs in savedEmails', ids);
      }
    }
  }, [savedEmails]);

  // Load services and domains
  useEffect(() => {
    loadDomainsForService(selectedService);
  }, [selectedService]);

  const loadDomainsForService = async (service) => {
    setLoadingDomains(true);
    try {
      const response = await axios.get(`${API}/domains?service=${service}`);
      const domains = response.data.domains || [];
      setAvailableDomains(domains);
      if (domains.length > 0) {
        setSelectedDomain(domains[0]); // Select first domain by default
      } else {
        console.warn(`No domains available for service: ${service}`);
      }
    } catch (error) {
      console.error('Error loading domains:', error);
      toast.error('Không thể tải domains', {
        description: 'Vui lòng thử lại hoặc chọn dịch vụ khác'
      });
    } finally {
      setLoadingDomains(false);
    }
  };

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
          // No emails exist, auto-create one with default service
          toast.info('Đang tạo email mới...');
          try {
            const createResponse = await axios.post(`${API}/emails/create`, {
              service: selectedService
            });
            const newEmail = createResponse.data;
            
            setCurrentEmail(newEmail);
            setMessages([]);
            setSelectedMessage(null);
            
            toast.success('Email mới đã được tạo!', {
              description: `${newEmail.address} (${newEmail.service_name || newEmail.provider})`
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
          
          // Deduplicate by ID to prevent duplicate key errors
          const uniqueHistory = [];
          const seenIds = new Set();
          
          for (const email of historyResponse.data) {
            if (!seenIds.has(email.id)) {
              seenIds.add(email.id);
              uniqueHistory.push(email);
            } else {
              console.warn(`⚠️ Duplicate history email ID found and removed: ${email.id}`);
            }
          }
          
          setHistoryEmails(uniqueHistory);
        } catch (histErr) {
          console.error('Error loading history:', histErr);
        }
        
        // Load saved emails
        try {
          const savedResponse = await axios.get(`${API}/emails/saved/list`);
          
          // Deduplicate by ID to prevent duplicate key errors
          const uniqueSaved = [];
          const seenIds = new Set();
          
          for (const email of savedResponse.data) {
            if (!seenIds.has(email.id)) {
              seenIds.add(email.id);
              uniqueSaved.push(email);
            } else {
              console.warn(`⚠️ Duplicate saved email ID found and removed: ${email.id}`);
            }
          }
          
          setSavedEmails(uniqueSaved);
        } catch (savedErr) {
          console.error('Error loading saved emails:', savedErr);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        // If error getting emails, try to create one anyway
        try {
          toast.info('Đang tạo email mới...');
          const createResponse = await axios.post(`${API}/emails/create`, {
            service: selectedService
          });
          const newEmail = createResponse.data;
          
          setCurrentEmail(newEmail);
          setMessages([]);
          
          toast.success('Email mới đã được tạo!', {
            description: `${newEmail.address} (${newEmail.service_name || newEmail.provider})`
          });
        } catch (createErr) {
          toast.error('Không thể khởi tạo ứng dụng');
        }
      }
    };
    
    initializeApp();
  }, []);

  // Timer countdown - calculate from expires_at with auto-create on expiry
  useEffect(() => {
    if (currentEmail && currentEmail.expires_at && !currentEmail.isHistory) {
      // Reset flag when email changes
      if (lastEmailIdRef.current !== currentEmail.id) {
        isCreatingEmailRef.current = false;
        lastEmailIdRef.current = currentEmail.id;
      }
      
      const updateTimer = async () => {
        // CRITICAL FIX: Use UTC for both to avoid timezone mismatch
        const now = new Date();  // Local time
        const expiresAt = new Date(currentEmail.expires_at);  // Will parse with timezone
        const diffSeconds = Math.floor((expiresAt - now) / 1000);
        
        // Debug logging
        // console.log(`⏱️  Timer Update - Now: ${now.toISOString()}, Expires: ${expiresAt.toISOString()}, Diff: ${diffSeconds}s`);
        
        if (diffSeconds <= 0) {
          setTimeLeft(0);
          
          // Email expired, auto-create new email (only once using ref)
          if (!isCreatingEmailRef.current) {
            isCreatingEmailRef.current = true;
            console.log('⏰ Timer expired, auto-creating new email...');
            toast.info('⏰ Email đã hết hạn, đang tạo email mới tự động...');
            
            try {
              const response = await axios.post(`${API}/emails/create`, {
                service: selectedService
              });
              const newEmail = response.data;
              
              setCurrentEmail(newEmail);
              setMessages([]);
              setSelectedMessage(null);
              
              toast.success('✅ Email mới đã được tạo tự động!', {
                description: `${newEmail.address} (${newEmail.service_name || newEmail.provider})`,
                duration: 5000
              });
              
              // Reload history
              try {
                const historyResponse = await axios.get(`${API}/emails/history/list`);
                
                // Deduplicate by ID to prevent duplicate key errors
                const uniqueHistory = [];
                const seenIds = new Set();
                
                for (const email of historyResponse.data) {
                  if (!seenIds.has(email.id)) {
                    seenIds.add(email.id);
                    uniqueHistory.push(email);
                  } else {
                    console.warn(`⚠️ Duplicate history email ID found and removed: ${email.id}`);
                  }
                }
                
                setHistoryEmails(uniqueHistory);
              } catch (err) {
                console.error('Error reloading history:', err);
              }
            } catch (error) {
              console.error('Auto-create email error:', error);
              toast.error('Không thể tạo email mới tự động', {
                description: error.response?.data?.detail || 'Lỗi không xác định'
              });
              // Reset flag to allow retry
              isCreatingEmailRef.current = false;
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
      return () => {
        clearInterval(timer);
      };
    } else if (!currentEmail) {
      setTimeLeft(0);
    }
  }, [currentEmail?.id, currentEmail?.expires_at, currentEmail?.isHistory, selectedService]);

  // Auto refresh messages (Legacy polling - kept as backup or for history, but Socket handles live updates)
  // We can disable this if socket is active, but keeping it as fallback is safer.
  useEffect(() => {
    if (currentEmail?.id && autoRefresh && !currentEmail?.isHistory && !socketRef.current?.connected) {
      console.log('🔄 Auto-refresh enabled (Fallback Mode) for email:', currentEmail.address);
      
      const interval = setInterval(() => {
        if (currentEmail?.id) {
          console.log('🔄 Auto-refreshing messages...');
          refreshMessages(currentEmail.id, false); // Silent refresh (no toast)
        }
      }, 30000); // 30 seconds
      
      return () => {
        clearInterval(interval);
      };
    }
  }, [currentEmail?.id, currentEmail?.isHistory, autoRefresh]);

  // Reset view mode when changing tabs
  useEffect(() => {
    setViewMode('list');
    setSelectedMessage(null);
    setSavedMessageDetail(null);
    setHistoryMessages([]);
  }, [activeTab]);

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
      console.log('📜 Loaded history emails:', response.data);
      
      // Deduplicate by ID to prevent duplicate key errors
      const uniqueHistory = [];
      const seenIds = new Set();
      
      for (const email of response.data) {
        if (!seenIds.has(email.id)) {
          seenIds.add(email.id);
          uniqueHistory.push(email);
        } else {
          console.warn(`⚠️ Duplicate history email ID found and removed: ${email.id}`);
        }
      }
      
      setHistoryEmails(uniqueHistory);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const createNewEmail = async () => {
    setLoading(true);
    try {
      // Delete old email first if exists (don't save to history, just delete)
      if (currentEmail?.id) {
        try {
          await axios.delete(`${API}/emails/${currentEmail.id}`);
          console.log('🗑️ Deleted old email:', currentEmail.address);
        } catch (deleteError) {
          console.warn('⚠️ Could not delete old email:', deleteError);
          // Continue anyway to create new email
        }
      }
      
      const payload = {
        service: selectedService
      };
      
      // Always include selected domain to ensure correct email creation
      if (selectedDomain) {
        payload.domain = selectedDomain;
      }
      
      const response = await axios.post(`${API}/emails/create`, payload);
      const newEmail = response.data;
      
      setCurrentEmail(newEmail);
      setMessages([]);
      setSelectedMessage(null);
      setShowServiceForm(false); // Hide form after creation
      
      // CRITICAL FIX: Reset the creating email ref so timer works correctly
      isCreatingEmailRef.current = false;
      lastEmailIdRef.current = newEmail.id;
      
      toast.success('Email mới đã được tạo!', {
        description: `${newEmail.address} - Timer: 10 phút`
      });
      
      // Don't reload history since we deleted the old email instead of moving it
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
      
      // CRITICAL FIX: Reset the creating email ref to prevent auto-recreation
      isCreatingEmailRef.current = false;
      
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

  const saveCurrentEmail = async () => {
    if (!currentEmail) {
      toast.error('Không có email để lưu');
      return;
    }
    
    setLoading(true);
    try {
      // Check if already saved
      const alreadySaved = savedEmails.some(email => email.id === currentEmail.id);
      if (alreadySaved) {
        toast.warning('Email này đã được lưu rồi!');
        setLoading(false);
        return;
      }
      
      // Call backend API to save email
      const response = await axios.post(`${API}/emails/${currentEmail.id}/save`);
      
      // Update local state
      setSavedEmails(prev => [response.data, ...prev]);
      
      toast.success('✅ Đã lưu email thành công!');
    } catch (error) {
      toast.error('Không thể lưu email', {
        description: error.response?.data?.detail || 'Lỗi không xác định'
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshMessages = async (emailId, showToast = true) => {
    if (!emailId) {
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
    try {
      const response = await axios.get(`${API}/emails/history/${email.id}/messages`);
      setHistoryMessages(response.data.messages);
      setSelectedHistoryEmail(email);
      setViewMode('detail');
      setActiveTab('history');
    } catch (error) {
      toast.error('Không thể tải tin nhắn từ lịch sử');
    }
  };

  const toggleHistorySelection = (emailId) => {
    setSelectedHistoryIds(prev => {
      // Prevent duplicate selections
      const newSelection = prev.includes(emailId)
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId];
      
      console.log('Toggle History Selection:', {
        emailId,
        prevSelected: prev,
        newSelected: newSelection
      });
      
      return newSelection;
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

  // Saved emails functions
  const loadSavedEmails = async () => {
    try {
      const response = await axios.get(`${API}/emails/saved/list`);
      console.log('📧 Loaded saved emails:', response.data);
      
      // Deduplicate by ID to prevent duplicate key errors
      const uniqueSaved = [];
      const seenIds = new Set();
      
      for (const email of response.data) {
        if (!seenIds.has(email.id)) {
          seenIds.add(email.id);
          uniqueSaved.push(email);
        } else {
          console.warn(`⚠️ Duplicate saved email ID found and removed: ${email.id}`);
        }
      }
      
      setSavedEmails(uniqueSaved);
    } catch (error) {
      console.error('Error loading saved emails:', error);
    }
  };

  const saveCurrentMessage = async () => {
    if (!currentEmail || !selectedMessage) {
      toast.warning('Không có email nào được chọn');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/emails/${currentEmail.id}/messages/${selectedMessage.id}/save`
      );
      
      if (response.data.status === 'already_saved') {
        toast.info('Email đã được lưu trước đó');
      } else {
        toast.success('Email đã được lưu thành công! ✅');
        await loadSavedEmails();
      }
    } catch (error) {
      toast.error('Không thể lưu email', {
        description: error.response?.data?.detail || 'Lỗi không xác định'
      });
    } finally {
      setLoading(false);
    }
  };

  const viewSavedEmail = async (saved) => {
    try {
      const response = await axios.get(`${API}/emails/saved/${saved.id}`);
      setSavedMessageDetail(response.data);
      setSelectedSavedEmail(saved);
      setViewMode('detail');
      setActiveTab('saved');
    } catch (error) {
      toast.error('Không thể tải email đã lưu');
    }
  };

  const selectHistoryMessage = async (message) => {
    if (!selectedHistoryEmail) return;
    
    try {
      const response = await axios.get(
        `${API}/emails/history/${selectedHistoryEmail.id}/messages/${message.id}`
      );
      setSelectedMessage(response.data);
    } catch (error) {
      toast.error('Không thể tải chi tiết tin nhắn');
    }
  };

  const toggleSavedSelection = (emailId) => {
    setSelectedSavedIds(prev => {
      // Prevent duplicate selections
      const newSelection = prev.includes(emailId)
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId];
      
      console.log('Toggle Saved Selection:', {
        emailId,
        prevSelected: prev,
        newSelected: newSelection
      });
      
      return newSelection;
    });
  };

  const toggleSelectAllSaved = () => {
    if (selectedSavedIds.length === savedEmails.length) {
      setSelectedSavedIds([]);
    } else {
      setSelectedSavedIds(savedEmails.map(e => e.id));
    }
  };

  const deleteSelectedSaved = async () => {
    if (selectedSavedIds.length === 0) {
      toast.warning('Chưa chọn email nào');
      return;
    }

    setLoading(true);
    try {
      await axios.delete(`${API}/emails/saved/delete`, {
        data: { ids: selectedSavedIds }
      });
      
      toast.success(`Đã xóa ${selectedSavedIds.length} email`);
      setSelectedSavedIds([]);
      await loadSavedEmails();
    } catch (error) {
      toast.error('Không thể xóa email đã chọn');
    } finally {
      setLoading(false);
    }
  };

  // Render functions...
  // (I'm keeping the render logic mostly same but adding the Notification button)

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
        <Toaster position="top-right" expand={true} richColors />
        
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          {/* Header */}
          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">TempMail</h1>
                <p className="text-sm text-muted-foreground">An toàn • Nhanh chóng • Bảo mật</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={requestNotificationPermission}
                title={notificationsEnabled ? "Thông báo đang bật" : "Bật thông báo"}
              >
                {notificationsEnabled ? <Bell className="w-5 h-5 text-green-500" /> : <BellOff className="w-5 h-5" />}
              </Button>
              <ThemeToggle />
            </div>
          </header>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
              <TabsTrigger value="current" className="gap-2">
                <Inbox className="w-4 h-4" /> Hộp thư
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="w-4 h-4" /> Lịch sử
              </TabsTrigger>
              <TabsTrigger value="saved" className="gap-2">
                <Bookmark className="w-4 h-4" /> Đã lưu
              </TabsTrigger>
            </TabsList>

            {/* Current Email Tab */}
            <TabsContent value="current" className="space-y-6 animate-in fade-in-50 duration-500">
              <div className="grid gap-6 lg:grid-cols-12">
                {/* Left Column: Email Info */}
                <div className="lg:col-span-4 space-y-6">
                  <Card className="border-primary/20 shadow-lg">
                    <CardContent className="p-6 space-y-6">
                      <div className="text-center space-y-2">
                        <h2 className="text-xl font-semibold">{heroTitle}</h2>
                        <p className="text-sm text-muted-foreground">
                          Email sẽ tự động hủy sau 10 phút
                        </p>
                      </div>

                      {/* Email Box */}
                      <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-lg blur opacity-30 group-hover:opacity-75 transition duration-1000"></div>
                        <div className="relative bg-card border rounded-lg p-4 flex flex-col gap-3">
                          {loading ? (
                            <div className="flex items-center justify-center py-4">
                              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                            </div>
                          ) : currentEmail ? (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <code className="text-lg font-mono font-medium break-all text-primary">
                                  {currentEmail.address}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 hover:bg-primary/10 hover:text-primary"
                                  onClick={() => {
                                    navigator.clipboard.writeText(currentEmail.address);
                                    toast.success('Đã copy email!');
                                  }}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                              <Separator />
                              <div className="flex items-center justify-between text-sm">
                                <div className={`flex items-center gap-2 font-medium ${timeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`}>
                                  <Clock className="w-4 h-4" />
                                  <span className="tabular-nums text-lg">{formatTime(timeLeft)}</span>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addTime} title="Gia hạn (+10p)">
                                    <RefreshCw className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={deleteCurrentEmail} title="Xóa email">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-center py-2 text-muted-foreground">
                              Chưa có email nào
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="grid grid-cols-2 gap-3">
                        <Button 
                          variant="outline" 
                          className="w-full gap-2"
                          onClick={() => setShowServiceForm(!showServiceForm)}
                        >
                          <Edit className="w-4 h-4" /> Tùy chọn
                        </Button>
                        <Button 
                          variant="secondary" 
                          className="w-full gap-2"
                          onClick={saveCurrentEmail}
                          disabled={!currentEmail}
                        >
                          <Bookmark className="w-4 h-4" /> Lưu Email
                        </Button>
                        <Button 
                          className="w-full col-span-2 gap-2" 
                          size="lg"
                          onClick={createNewEmail}
                          disabled={loading}
                        >
                          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          Tạo Email Mới
                        </Button>
                      </div>

                      {/* Service Selection Form */}
                      {showServiceForm && (
                        <div className="p-4 bg-muted/50 rounded-lg space-y-4 animate-in slide-in-from-top-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Chọn nhà cung cấp:</label>
                            <div className="grid grid-cols-2 gap-2">
                              {['auto', 'mailtm', 'mailgw', '1secmail', 'guerrilla'].map(s => (
                                <Button
                                  key={s}
                                  variant={selectedService === s ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setSelectedService(s)}
                                  className="capitalize"
                                >
                                  {s === 'auto' ? 'Tự động' : s}
                                </Button>
                              ))}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Chọn tên miền:</label>
                            <select 
                              className="w-full p-2 rounded-md border bg-background text-sm"
                              value={selectedDomain}
                              onChange={(e) => setSelectedDomain(e.target.value)}
                              disabled={loadingDomains}
                            >
                              {loadingDomains ? (
                                <option>Đang tải...</option>
                              ) : availableDomains.length > 0 ? (
                                availableDomains.map(d => (
                                  <option key={d} value={d}>{d}</option>
                                ))
                              ) : (
                                <option value="">Tự động chọn</option>
                              )}
                            </select>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Stats / Info */}
                  <Card>
                    <CardContent className="p-4 text-sm space-y-2 text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Trạng thái:</span>
                        <span className="text-green-500 font-medium flex items-center gap-1">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                          Hoạt động
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Server:</span>
                        <span className="font-medium uppercase">{currentEmail?.service_name || currentEmail?.provider || 'Auto'}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Messages */}
                <div className="lg:col-span-8">
                  <Card className="h-full min-h-[500px] flex flex-col shadow-md">
                    <div className="p-4 border-b flex items-center justify-between bg-muted/30">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Inbox className="w-5 h-5 text-primary" />
                        Hộp thư đến
                        <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                          {messages.length}
                        </span>
                      </h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => currentEmail && refreshMessages(currentEmail.id)}
                        disabled={refreshing || !currentEmail}
                      >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Làm mới
                      </Button>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                      {/* Message List */}
                      <div className={`${selectedMessage ? 'hidden md:block w-1/3 border-r' : 'w-full'} flex flex-col bg-background`}>
                        <ScrollArea className="flex-1">
                          {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground p-8 text-center">
                              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                <Mail className="w-8 h-8 opacity-50" />
                              </div>
                              <p className="font-medium">Chưa có tin nhắn nào</p>
                              <p className="text-sm mt-1">Email mới sẽ tự động xuất hiện ở đây</p>
                            </div>
                          ) : (
                            <div className="divide-y">
                              {messages.map((msg) => (
                                <div
                                  key={msg.id}
                                  onClick={() => selectMessage(msg)}
                                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedMessage?.id === msg.id ? 'bg-muted border-l-4 border-primary' : ''}`}
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-semibold truncate pr-2 flex-1">
                                      {msg.from.name || msg.from.address || msg.from}
                                    </span>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium truncate mb-1 text-foreground/90">
                                    {msg.subject || '(Không có tiêu đề)'}
                                  </p>
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {msg.intro || '...'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>

                      {/* Message Detail */}
                      {selectedMessage ? (
                        <div className={`${selectedMessage ? 'w-full md:w-2/3' : 'hidden'} flex flex-col h-full bg-card`}>
                          <div className="p-4 border-b flex items-center justify-between">
                            <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setSelectedMessage(null)}>
                              ← Quay lại
                            </Button>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={saveCurrentMessage} title="Lưu tin nhắn này">
                                <Bookmark className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <ScrollArea className="flex-1 p-6">
                            <div className="space-y-6">
                              <div>
                                <h2 className="text-xl font-bold mb-2">{selectedMessage.subject}</h2>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                    {(selectedMessage.from.name || selectedMessage.from.address || '?')[0].toUpperCase()}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-foreground font-medium">
                                      {selectedMessage.from.name || selectedMessage.from.address} 
                                      <span className="text-xs font-normal text-muted-foreground ml-1">
                                        &lt;{selectedMessage.from.address}&gt;
                                      </span>
                                    </p>
                                    <p className="text-xs">
                                      Tới: {currentEmail?.address} • {new Date(selectedMessage.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <Separator />
                              <div className="prose dark:prose-invert max-w-none">
                                {selectedMessage.html ? (
                                  <div dangerouslySetInnerHTML={{ __html: selectedMessage.html[0] }} />
                                ) : (
                                  <pre className="whitespace-pre-wrap font-sans text-sm">
                                    {selectedMessage.text}
                                  </pre>
                                )}
                              </div>
                              
                              {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                                <div className="pt-4">
                                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                                    Đính kèm ({selectedMessage.attachments.length})
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedMessage.attachments.map((att, i) => (
                                      <a 
                                        key={i} 
                                        href={`${API}/emails/${currentEmail.id}/messages/${selectedMessage.id}/attachment/${att.id}`} // Hypothetical endpoint
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs bg-muted px-3 py-2 rounded-md hover:bg-muted/80 transition-colors flex items-center gap-2 border"
                                      >
                                        📄 {att.filename} <span className="opacity-50">({Math.round(att.size / 1024)}KB)</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      ) : (
                        <div className="hidden md:flex w-2/3 items-center justify-center text-muted-foreground bg-muted/10">
                          <div className="text-center">
                            <Mail className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>Chọn một tin nhắn để đọc</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="animate-in fade-in-50 duration-500">
              <Card>
                <CardContent className="p-6">
                  {viewMode === 'list' ? (
                    <>
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                          <History className="w-5 h-5" /> Lịch sử Email
                        </h2>
                        <div className="flex gap-2">
                          {selectedHistoryIds.length > 0 && (
                            <Button variant="destructive" size="sm" onClick={deleteSelectedHistory}>
                              <Trash2 className="w-4 h-4 mr-2" /> Xóa ({selectedHistoryIds.length})
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={deleteAllHistory}>
                            Xóa tất cả
                          </Button>
                        </div>
                      </div>

                      {historyEmails.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                          <p>Chưa có lịch sử email nào</p>
                        </div>
                      ) : (
                        <div className="rounded-md border">
                          <div className="grid grid-cols-12 gap-4 p-4 bg-muted/50 font-medium text-sm border-b">
                            <div className="col-span-1 flex items-center justify-center">
                              <input 
                                type="checkbox" 
                                className="rounded border-gray-300"
                                checked={selectedHistoryIds.length === historyEmails.length && historyEmails.length > 0}
                                onChange={toggleSelectAll}
                              />
                            </div>
                            <div className="col-span-5">Email</div>
                            <div className="col-span-2">Service</div>
                            <div className="col-span-2">Tin nhắn</div>
                            <div className="col-span-2 text-right">Thời gian</div>
                          </div>
                          <div className="divide-y">
                            {historyEmails.map((email) => (
                              <div key={email.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 transition-colors text-sm">
                                <div className="col-span-1 flex items-center justify-center">
                                  <input 
                                    type="checkbox" 
                                    className="rounded border-gray-300"
                                    checked={selectedHistoryIds.includes(email.id)}
                                    onChange={() => toggleHistorySelection(email.id)}
                                  />
                                </div>
                                <div className="col-span-5 font-mono truncate cursor-pointer text-primary hover:underline" onClick={() => viewHistoryEmail(email)}>
                                  {email.address}
                                </div>
                                <div className="col-span-2 uppercase text-xs font-semibold text-muted-foreground">
                                  {email.service || email.provider}
                                </div>
                                <div className="col-span-2 text-muted-foreground">
                                  {email.message_count || 0}
                                </div>
                                <div className="col-span-2 text-right text-muted-foreground text-xs">
                                  {new Date(email.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    // History Detail View
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 mb-4">
                        <Button variant="outline" onClick={() => setViewMode('list')}>← Quay lại</Button>
                        <div>
                          <h2 className="text-xl font-bold">{selectedHistoryEmail?.address}</h2>
                          <p className="text-sm text-muted-foreground">Lịch sử tin nhắn</p>
                        </div>
                      </div>
                      
                      <div className="grid md:grid-cols-3 gap-6 h-[600px]">
                        <Card className="md:col-span-1 overflow-hidden flex flex-col">
                          <div className="p-3 bg-muted border-b font-medium">Danh sách tin nhắn</div>
                          <ScrollArea className="flex-1">
                            {historyMessages.length === 0 ? (
                              <div className="p-8 text-center text-muted-foreground">Không có tin nhắn nào</div>
                            ) : (
                              <div className="divide-y">
                                {historyMessages.map(msg => (
                                  <div 
                                    key={msg.id} 
                                    className={`p-3 cursor-pointer hover:bg-muted/50 ${selectedMessage?.id === msg.id ? 'bg-muted' : ''}`}
                                    onClick={() => selectHistoryMessage(msg)}
                                  >
                                    <div className="font-medium truncate">{msg.from}</div>
                                    <div className="text-xs text-muted-foreground truncate">{msg.subject}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </Card>
                        
                        <Card className="md:col-span-2 overflow-hidden flex flex-col">
                          {selectedMessage ? (
                            <ScrollArea className="flex-1 p-6">
                              <h3 className="text-lg font-bold mb-2">{selectedMessage.subject}</h3>
                              <div className="text-sm text-muted-foreground mb-4 pb-4 border-b">
                                From: {selectedMessage.from} <br/>
                                Date: {new Date(selectedMessage.createdAt).toLocaleString()}
                              </div>
                              <div className="prose dark:prose-invert max-w-none">
                                {selectedMessage.html ? (
                                  <div dangerouslySetInnerHTML={{ __html: selectedMessage.html[0] }} />
                                ) : (
                                  <pre className="whitespace-pre-wrap font-sans">{selectedMessage.text}</pre>
                                )}
                              </div>
                            </ScrollArea>
                          ) : (
                            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                              Chọn tin nhắn để xem
                            </div>
                          )}
                        </Card>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Saved Emails Tab */}
            <TabsContent value="saved" className="animate-in fade-in-50 duration-500">
              <Card>
                <CardContent className="p-6">
                  {viewMode === 'list' ? (
                    <>
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                          <Bookmark className="w-5 h-5" /> Email Đã Lưu
                        </h2>
                        <div className="flex gap-2">
                          {selectedSavedIds.length > 0 && (
                            <Button variant="destructive" size="sm" onClick={deleteSelectedSaved}>
                              <Trash2 className="w-4 h-4 mr-2" /> Xóa ({selectedSavedIds.length})
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={toggleSelectAllSaved}>
                            {selectedSavedIds.length === savedEmails.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                          </Button>
                        </div>
                      </div>

                      {savedEmails.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-20" />
                          <p>Chưa có email nào được lưu</p>
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {savedEmails.map((email) => (
                            <Card key={email.id} className={`cursor-pointer hover:border-primary transition-colors ${selectedSavedIds.includes(email.id) ? 'border-primary bg-primary/5' : ''}`}>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <input 
                                    type="checkbox" 
                                    className="mt-1 rounded border-gray-300"
                                    checked={selectedSavedIds.includes(email.id)}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      toggleSavedSelection(email.id);
                                    }}
                                  />
                                  <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                    {new Date(email.saved_at).toLocaleDateString()}
                                  </div>
                                </div>
                                <div onClick={() => viewSavedEmail(email)}>
                                  <h3 className="font-semibold truncate mb-1" title={email.subject}>
                                    {email.subject || '(No Subject)'}
                                  </h3>
                                  <p className="text-sm text-muted-foreground truncate mb-2">
                                    From: {email.from_name || email.from_address}
                                  </p>
                                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded truncate">
                                    {email.email_address}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    // Saved Detail View
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 mb-4">
                        <Button variant="outline" onClick={() => setViewMode('list')}>← Quay lại</Button>
                        <h2 className="text-xl font-bold">Chi tiết Email đã lưu</h2>
                      </div>
                      
                      {savedMessageDetail && (
                        <Card>
                          <CardContent className="p-6 space-y-6">
                            <div>
                              <h1 className="text-2xl font-bold mb-2">{savedMessageDetail.subject}</h1>
                              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pb-4 border-b">
                                <div>From: <span className="text-foreground font-medium">{savedMessageDetail.from_name} &lt;{savedMessageDetail.from_address}&gt;</span></div>
                                <div>To: <span className="text-foreground font-medium">{savedMessageDetail.email_address}</span></div>
                                <div>Date: {new Date(savedMessageDetail.saved_at).toLocaleString()}</div>
                              </div>
                            </div>
                            
                            <div className="prose dark:prose-invert max-w-none min-h-[300px]">
                              {savedMessageDetail.html ? (
                                <div dangerouslySetInnerHTML={{ __html: savedMessageDetail.html }} />
                              ) : (
                                <pre className="whitespace-pre-wrap font-sans">{savedMessageDetail.text}</pre>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
