/**
 * Snip History: image snippets only. Fetch and delete for the authenticated user.
 * Pro-only (RLS enforces SELECT/DELETE for tier = 'pro').
 */

import { supabaseClient, isSupabaseConfigured } from '../config/supabase-config.js';
import { getConnectedDocs } from './connectedDocsService.js';

const SNIPS_TABLE = 'snips_history';

/**
 * Fetch image snips for the current user, newest first, with doc title from connected_docs.
 * @returns {Promise<Array<{ id: string, source_url: string | null, page_title: string | null, domain: string | null, snippet_type: string | null, drive_url: string | null, target_doc_id: string | null, created_at: string | null, doc_title: string | null }>>}
 */
export async function getSnipsHistory() {
  if (!isSupabaseConfigured || !supabaseClient) return [];
  const { data: snips, error } = await supabaseClient
    .from(SNIPS_TABLE)
    .select('id, source_url, page_title, domain, snippet_type, drive_url, target_doc_id, created_at')
    .eq('snippet_type', 'image')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message || 'Failed to load snip history');
  const list = snips ?? [];
  if (list.length === 0) return [];
  const docs = await getConnectedDocs().catch(() => []);
  const docByGoogleId = new Map(docs.map((d) => [d.google_doc_id, d.doc_title || 'Untitled']));
  return list.map((s) => ({
    ...s,
    doc_title: (s.target_doc_id && docByGoogleId.get(s.target_doc_id)) || null,
  }));
}

/**
 * Get a thumbnail URL for a Drive image (drive_url or file id).
 * @param {string} driveUrl - e.g. https://drive.google.com/file/d/FILE_ID/view or https://drive.google.com/uc?export=view&id=FILE_ID
 * @returns {string} thumbnail URL or original if not parseable
 */
export function getDriveThumbnailUrl(driveUrl) {
  if (!driveUrl) return '';
  try {
    const m = driveUrl.match(/[/?]d\/([a-zA-Z0-9_-]+)/) || driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fileId = m ? m[1] : null;
    if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w200`;
  } catch (_) {}
  return driveUrl;
}

/**
 * Delete a snip by id. RLS allows only own rows and Pro tier.
 * @param {string} id - snips_history.id
 */
export async function deleteSnip(id) {
  if (!isSupabaseConfigured || !supabaseClient) throw new Error('Supabase not configured');
  const { error } = await supabaseClient.from(SNIPS_TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message || 'Failed to delete snip');
}

/**
 * Update page_title for a snip. RLS allows only own rows and Pro tier.
 * @param {string} id - snips_history.id
 * @param {string} pageTitle - New title (trimmed, max 1024 chars)
 */
export async function updateSnipPageTitle(id, pageTitle) {
  if (!isSupabaseConfigured || !supabaseClient) throw new Error('Supabase not configured');
  const title = String(pageTitle ?? '').trim().slice(0, 1024) || null;
  const { error } = await supabaseClient
    .from(SNIPS_TABLE)
    .update({ page_title: title })
    .eq('id', id);
  if (error) throw new Error(error.message || 'Failed to update title');
}
