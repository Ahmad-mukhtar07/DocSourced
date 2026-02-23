/**
 * Connected documents: CRUD for the connected_docs Supabase table.
 * Scoped by auth.uid(); use from popup where Supabase client has session.
 */

import { supabaseClient, isSupabaseConfigured } from '../config/supabase-config.js';

const TABLE = 'connected_docs';

/**
 * Fetch all connected documents for the current user (requires session).
 * @returns {Promise<Array<{ id: string, google_doc_id: string, doc_title: string, last_accessed_at?: string }>>}
 */
export async function getConnectedDocs() {
  if (!isSupabaseConfigured || !supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from(TABLE)
    .select('id, google_doc_id, doc_title, last_accessed_at')
    .order('last_accessed_at', { ascending: false });
  if (error) throw new Error(error.message || 'Failed to load connected documents');
  return data ?? [];
}

/**
 * Add a document to connected_docs (or return existing if already connected).
 * @param {string} googleDocId - Google Doc id
 * @param {string} docTitle - Display title
 * @returns {Promise<{ id: string, google_doc_id: string, doc_title: string }>}
 */
export async function addConnectedDoc(googleDocId, docTitle = '') {
  if (!isSupabaseConfigured || !supabaseClient) throw new Error('Supabase not configured');
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user?.id) throw new Error('Not authenticated');
  const gid = String(googleDocId).trim();
  const title = String(docTitle).trim() || 'Untitled';
  const now = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from(TABLE)
    .insert({ user_id: user.id, google_doc_id: gid, doc_title: title, last_accessed_at: now })
    .select('id, google_doc_id, doc_title')
    .single();
  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await supabaseClient
        .from(TABLE)
        .select('id, google_doc_id, doc_title')
        .eq('google_doc_id', gid)
        .maybeSingle();
      return existing ?? { id: '', google_doc_id: gid, doc_title: title };
    }
    throw new Error(error.message || 'Failed to add document');
  }
  return data;
}

/**
 * Remove a connected document by row id.
 * @param {string} rowId - connected_docs.id
 */
export async function removeConnectedDoc(rowId) {
  if (!isSupabaseConfigured || !supabaseClient) throw new Error('Supabase not configured');
  const { error } = await supabaseClient.from(TABLE).delete().eq('id', rowId);
  if (error) throw new Error(error.message || 'Failed to remove document');
}
