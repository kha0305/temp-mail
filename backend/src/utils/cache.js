const cache = {
  mailtm: { domains: [], expires_at: 0 },
  '1secmail': { domains: [], expires_at: 0 },
  mailgw: { domains: [], expires_at: 0 },
  guerrilla: { domains: [], expires_at: 0 }
};

const providerStats = {
  mailtm: { success: 0, failures: 0, cooldown_until: 0 },
  '1secmail': { success: 0, failures: 0, cooldown_until: 0 },
  mailgw: { success: 0, failures: 0, cooldown_until: 0 },
  guerrilla: { success: 0, failures: 0, cooldown_until: 0 },
  tempmail_lol: { success: 0, failures: 0, cooldown_until: 0 }
};

const DOMAIN_CACHE_TTL = 300; // 5 minutes

module.exports = {
  cache,
  providerStats,
  DOMAIN_CACHE_TTL
};
