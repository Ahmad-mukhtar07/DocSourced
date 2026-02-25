import { useState, useEffect, useCallback } from 'react';
import { useFeatureAccess } from '../hooks/useFeatureAccess.js';
import { getSnipsHistory, deleteSnip, updateSnipPageTitle, getDriveThumbnailUrl } from '../lib/snipsHistoryService.js';
import { getDocSections, reinsertImageAtSection } from '../popup/messages.js';
import './SnipHistory.css';

const FAVICON_BASE = 'https://www.google.com/s2/favicons?domain=';
const FAVICON_SZ = 32;

/** Lazy-loaded domain favicon with globe fallback. URL computed client-side only. */
function DomainFavicon({ domain, className = '' }) {
  const [failed, setFailed] = useState(false);
  const isNoDomain = !domain || domain === '(no domain)';
  const faviconUrl = isNoDomain ? null : `${FAVICON_BASE}${encodeURIComponent(domain)}&sz=${FAVICON_SZ}`;

  if (isNoDomain || failed) {
    return (
      <span className={`snip-history__domain-favicon snip-history__domain-favicon--fallback ${className}`} aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </span>
    );
  }
  return (
    <img
      src={faviconUrl}
      alt=""
      className={`snip-history__domain-favicon ${className}`}
      loading="lazy"
      width={16}
      height={16}
      onError={() => setFailed(true)}
      aria-hidden
    />
  );
}

function formatTimestamp(createdAt) {
  if (!createdAt) return '—';
  const d = new Date(createdAt);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

const CONTENT_PREVIEW_LEN = 120;

/**
 * Pro-only Snip History / Sources: image and text snips for the current document, grouped by domain.
 * Image: thumbnail, Reinsert. Text: "Text" badge, content preview, no Reinsert.
 */
export function SnipHistory({ documentId, onShowUpgrade, disabled = false }) {
  const { canAccessSnipHistory } = useFeatureAccess();
  const [collapsed, setCollapsed] = useState(true);
  const [snips, setSnips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [reinsertSnip, setReinsertSnip] = useState(null);
  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [reinsertError, setReinsertError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [titleError, setTitleError] = useState(null);

  const loadSnips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getSnipsHistory(documentId || undefined);
      setSnips(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load snip history');
      setSnips([]);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (canAccessSnipHistory) loadSnips();
  }, [canAccessSnipHistory, loadSnips]);

  // Refetch when user expands the section or when the active document changes
  useEffect(() => {
    if (canAccessSnipHistory && !collapsed) loadSnips();
  }, [canAccessSnipHistory, collapsed, documentId, loadSnips]);

  const filteredSnips = search.trim()
    ? snips.filter((s) => {
        const q = search.trim().toLowerCase();
        const pageTitle = (s.page_title || '').toLowerCase();
        const domain = (s.domain || '').toLowerCase();
        const url = (s.source_url || '').toLowerCase();
        const doc = (s.doc_title || '').toLowerCase();
        const content = (s.content || '').toLowerCase();
        return pageTitle.includes(q) || domain.includes(q) || url.includes(q) || doc.includes(q) || content.includes(q);
      })
    : snips;

  const snipsByDomain = filteredSnips.reduce((acc, snip) => {
    const key = snip.domain && snip.domain.trim() ? snip.domain.trim() : '(no domain)';
    if (!acc[key]) acc[key] = [];
    acc[key].push(snip);
    return acc;
  }, /** @type {{ [domain: string]: typeof filteredSnips }} */ ({}));
  const domainKeys = Object.keys(snipsByDomain).sort();

  const handleReinsertClick = async (snip) => {
    if (snip.snippet_type !== 'image' || !snip.drive_url) return;
    setReinsertError(null);
    setSectionsLoading(true);
    try {
      const res = await getDocSections();
      if (!res?.success || !Array.isArray(res.sections) || res.sections.length === 0) {
        setReinsertError(res?.error || 'Could not load document sections. Select a document first.');
        setSectionsLoading(false);
        return;
      }
      setSections(res.sections);
      setReinsertSnip(snip);
    } catch (e) {
      setReinsertError(e instanceof Error ? e.message : 'Failed to load sections');
    } finally {
      setSectionsLoading(false);
    }
  };

  const handlePickSectionForReinsert = async (section) => {
    if (!reinsertSnip?.drive_url) return;
    setReinsertError(null);
    try {
      const res = await reinsertImageAtSection(
        reinsertSnip.drive_url,
        section.index,
        { pageUrl: reinsertSnip.source_url || '', pageTitle: reinsertSnip.page_title || '', snipId: reinsertSnip.id }
      );
      if (res?.success) {
        setReinsertSnip(null);
        setSections([]);
      } else {
        setReinsertError(res?.error || 'Failed to insert');
      }
    } catch (e) {
      setReinsertError(e instanceof Error ? e.message : 'Failed to insert');
    }
  };

  const handleDelete = async (snip) => {
    setDeletingId(snip.id);
    try {
      await deleteSnip(snip.id);
      setSnips((prev) => prev.filter((s) => s.id !== snip.id));
    } catch (_) {
      setError('Failed to delete snip');
    } finally {
      setDeletingId(null);
    }
  };

  const startEditTitle = (snip) => {
    setEditingId(snip.id);
    setEditingTitle(snip.page_title || '');
    setTitleError(null);
  };

  const cancelEditTitle = () => {
    setEditingId(null);
    setEditingTitle('');
    setTitleError(null);
  };

  const saveEditTitle = async () => {
    if (editingId == null) return;
    setTitleError(null);
    try {
      await updateSnipPageTitle(editingId, editingTitle);
      setSnips((prev) => prev.map((s) => (s.id === editingId ? { ...s, page_title: (editingTitle || '').trim() || null } : s)));
      setEditingId(null);
      setEditingTitle('');
    } catch (e) {
      setTitleError(e instanceof Error ? e.message : 'Failed to update title');
    }
  };

  if (!canAccessSnipHistory) {
    return (
      <div className={`snip-history snip-history--locked ${collapsed ? 'snip-history--collapsed' : ''}`}>
        <button
          type="button"
          className="snip-history__header"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-controls="snip-history-content-locked"
          id="snip-history-label-locked"
        >
          <span className="snip-history__header-title">Snip History</span>
          <span className="snip-history__collapse-icon" aria-hidden>{collapsed ? '▶' : '▼'}</span>
        </button>
        <div id="snip-history-content-locked" className="snip-history__content" aria-labelledby="snip-history-label-locked" hidden={collapsed}>
          <p className="snip-history__locked-text">View and reinsert past snips. Upgrade to Pro to unlock.</p>
          <button
            type="button"
            className="snip-history__upgrade-btn"
            onClick={onShowUpgrade}
            disabled={disabled}
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`snip-history ${collapsed ? 'snip-history--collapsed' : ''}`}>
      <button
        type="button"
        className="snip-history__header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-controls="snip-history-content"
        id="snip-history-label"
      >
        <span className="snip-history__header-title">Snip History</span>
        <span className="snip-history__collapse-icon" aria-hidden>{collapsed ? '▶' : '▼'}</span>
      </button>
      <div id="snip-history-content" className="snip-history__content" aria-labelledby="snip-history-label" hidden={collapsed}>
      <input
        type="search"
        className="snip-history__search"
        placeholder="Search by page title, domain or URL…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search snips"
      />
      {loading && <p className="snip-history__status">Loading…</p>}
      {error && <p className="snip-history__error" role="alert">{error}</p>}
      {!loading && !error && reinsertSnip && (
        <div className="snip-history__sections">
          <p className="snip-history__sections-label">Choose where to insert:</p>
          <ul className="snip-history__sections-list">
            {sections.map((sec) => (
              <li key={sec.index}>
                <button
                  type="button"
                  className="snip-history__section-btn"
                  onClick={() => handlePickSectionForReinsert(sec)}
                  disabled={disabled}
                >
                  {sec.label}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="snip-history__section-cancel" onClick={() => { setReinsertSnip(null); setSections([]); setReinsertError(null); }}>
            Cancel
          </button>
          {reinsertError && <p className="snip-history__error">{reinsertError}</p>}
        </div>
      )}
      {!loading && !error && !reinsertSnip && sectionsLoading && <p className="snip-history__status">Loading sections…</p>}
      {!loading && !error && !reinsertSnip && !sectionsLoading && (
        <div className="snip-history__list-wrap">
          {filteredSnips.length === 0 ? (
            <p className="snip-history__empty">{search.trim() ? 'No sources match your search.' : documentId ? 'No sources yet for this document. Use Plug it in or Snip and Plug to add content.' : 'Select a document to see sources used in it.'}</p>
          ) : (
            <div className="snip-history__by-domain">
              {domainKeys.map((domainKey) => {
                const items = snipsByDomain[domainKey];
                return (
                  <div key={domainKey} className="snip-history__domain-group">
                    <h4 className="snip-history__domain-heading">
                      <DomainFavicon domain={domainKey === '(no domain)' ? null : domainKey} />
                      <span className="snip-history__domain-name">{domainKey}</span>
                      <span className="snip-history__domain-count">({items.length})</span>
                    </h4>
                    <ul className="snip-history__list">
                      {items.map((snip) => {
                        const isText = snip.snippet_type === 'text';
                        const canReinsert = !isText && snip.drive_url;
                        return (
                          <li key={snip.id} className="snip-history__item">
                            <div className="snip-history__item-inner">
                              {isText ? (
                                <div className="snip-history__thumb snip-history__thumb--text" title="Text snippet">
                                  <span className="snip-history__text-badge">Text</span>
                                </div>
                              ) : snip.drive_url ? (
                                <img
                                  src={getDriveThumbnailUrl(snip.drive_url)}
                                  alt=""
                                  className="snip-history__thumb"
                                />
                              ) : (
                                <div className="snip-history__thumb snip-history__thumb--placeholder" aria-hidden />
                              )}
                              <div className="snip-history__item-body">
                                {!isText && snip.domain && <span className="snip-history__domain">{snip.domain}</span>}
                                {editingId === snip.id ? (
                                  <div className="snip-history__title-edit">
                                    <input
                                      type="text"
                                      className="snip-history__title-input"
                                      value={editingTitle}
                                      onChange={(e) => setEditingTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveEditTitle();
                                        if (e.key === 'Escape') cancelEditTitle();
                                      }}
                                      placeholder="Page title"
                                      aria-label="Edit page title"
                                      autoFocus
                                    />
                                    <div className="snip-history__title-edit-actions">
                                      <button type="button" className="snip-history__btn snip-history__btn--reinsert" onClick={saveEditTitle}>Save</button>
                                      <button type="button" className="snip-history__btn snip-history__btn--delete" onClick={cancelEditTitle}>Cancel</button>
                                    </div>
                                    {titleError && <p className="snip-history__error">{titleError}</p>}
                                  </div>
                                ) : (
                                  <p className="snip-history__page-title">
                                    <span>{snip.page_title || 'Untitled'}</span>
                                    <button
                                      type="button"
                                      className="snip-history__edit-title-btn"
                                      onClick={() => startEditTitle(snip)}
                                      disabled={disabled}
                                      title="Change page title"
                                      aria-label="Edit page title"
                                    >
                                      Edit
                                    </button>
                                  </p>
                                )}
                                {isText && snip.content && (
                                  <p className="snip-history__content-preview">{(snip.content || '').trim().slice(0, CONTENT_PREVIEW_LEN).trim()}{(snip.content || '').length > CONTENT_PREVIEW_LEN ? '…' : ''}</p>
                                )}
                                {snip.source_url ? (
                                  <a
                                    href={snip.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="snip-history__url"
                                  >
                                    {snip.source_url.length > 50 ? snip.source_url.slice(0, 47) + '…' : snip.source_url}
                                  </a>
                                ) : (
                                  <span className="snip-history__url snip-history__url--muted">No source URL</span>
                                )}
                                <div className="snip-history__meta">
                                  {snip.doc_title && <span className="snip-history__doc">{snip.doc_title}</span>}
                                  <span className="snip-history__time">{formatTimestamp(snip.created_at)}</span>
                                </div>
                                <div className="snip-history__actions">
                                  {canReinsert ? (
                                    <button
                                      type="button"
                                      className="snip-history__btn snip-history__btn--reinsert"
                                      onClick={() => handleReinsertClick(snip)}
                                      disabled={disabled || !documentId}
                                      title={!documentId ? 'Select a document first' : 'Insert into current document'}
                                    >
                                      Reinsert
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="snip-history__btn snip-history__btn--delete"
                                    onClick={() => handleDelete(snip)}
                                    disabled={disabled || deletingId === snip.id}
                                    title="Remove from history"
                                  >
                                    {deletingId === snip.id ? '…' : 'Delete'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
