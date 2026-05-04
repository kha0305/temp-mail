const eduProvider = require('./edu.provider');
const guerrillaProvider = require('./guerrilla.provider');
const mailgwProvider = require('./mailgw.provider');
const mailtmProvider = require('./mailtm.provider');
const onesecmailProvider = require('./onesecmail.provider');
const tempmailcProvider = require('./tempmailc.provider');
const { providerCache } = require('./provider-state.store');

const providers = [
  eduProvider,
  mailtmProvider,
  tempmailcProvider,
  mailgwProvider,
  onesecmailProvider,
  guerrillaProvider,
];

const providerMap = new Map(providers.map((provider) => [provider.key, provider]));
let domainProviderMapPromise = null;
let domainProviderMapExpiresAt = 0;
const providerAliasMap = new Map(
  providers.flatMap((provider) => {
    const aliases = [
      provider.key,
      provider.label,
      String(provider.key || '').replace(/[\s._-]+/g, ''),
      String(provider.label || '').replace(/[\s._-]+/g, ''),
    ];

    return aliases
      .map((alias) => String(alias || '').trim().toLowerCase())
      .filter(Boolean)
      .map((alias) => [alias, provider.key]);
  }),
);
const DOMAIN_PROVIDER_HINTS = [
  ['mail.tm', 'mailtm'],
  ['mail.gw', 'mailgw'],
  ['iopia.org', 'tempmailc'],
  ['kvarra.org', 'tempmailc'],
  ['aatrox.org', 'tempmailc'],
  ['ambes.org', 'tempmailc'],
  ['kojoball.email', 'tempmailc'],
  ['kortazo.email', 'tempmailc'],
  ['shla7.org', 'tempmailc'],
  ['1secmail.com', '1secmail'],
  ['1secmail.org', '1secmail'],
  ['1secmail.net', '1secmail'],
  ['wwjmp.com', '1secmail'],
  ['esiix.com', '1secmail'],
  ['xojxe.com', '1secmail'],
  ['yoggm.com', '1secmail'],
  ['guerrillamail.com', 'guerrilla'],
  ['guerrillamail.net', 'guerrilla'],
  ['guerrillamail.org', 'guerrilla'],
  ['sharklasers.com', 'guerrilla'],
  ['spam4.me', 'guerrilla'],
];
const DOMAIN_DISCOVERY_FETCH_BLACKLIST = new Set(['mailgw', '1secmail']);

const getProvider = (providerKey) => providerMap.get(providerKey) || null;

const listProviders = () => providers;

const listProviderCatalog = () =>
  providers.map((provider) => ({
    key: provider.key,
    label: provider.label,
    supports_login: typeof provider.loginAccount === 'function',
  }));

const listProviderLabels = () => providers.map((provider) => provider.label);

const normalizeProviderToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, '');

const resolveProviderKey = (value) => {
  const rawValue = String(value || '').trim().toLowerCase();

  if (!rawValue) {
    return null;
  }

  if (providerMap.has(rawValue)) {
    return rawValue;
  }

  return providerAliasMap.get(rawValue) || providerAliasMap.get(normalizeProviderToken(rawValue)) || null;
};

const getProviderLabel = (providerKey) => getProvider(providerKey)?.label || null;

const buildDomainProviderMap = async () => {
  const now = Date.now();

  if (domainProviderMapPromise && now < domainProviderMapExpiresAt) {
    return domainProviderMapPromise;
  }

  domainProviderMapExpiresAt = now + 5 * 60 * 1000;
  domainProviderMapPromise = (async () => {
  const domainProviderMap = new Map();

  for (const provider of providers) {
    const cachedDomains = providerCache[provider.key]?.domains || [];
    let domains = cachedDomains;

    const shouldFetchDomains =
      domains.length === 0 &&
      typeof provider.getDomains === 'function' &&
      !DOMAIN_DISCOVERY_FETCH_BLACKLIST.has(provider.key);

    if (shouldFetchDomains) {
      try {
        domains = await provider.getDomains();
      } catch (error) {
        domains = [];
      }
    }

    for (const domain of domains) {
      const normalizedDomain = String(domain || '').trim().toLowerCase();

      if (normalizedDomain && !domainProviderMap.has(normalizedDomain)) {
        domainProviderMap.set(normalizedDomain, provider.key);
      }
    }
  }

  for (const [domain, providerKey] of DOMAIN_PROVIDER_HINTS) {
    const normalizedDomain = String(domain || '').trim().toLowerCase();

    if (normalizedDomain && !domainProviderMap.has(normalizedDomain)) {
      domainProviderMap.set(normalizedDomain, providerKey);
    }
  }

  return domainProviderMap;
  })();

  return domainProviderMapPromise;
};

const resolveProviderIdentity = async ({ provider = null, address = '' } = {}) => {
  const explicitProviderKey = resolveProviderKey(provider);

  if (explicitProviderKey) {
    return {
      key: explicitProviderKey,
      label: getProviderLabel(explicitProviderKey),
    };
  }

  const [, rawDomain = ''] = String(address || '').split('@');
  const normalizedDomain = rawDomain.trim().toLowerCase();

  if (!normalizedDomain) {
    return {
      key: null,
      label: 'Unknown',
    };
  }

  const domainProviderMap = await buildDomainProviderMap();
  const inferredProviderKey = domainProviderMap.get(normalizedDomain) || null;

  if (inferredProviderKey) {
    return {
      key: inferredProviderKey,
      label: getProviderLabel(inferredProviderKey),
    };
  }

  return {
    key: null,
    label: 'Unknown',
  };
};

module.exports = {
  getProvider,
  listProviders,
  listProviderCatalog,
  listProviderLabels,
  resolveProviderKey,
  getProviderLabel,
  resolveProviderIdentity,
};
