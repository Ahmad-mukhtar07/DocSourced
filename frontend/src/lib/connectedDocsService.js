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
 * Add a document via RPC (enforces free-tier doc limit server-side).
 * @param {string} googleDocId - Google Doc id
 * @param {string} docTitle - Display title
 * @returns {Promise<{ id: string, google_doc_id: string, doc_title: string }>}
 * @throws never; returns { error: 'doc_limit_reached' } in payload from RPC — check result.error and show upgrade.
 */
export async function addConnectedDoc(googleDocId, docTitle = '') {
  if (!isSupabaseConfigured || !supabaseClient) throw new Error('Supabase not configured');
  const gid = String(googleDocId).trim();
  const title = String(docTitle).trim() || 'Untitled';
  const { data, error } = await supabaseClient.rpc('add_connected_doc', {
    p_google_doc_id: gid,
    p_doc_title: title,
  });
  if (error) throw new Error(error.message || 'Failed to add document');
  if (data?.error === 'not_authenticated') throw new Error('Not authenticated');
  if (data?.error === 'doc_limit_reached') {
    const err = new Error('Document limit reached');
    err.code = 'DOC_LIMIT_REACHED';
    err.payload = { error: 'doc_limit_reached' };
    throw err;
  }
  if (data?.error) throw new Error(data.error === 'invalid_doc_id' ? 'Invalid document' : 'Failed to add document');
  if (!data?.success || !data?.id) throw new Error('Failed to add document');
  return { id: data.id, google_doc_id: data.google_doc_id, doc_title: data.doc_title };
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
