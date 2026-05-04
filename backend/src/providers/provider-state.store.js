const { DOMAIN_CACHE_TTL_SECONDS } = require('../constants/app.constants');

const providerCache = {
  edu: { domains: [], expires_at: 0 },
  mailtm: { domains: [], expires_at: 0 },
  mailgw: { domains: [], expires_at: 0 },
  tempmailc: { domains: [], expires_at: 0 },
  '1secmail': { domains: [], expires_at: 0 },
  guerrilla: { domains: [], expires_at: 0 },
};

const providerStats = {
  edu: { success: 0, failures: 0, cooldown_until: 0 },
  mailtm: { success: 0, failures: 0, cooldown_until: 0 },
  mailgw: { success: 0, failures: 0, cooldown_until: 0 },
  tempmailc: { success: 0, failures: 0, cooldown_until: 0 },
  '1secmail': { success: 0, failures: 0, cooldown_until: 0 },
  guerrilla: { success: 0, failures: 0, cooldown_until: 0 },
};

module.exports = {
  providerCache,
  providerStats,
  DOMAIN_CACHE_TTL: DOMAIN_CACHE_TTL_SECONDS,
};
