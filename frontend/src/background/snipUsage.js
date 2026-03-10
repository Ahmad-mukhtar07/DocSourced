/**
 * Backend-enforced snip usage: call Supabase RPC before allowing a plug/snip insert.
 * Uses token from chrome.storage (synced by popup when user is signed in).
 */

const STORAGE_KEY_URL = 'eznote_supabase_url';
const STORAGE_KEY_ANON = 'eznote_supabase_anon_key';
const STORAGE_KEY_TOKEN = 'eznote_supabase_access_token';

/**
 * Parse domain from URL for storage (hostname without www).
 * @param {string} url
 * @returns {string}
 */
function parseDomain(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = new URL(url.trim());
    const host = u.hostname || '';
    return host.replace(/^www\./i, '');
  } catch (_) {
    return '';
  }
}

/**
 * Call record_snip_and_check_limit RPC. When content is non-empty, inserts a text row into snips_history.
 * @param {{ content?: string, source_url?: string, target_doc_id?: string, page_title?: string, domain?: string }} params
 * @returns {Promise<{ success?: boolean, error?: string, limit?: number }>}
 */
export async function recordSnipAndCheckLimit(params = {}) {
  const { content = '', source_url = '', target_doc_id = '', page_title = '', domain = '' } = params;
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_URL, STORAGE_KEY_ANON, STORAGE_KEY_TOKEN], resolve);
  });
  const url = stored[STORAGE_KEY_URL];
  const anonKey = stored[STORAGE_KEY_ANON];
  const token = stored[STORAGE_KEY_TOKEN];
  if (!url || !anonKey || !token) {
    return { error: 'not_authenticated' };
  }

  const contentTrim = String(content).trim();
  const domainVal = domain || parseDomain(source_url);
  const rpcUrl = `${url.replace(/\/$/, '')}/rest/v1/rpc/record_snip_and_check_limit`;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      p_content: contentTrim.slice(0, 500),
      p_source_url: String(source_url).slice(0, 2048),
      p_target_doc_id: String(target_doc_id).slice(0, 256),
      p_page_title: String(page_title).slice(0, 1024),
      p_domain: String(domainVal).slice(0, 512),
    }),
  });

  let data = await res.json().catch(() => ({}));
  if (Array.isArray(data) && data[0]) data = data[0];
  if (!res.ok) {
    const msg = data?.message || data?.error_description || data?.error || 'record_snip_failed';
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      console.warn('[DocSourced] record_snip_and_check_limit failed', res.status, msg, data);
    }
    return { error: msg };
  }
  if (data?.error) {
    return { error: data.error, limit: data.limit };
  }
  return { success: true, snip_id: data?.snip_id ?? null };
}

/**
 * Call record_image_snip_and_check_limit RPC. Inserts image row into snips_history and enforces limit.
 * @param {{ source_url?: string, page_title?: string, domain?: string, drive_url?: string, target_doc_id?: string }} params
 * @returns {Promise<{ success?: boolean, error?: string, limit?: number }>}
 */
export async function recordImageSnipAndCheckLimit(params = {}) {
  const {
    source_url = '',
    page_title = '',
    domain = '',
    drive_url = '',
    target_doc_id = '',
  } = params;
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_URL, STORAGE_KEY_ANON, STORAGE_KEY_TOKEN], resolve);
  });
  const url = stored[STORAGE_KEY_URL];
  const anonKey = stored[STORAGE_KEY_ANON];
  const token = stored[STORAGE_KEY_TOKEN];
  if (!url || !anonKey || !token) {
    return { error: 'not_authenticated' };
  }

  const rpcUrl = `${url.replace(/\/$/, '')}/rest/v1/rpc/record_image_snip_and_check_limit`;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      p_source_url: String(source_url).slice(0, 2048),
      p_page_title: String(page_title).slice(0, 1024),
      p_domain: String(domain).slice(0, 512),
      p_drive_url: String(drive_url).slice(0, 2048),
      p_target_doc_id: String(target_doc_id).slice(0, 256),
    }),
  });

  let data = await res.json().catch(() => ({}));
  if (Array.isArray(data) && data[0]) data = data[0];
  if (!res.ok) {
    const msg = data?.message || data?.error_description || data?.error || 'record_snip_failed';
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      console.warn('[DocSourced] record_image_snip_and_check_limit failed', res.status, msg, data);
    }
    return { error: msg };
  }
  if (data?.error) {
    return { error: data.error, limit: data.limit };
  }
  return { success: true, snip_id: data?.snip_id ?? null };
}

/**
 * Call get_snip_usage RPC. Returns { used, limit, allowed } or { error }.
 * Used to disable "Image Snip" when limit is reached.
 * @returns {Promise<{ used?: number, limit?: number, allowed?: boolean, error?: string }>}
 */
export async function getSnipUsage() {
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_URL, STORAGE_KEY_ANON, STORAGE_KEY_TOKEN], resolve);
  });
  const url = stored[STORAGE_KEY_URL];
  const anonKey = stored[STORAGE_KEY_ANON];
  const token = stored[STORAGE_KEY_TOKEN];
  if (!url || !anonKey || !token) {
    return { error: 'not_authenticated', allowed: true };
  }

  const rpcUrl = `${url.replace(/\/$/, '')}/rest/v1/rpc/get_snip_usage`;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  let data = await res.json().catch(() => ({}));
  if (Array.isArray(data) && data[0]) data = data[0];
  if (!res.ok) {
    return { error: data?.message || data?.error || 'get_snip_usage_failed', allowed: true };
  }
  if (data?.error) {
    return { used: 0, limit: 15, allowed: data.allowed !== false };
  }
  return {
    used: typeof data.used === 'number' ? data.used : 0,
    limit: typeof data.limit === 'number' ? data.limit : 15,
    allowed: data.allowed !== false,
  };
}

/**
 * Fetch source metadata for given snip ids from snips_history (RLS applies).
 * Used by Format References to resolve SNIP_REF_ named ranges.
 * @param {string[]} ids - snips_history.id (UUIDs)
 * @returns {Promise<Array<{ id: string, source_url: string | null, page_title: string | null, domain: string | null }>>}
 */
export async function getSnipsMetadata(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY_URL, STORAGE_KEY_ANON, STORAGE_KEY_TOKEN], resolve);
  });
  const url = stored[STORAGE_KEY_URL];
  const anonKey = stored[STORAGE_KEY_ANON];
  const token = stored[STORAGE_KEY_TOKEN];
  if (!url || !anonKey || !token) return [];

  const uniqueIds = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  const inFilter = uniqueIds.join(',');
  const restUrl = `${url.replace(/\/$/, '')}/rest/v1/snips_history?id=in.(${inFilter})&select=id,source_url,page_title,domain`;
  const res = await fetch(restUrl, {
    method: 'GET',
    headers: {
      Apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}
