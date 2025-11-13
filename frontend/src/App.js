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
  Clock, Edit, Inbox, History, Server, Bookmark
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
  
  // Refs to prevent race conditions
  const isCreatingEmailRef = useRef(false);
  const lastEmailIdRef = useRef(null);

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

  // Load emails on mount (NO auto-create)
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
          // No emails exist - user must create manually
          console.log('No existing emails found. User must create manually.');
          setCurrentEmail(null);
          setMessages([]);
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
        // Just show empty state, no auto-create
        setCurrentEmail(null);
        setMessages([]);
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
        console.log(`⏱️  Timer Update - Now: ${now.toISOString()}, Expires: ${expiresAt.toISOString()}, Diff: ${diffSeconds}s`);
        
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

  // Auto refresh messages every 30 seconds (silent mode)
  useEffect(() => {
    if (currentEmail?.id && autoRefresh && !currentEmail?.isHistory) {
      console.log('🔄 Auto-refresh enabled for email:', currentEmail.address);
      
      const interval = setInterval(() => {
        if (currentEmail?.id) {
          console.log('🔄 Auto-refreshing messages...');
          refreshMessages(currentEmail.id, false); // Silent refresh (no toast)
        }
      }, 30000); // 30 seconds
      
      return () => {
        console.log('🛑 Auto-refresh cleanup');
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

  const deleteAllSaved = async () => {
    if (savedEmails.length === 0) {
      toast.warning('Danh sách trống');
      return;
    }

    setLoading(true);
    try {
      await axios.delete(`${API}/emails/saved/delete`, {
        data: { ids: null }
      });
      
      toast.success('Đã xóa tất cả email đã lưu');
      setSelectedSavedIds([]);
      setSavedEmails([]);
    } catch (error) {
      toast.error('Không thể xóa tất cả email đã lưu');
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

  const getServiceDisplayName = (provider) => {
    const serviceMap = {
      'mailtm': 'Mail.tm',
      'mailgw': 'Mail.gw',
      '1secmail': '1secmail',
      'tempmail_lol': 'TempMail.lol'
    };
    return serviceMap[provider] || provider;
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
              <TabsTrigger value="saved" className="tab-trigger-new">
                <Bookmark className="h-4 w-4 mr-2" />
                Mail đã lưu ({savedEmails.length})
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
                    <h2 className="hero-title">{heroTitle}</h2>
                    <p className="hero-description">
                      Tránh thư rác, bảo vệ quyền riêng tư của bạn một cách dễ dàng
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
                      {/* Service Badge */}
                      {currentEmail.provider && (
                        <div className="service-badge">
                          <Server className="h-3 w-3" />
                          {getServiceDisplayName(currentEmail.provider)}
                        </div>
                      )}
                    </div>

                    {/* Service Selection Form (Always Visible) */}
                    <div className="service-selection-form">
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Dịch vụ email</label>
                          <select
                            className="form-select"
                            value={selectedService}
                            onChange={(e) => setSelectedService(e.target.value)}
                            disabled={loading}
                          >
                            <option value="auto">🎲Random</option>
                            <option value="mailtm">Mail.tm</option>
                            <option value="1secmail">1secmail</option>
                            <option value="mailgw">Mail.gw</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Domain</label>
                          <select
                            className="form-select"
                            value={selectedDomain}
                            onChange={(e) => setSelectedDomain(e.target.value)}
                            disabled={loading || loadingDomains}
                          >
                            {loadingDomains ? (
                              <option>Đang tải...</option>
                            ) : (
                              availableDomains.map(domain => (
                                <option key={domain} value={domain}>{domain}</option>
                              ))
                            )}
                          </select>
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
                        Tạo email mới
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
                      <Button
                        onClick={saveCurrentEmail}
                        className="action-btn action-btn-save"
                        variant="default"
                        disabled={loading || currentEmail?.isHistory}
                      >
                        <Bookmark className="h-5 w-5 mr-2" />
                        Lưu
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
                        <div className="message-detail-header">
                          <Button
                            variant="ghost"
                            onClick={() => setSelectedMessage(null)}
                            className="back-btn"
                          >
                            ← Quay lại
                          </Button>
                          <Button
                            variant="outline"
                            onClick={saveCurrentMessage}
                            disabled={loading}
                            className="save-btn"
                          >
                            <Bookmark className="h-4 w-4 mr-2" />
                            Lưu email này
                          </Button>
                        </div>
                        
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
                                {(() => {
                                  // Enhanced HTML content rendering with better error handling
                                  const htmlContent = selectedMessage.html;
                                  
                                  // Check if content exists and is not empty
                                  if (!htmlContent) {
                                    return <p className="no-content">Không có nội dung HTML</p>;
                                  }
                                  
                                  // Handle array format
                                  if (Array.isArray(htmlContent)) {
                                    const content = htmlContent[0];
                                    if (content && typeof content === 'string' && content.trim()) {
                                      return (
                                        <div
                                          className="html-content"
                                          dangerouslySetInnerHTML={{ __html: content }}
                                        />
                                      );
                                    }
                                  }
                                  
                                  // Handle string format
                                  if (typeof htmlContent === 'string' && htmlContent.trim()) {
                                    return (
                                      <div
                                        className="html-content"
                                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                                      />
                                    );
                                  }
                                  
                                  // No valid content found
                                  return <p className="no-content">Không có nội dung HTML</p>;
                                })()}
                              </TabsContent>
                              <TabsContent value="text" className="message-content">
                                {(() => {
                                  // Enhanced text content rendering
                                  const textContent = selectedMessage.text;
                                  
                                  // Check if content exists and is not empty
                                  if (!textContent) {
                                    return <p className="no-content">Không có nội dung text</p>;
                                  }
                                  
                                  // Handle array format
                                  if (Array.isArray(textContent)) {
                                    const content = textContent[0];
                                    if (content && typeof content === 'string' && content.trim()) {
                                      return <div className="text-content">{content}</div>;
                                    }
                                  }
                                  
                                  // Handle string format
                                  if (typeof textContent === 'string' && textContent.trim()) {
                                    return <div className="text-content">{textContent}</div>;
                                  }
                                  
                                  // No valid content found
                                  return <p className="no-content">Không có nội dung text</p>;
                                })()}
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
                  <Button onClick={() => setShowServiceForm(true)} disabled={loading} className="create-btn-large">
                    <Mail className="h-5 w-5 mr-2" />
                    Tạo email mới
                  </Button>
                  
                  {/* Service Selection Form */}
                  {showServiceForm && (
                    <div className="service-selection-form" style={{marginTop: '2rem', maxWidth: '500px'}}>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Dịch vụ email</label>
                          <select
                            className="form-select"
                            value={selectedService}
                            onChange={(e) => setSelectedService(e.target.value)}
                            disabled={loading}
                          >
                            <option value="auto">🎲Random</option>
                            <option value="mailtm">Mail.tm</option>
                            <option value="1secmail">1secmail</option>
                            <option value="mailgw">Mail.gw</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Domain</label>
                          <select
                            className="form-select"
                            value={selectedDomain}
                            onChange={(e) => setSelectedDomain(e.target.value)}
                            disabled={loading || loadingDomains}
                          >
                            {loadingDomains ? (
                              <option>Đang tải...</option>
                            ) : (
                              availableDomains.map(domain => (
                                <option key={domain} value={domain}>{domain}</option>
                              ))
                            )}
                          </select>
                        </div>
                      </div>
                      <div style={{marginTop: '1rem', display: 'flex', gap: '0.5rem'}}>
                        <Button onClick={createNewEmail} disabled={loading} className="create-btn-large" style={{flex: 1}}>
                          Tạo email
                        </Button>
                        <Button onClick={() => setShowServiceForm(false)} variant="outline" style={{flex: 1}}>
                          Hủy
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Saved Emails Tab */}
            <TabsContent value="saved" className="tab-content-new">
              {viewMode === 'list' || activeTab !== 'saved' ? (
                <div className="history-section">
                  <div className="history-header">
                    <h2 className="history-title">Mail đã lưu</h2>
                    {savedEmails.length > 0 && (
                      <div className="history-actions">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={toggleSelectAllSaved}
                          className="select-all-btn"
                        >
                          {selectedSavedIds.length === savedEmails.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={deleteSelectedSaved}
                          disabled={selectedSavedIds.length === 0 || loading}
                          className="delete-selected-btn"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Xóa đã chọn ({selectedSavedIds.length})
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={deleteAllSaved}
                          disabled={loading}
                          className="delete-all-btn"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Xóa tất cả
                        </Button>
                      </div>
                    )}
                  </div>

                  {savedEmails.length === 0 ? (
                    <div className="empty-state">
                      <Bookmark className="empty-icon" />
                      <h4 className="empty-title">Chưa có email đã lưu</h4>
                      <p className="empty-description">Click nút "Lưu" khi xem email để lưu lại</p>
                    </div>
                  ) : (
                    <ScrollArea className="history-list">
                      {savedEmails.map((email, index) => (
                        <Card 
                          key={`saved-${email.id}-${index}`} 
                          className={`history-card ${selectedSavedIds.includes(email.id) ? 'selected' : ''}`}
                        >
                          <CardContent className="history-card-content">
                            <input
                              type="checkbox"
                              checked={selectedSavedIds.includes(email.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleSavedSelection(email.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="history-checkbox"
                            />
                            <div 
                              className="history-info"
                              onClick={() => viewSavedEmail(email)}
                            >
                              <Bookmark className="h-5 w-5 history-icon" />
                              <div className="history-details">
                                <p className="history-address">{email.subject || 'Không có tiêu đề'}</p>
                                <span className="history-time">
                                  Từ: {email.from?.name || email.from?.address}
                                </span>
                                <span className="history-time">
                                  Lưu lúc: {getTimeAgo(email.saved_at)}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </ScrollArea>
                  )}
                </div>
              ) : (
                <div className="message-detail">
                  <div className="message-detail-header">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setViewMode('list');
                        setSavedMessageDetail(null);
                        setSelectedSavedEmail(null);
                      }}
                      className="back-btn"
                    >
                      ← Quay lại danh sách
                    </Button>
                  </div>
                  
                  {savedMessageDetail && (
                    <Card className="detail-card">
                      <CardContent className="detail-content">
                        <div className="detail-header">
                          <h3 className="detail-subject">{savedMessageDetail.subject}</h3>
                          <div className="detail-meta">
                            <div className="meta-row">
                              <span className="meta-label">Từ:</span>
                              <span className="meta-value">
                                {savedMessageDetail.from?.name} ({savedMessageDetail.from?.address})
                              </span>
                            </div>
                            <div className="meta-row">
                              <span className="meta-label">Ngày:</span>
                              <span className="meta-value">
                                {new Date(savedMessageDetail.createdAt).toLocaleString('vi-VN')}
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
                            {savedMessageDetail.html && Array.isArray(savedMessageDetail.html) && 
                             savedMessageDetail.html.length > 0 && savedMessageDetail.html[0] ? (
                              <div className="html-content" dangerouslySetInnerHTML={{ __html: savedMessageDetail.html[0] }} />
                            ) : savedMessageDetail.html && typeof savedMessageDetail.html === 'string' && 
                               savedMessageDetail.html.trim() ? (
                              <div className="html-content" dangerouslySetInnerHTML={{ __html: savedMessageDetail.html }} />
                            ) : (
                              <p className="no-content">Không có nội dung HTML</p>
                            )}
                          </TabsContent>
                          <TabsContent value="text" className="message-content">
                            {savedMessageDetail.text && Array.isArray(savedMessageDetail.text) && 
                             savedMessageDetail.text.length > 0 && savedMessageDetail.text[0] ? (
                              <pre className="text-content">{savedMessageDetail.text[0]}</pre>
                            ) : savedMessageDetail.text && typeof savedMessageDetail.text === 'string' && 
                               savedMessageDetail.text.trim() ? (
                              <pre className="text-content">{savedMessageDetail.text}</pre>
                            ) : (
                              <p className="no-content">Không có nội dung văn bản</p>
                            )}
                          </TabsContent>
                        </Tabs>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="tab-content-new">
              {viewMode === 'list' || activeTab !== 'history' ? (
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
                      {historyEmails.map((email, index) => (
                        <Card 
                          key={`history-${email.id}-${index}`} 
                          className={`history-card ${selectedHistoryIds.includes(email.id) ? 'selected' : ''}`}
                        >
                          <CardContent className="history-card-content">
                            <input
                              type="checkbox"
                              checked={selectedHistoryIds.includes(email.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleHistorySelection(email.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="history-checkbox"
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
              ) : (
                <div className="messages-section">
                  <div className="messages-header">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setViewMode('list');
                        setHistoryMessages([]);
                        setSelectedHistoryEmail(null);
                        setSelectedMessage(null);
                      }}
                      className="back-btn"
                    >
                      ← Quay lại danh sách
                    </Button>
                    <h3 className="messages-title">
                      Tin nhắn: {selectedHistoryEmail?.address}
                    </h3>
                  </div>

                  {!selectedMessage ? (
                    <div className="inbox-area">
                      {historyMessages.length === 0 ? (
                        <div className="empty-state">
                          <Mail className="empty-icon" />
                          <h4 className="empty-title">Không có tin nhắn</h4>
                          <p className="empty-description">Email này không có tin nhắn nào</p>
                        </div>
                      ) : (
                        <ScrollArea className="messages-list">
                          {historyMessages.map((msg) => (
                            <Card
                              key={msg.id}
                              className="message-card"
                              onClick={() => selectHistoryMessage(msg)}
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
                      <div className="message-detail-header">
                        <Button
                          variant="ghost"
                          onClick={() => setSelectedMessage(null)}
                          className="back-btn"
                        >
                          ← Quay lại danh sách tin nhắn
                        </Button>
                      </div>
                      
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
                              {selectedMessage.html && Array.isArray(selectedMessage.html) && 
                               selectedMessage.html.length > 0 && selectedMessage.html[0] ? (
                                <div className="html-content" dangerouslySetInnerHTML={{ __html: selectedMessage.html[0] }} />
                              ) : selectedMessage.html && typeof selectedMessage.html === 'string' && 
                                 selectedMessage.html.trim() ? (
                                <div className="html-content" dangerouslySetInnerHTML={{ __html: selectedMessage.html }} />
                              ) : (
                                <p className="no-content">Không có nội dung HTML</p>
                              )}
                            </TabsContent>
                            <TabsContent value="text" className="message-content">
                              {selectedMessage.text && Array.isArray(selectedMessage.text) && 
                               selectedMessage.text.length > 0 && selectedMessage.text[0] ? (
                                <pre className="text-content">{selectedMessage.text[0]}</pre>
                              ) : selectedMessage.text && typeof selectedMessage.text === 'string' && 
                                 selectedMessage.text.trim() ? (
                                <pre className="text-content">{selectedMessage.text}</pre>
                              ) : (
                                <p className="no-content">Không có nội dung văn bản</p>
                              )}
                            </TabsContent>
                          </Tabs>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
