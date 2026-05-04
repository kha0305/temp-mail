const express = require('express');
const providerManagerService = require('../../services/provider-manager.service');
const { DOMAIN_CACHE_TTL_SECONDS, PROVIDER_COOLDOWN_SECONDS } = require('../../constants/app.constants');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'TempMail API - Modular Node.js Backend',
    providers: providerManagerService.listProviderCatalog(),
    stats: providerManagerService.getProviderStatus(),
    config: {
      provider_cooldown: `${PROVIDER_COOLDOWN_SECONDS}s`,
      retry_attempts: 3,
      domain_cache_ttl: `${DOMAIN_CACHE_TTL_SECONDS}s`,
    },
  });
});

module.exports = router;
