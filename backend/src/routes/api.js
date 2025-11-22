const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { providerStats, DOMAIN_CACHE_TTL } = require('../utils/cache');

// Root endpoint
router.get('/', (req, res) => {
  const now = Date.now() / 1000;
  const stats = {};

  for (const [provider, data] of Object.entries(providerStats)) {
    const cooldownUntil = data.cooldown_until || 0;
    let status = 'active';
    if (now < cooldownUntil) {
      status = `cooldown (${Math.floor(cooldownUntil - now)}s remaining)`;
    }

    const total = (data.success || 0) + (data.failures || 0);
    const successRate = total > 0 ? ((data.success || 0) / total * 100).toFixed(1) + '%' : 'N/A';

    stats[provider] = {
      ...data,
      status,
      success_rate: successRate
    };
  }

  res.json({
    message: 'TempMail API - Node.js with Multiple Providers',
    providers: ['Mail.tm', 'Mail.gw', '1secmail', 'Guerrilla Mail'],
    stats: stats,
    config: {
      provider_cooldown: '60s',
      retry_attempts: 3,
      domain_cache_ttl: `${DOMAIN_CACHE_TTL}s`
    }
  });
});

// Email endpoints
router.post('/emails/create', emailController.createEmail);
router.get('/emails', emailController.getEmails);
router.get('/emails/:id', emailController.getEmail);
router.get('/emails/:id/messages', emailController.getMessages);
router.get('/emails/:id/messages/:messageId', emailController.getMessageDetail);
router.post('/emails/:id/refresh', emailController.getMessages);
router.delete('/emails/:id', emailController.deleteEmail);
router.post('/emails/:id/extend-time', emailController.extendTime);

// History endpoints
router.get('/emails/history/list', emailController.getHistory);
router.get('/emails/history/:id/messages', (req, res) => res.json({ messages: [], count: 0 }));
router.get('/emails/history/:id/messages/:messageId', (req, res) => res.status(404).json({ detail: 'Message not found' }));
router.delete('/emails/history/delete', emailController.deleteHistory);

// Saved endpoints
router.post('/emails/:id/messages/:messageId/save', emailController.saveMessage);
router.post('/emails/:id/save', emailController.saveEmail);
router.get('/emails/saved/list', emailController.getSavedEmails);
router.get('/emails/saved/:id', emailController.getSavedEmailDetail);
router.delete('/emails/saved/delete', emailController.deleteSavedEmails);

// Domains
router.get('/domains', emailController.getDomains);

module.exports = router;
