import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiLock, FiChevronDown, FiChevronUp, FiChevronRight, FiChevronLeft, FiMessageCircle, FiMessageSquare, FiEdit3, FiCheck, FiX, FiPlus, FiFile, FiImage, FiCalendar, FiTrash2 } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { saveDevPost, saveBookChapter, saveNewBook, deleteGithubFile, copyGithubFile, fetchFolderFiles, fetchDevTree, fetchBookTree, fetchDevPost, fetchChapter, fetchBookInfo, uploadImage } from '../../api/github';
import './Admin.css';

function VisitorCard({ visitors }) {
  return (
    <div className="admin-card">
      <div className="admin-card-title">방문자 통계</div>
      <div className="visitor-summary">
        <div className="visitor-item">
          <span className="visitor-label">Today</span>
          <span className="visitor-value">{visitors.today.toLocaleString()}</span>
        </div>
        <div className="visitor-item">
          <span className="visitor-label">Yesterday</span>
          <span className="visitor-value">{visitors.yesterday.toLocaleString()}</span>
        </div>
        <div className="visitor-item">
          <span className="visitor-label">Total</span>
          <span className="visitor-value">{visitors.total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function aggregateDaily(hits) {
  const map = {};
  (hits || []).forEach((h) => {
    (h.stats || []).forEach((s) => {
      map[s.day] = (map[s.day] || 0) + (s.daily || 0);
    });
  });
  return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
}

function aggregateWeekly(dailyEntries) {
  const weeks = {};
  dailyEntries.forEach(([day, count]) => {
    const d = new Date(day);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().split('T')[0];
    weeks[key] = (weeks[key] || 0) + count;
  });
  return Object.entries(weeks).sort((a, b) => a[0].localeCompare(b[0]));
}

function aggregateMonthly(dailyEntries) {
  const months = {};
  dailyEntries.forEach(([day, count]) => {
    const key = day.slice(0, 7);
    months[key] = (months[key] || 0) + count;
  });
  return Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
}

function PeriodChart({ hits }) {
  const [period, setPeriod] = useState('daily');
  const dailyAll = useMemo(() => aggregateDaily(hits), [hits]);

  const data = useMemo(() => {
    if (period === 'weekly') return aggregateWeekly(dailyAll).slice(-8);
    if (period === 'monthly') return aggregateMonthly(dailyAll);
    return dailyAll.slice(-7);
  }, [period, dailyAll]);

  const maxVal = Math.max(...data.map(([, v]) => v), 1);

  const formatLabel = (key) => {
    if (period === 'monthly') return key;
    return key.slice(5);
  };

  const periodLabels = { daily: '일별', weekly: '주별', monthly: '월별' };

  return (
    <div className="admin-card full-width">
      <div className="admin-card-header">
        <div className="admin-card-title">방문자 추이</div>
        <div className="period-tabs">
          {Object.entries(periodLabels).map(([key, label]) => (
            <button
              key={key}
              className={`period-tab${period === key ? ' active' : ''}`}
              onClick={() => setPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-bars">
        {data.map(([day, count]) => (
          <div className="chart-row" key={day}>
            <span className="chart-label">{formatLabel(day)}</span>
            <div className="chart-bar-wrap">
              <div className="chart-bar" style={{ width: `${(count / maxVal) * 100}%` }} />
            </div>
            <span className="chart-value">{count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HitsTable({ hits }) {
  const [expanded, setExpanded] = useState(false);
  const pages = (hits || [])
    .map((h) => ({ path: decodeURIComponent(h.path || ''), count: h.count || 0 }))
    .sort((a, b) => b.count - a.count);

  const top = pages.slice(0, 5);
  const rest = pages.slice(5);
  const hasMore = rest.length > 0;

  return (
    <div className="admin-card full-width">
      <div className="admin-card-header">
        <div className="admin-card-title">인기 페이지</div>
        {hasMore && (
          <button className="expand-toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? '접기' : `더 보기 (${rest.length})`}
            {expanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
          </button>
        )}
      </div>
      <table className="stats-table">
        <thead>
          <tr>
            <th>페이지</th>
            <th>조회수</th>
          </tr>
        </thead>
        <tbody>
          {top.map((p) => (
            <tr key={p.path}>
              <td><span className="stats-path" title={p.path}>{p.path}</span></td>
              <td>{p.count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`accordion-body${expanded ? ' open' : ''}`}>
        <div className="accordion-inner">
          <table className="stats-table">
            <tbody>
              {rest.map((p) => (
                <tr key={p.path}>
                  <td><span className="stats-path" title={p.path}>{p.path}</span></td>
                  <td>{p.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatBarCard({ title, data }) {
  const items = (data || []).slice(0, 8);
  const maxVal = Math.max(...items.map((d) => d.count || 0), 1);

  if (items.length === 0) {
    return (
      <div className="admin-card">
        <div className="admin-card-title">{title}</div>
        <p className="stat-empty">데이터 없음</p>
      </div>
    );
  }

  return (
    <div className="admin-card">
      <div className="admin-card-title">{title}</div>
      <div className="stat-rows">
        {items.map((item, i) => (
          <div className="stat-row" key={item.name || item.id || item.language || i}>
            <span className="stat-name" title={item.name || item.id || item.language || 'Unknown'}>{item.name || item.id || item.language || 'Unknown'}</span>
            <div className="stat-bar-bg">
              <div className="stat-bar-fill" style={{ width: `${((item.count || 0) / maxVal) * 100}%` }} />
            </div>
            <span className="stat-count">{(item.count || 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatRelativeDate(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}일 전`;
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function CommentsCard({ comments }) {
  const [expanded, setExpanded] = useState(false);
  const top = comments.slice(0, 5);
  const rest = comments.slice(5);
  const hasMore = rest.length > 0;

  return (
    <div className="admin-card full-width">
      <div className="admin-card-header">
        <div className="admin-card-title"><FiMessageCircle size={14} /> 댓글 목록</div>
        {hasMore && (
          <button className="expand-toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? '접기' : `더 보기 (${rest.length})`}
            {expanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
          </button>
        )}
      </div>
      {top.length === 0 && <p className="stat-empty">댓글이 없습니다.</p>}
      <div className="admin-discussion-list">
        {top.map((c, i) => (
          <Link key={i} to={c.path} className="admin-discussion-item">
            <img src={c.avatar} alt={c.author} className="admin-discussion-avatar" />
            <div className="admin-discussion-content">
              <div className="admin-discussion-meta">
                <span className="admin-discussion-author">{c.author}</span>
                <span className="admin-discussion-date">{formatRelativeDate(c.createdAt)}</span>
              </div>
              <span className="admin-discussion-post">{c.postTitle}</span>
              <span className="admin-discussion-body">{c.body}</span>
            </div>
          </Link>
        ))}
      </div>
      <div className={`accordion-body${expanded ? ' open' : ''}`}>
        <div className="accordion-inner">
          <div className="admin-discussion-list">
            {rest.map((c, i) => (
              <Link key={i} to={c.path} className="admin-discussion-item">
                <img src={c.avatar} alt={c.author} className="admin-discussion-avatar" />
                <div className="admin-discussion-content">
                  <div className="admin-discussion-meta">
                    <span className="admin-discussion-author">{c.author}</span>
                    <span className="admin-discussion-date">{formatRelativeDate(c.createdAt)}</span>
                  </div>
                  <span className="admin-discussion-post">{c.postTitle}</span>
                  <span className="admin-discussion-body">{c.body}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GuestbookCard({ guestbook }) {
  const items = guestbook.slice(0, 5);

  return (
    <div className="admin-card full-width">
      <div className="admin-card-header">
        <div className="admin-card-title"><FiMessageSquare size={14} /> 방명록 목록</div>
        <Link to="/guestbook" className="expand-toggle">
          더보기
          <FiChevronDown size={13} />
        </Link>
      </div>
      {items.length === 0 && <p className="stat-empty">방명록이 없습니다.</p>}
      <div className="admin-discussion-list">
        {items.map((c, i) => (
          <div key={i} className="admin-discussion-item">
            <img src={c.avatar} alt={c.author} className="admin-discussion-avatar" />
            <div className="admin-discussion-content">
              <div className="admin-discussion-meta">
                <span className="admin-discussion-author">{c.author}</span>
                <span className="admin-discussion-date">{formatRelativeDate(c.createdAt)}</span>
              </div>
              <span className="admin-discussion-body">{c.body}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div className={`write-toast write-toast-${toast.type}`}>
      {toast.type === 'ok' ? <FiCheck size={14} /> : <FiX size={14} />}
      <span>{toast.message}</span>
      <button type="button" className="write-toast-close" onClick={onDismiss}><FiX size={12} /></button>
    </div>
  );
}

function MarkdownEditor({ value, onChange, onImageUpload }) {
  const [mode, setMode] = useState('edit');
  const [uploading, setUploading] = useState(false);
  const taRef = useRef(null);
  const imgInputRef = useRef(null);

  const exec = useCallback((action) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: ss, selectionEnd: se, value: v } = ta;
    let newVal, newS, newE;

    if (action.type === 'wrap') {
      const { before, after = before } = action;
      const sel = v.slice(ss, se);
      newVal = v.slice(0, ss) + before + sel + after + v.slice(se);
      newS = ss + before.length;
      newE = se + before.length;
    } else if (action.type === 'line-prefix') {
      const { prefix } = action;
      const lineStart = v.lastIndexOf('\n', ss - 1) + 1;
      const region = v.slice(lineStart, se);
      const newRegion = region.replace(/^/gm, prefix);
      const diff = newRegion.length - region.length;
      newVal = v.slice(0, lineStart) + newRegion + v.slice(se);
      newS = ss + prefix.length;
      newE = se + diff;
    } else if (action.type === 'insert') {
      const { text } = action;
      newVal = v.slice(0, ss) + text + v.slice(se);
      newS = ss + text.length;
      newE = newS;
    }

    if (newVal != null) {
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.focus();
        if (newS != null) ta.setSelectionRange(newS, newE);
      });
    }
  }, [onChange]);

  const handleImageSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onImageUpload) return;
    setUploading(true);
    try {
      await onImageUpload(file, (snippet) => {
        exec({ type: 'insert', text: snippet });
      });
    } finally {
      setUploading(false);
    }
  }, [exec, onImageUpload]);

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      exec({ type: 'insert', text: '  ' });
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      exec({ type: 'wrap', before: '**', after: '**' });
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      exec({ type: 'wrap', before: '*', after: '*' });
    }
  };

  const TOOLBAR = [
    [
      { label: 'H1', title: 'Heading 1', action: { type: 'line-prefix', prefix: '# ' } },
      { label: 'H2', title: 'Heading 2', action: { type: 'line-prefix', prefix: '## ' } },
      { label: 'H3', title: 'Heading 3', action: { type: 'line-prefix', prefix: '### ' } },
    ],
    [
      { label: 'B', title: 'Bold (Ctrl+B)', action: { type: 'wrap', before: '**', after: '**' } },
      { label: 'I', title: 'Italic (Ctrl+I)', action: { type: 'wrap', before: '*', after: '*' } },
      { label: 'S', title: 'Strikethrough', action: { type: 'wrap', before: '~~', after: '~~' } },
    ],
    [
      { label: '`', title: 'Inline Code', action: { type: 'wrap', before: '`', after: '`' } },
      { label: '```', title: 'Code Block', action: { type: 'insert', text: '```\n\n```' } },
    ],
    [
      { label: '>', title: 'Blockquote', action: { type: 'line-prefix', prefix: '> ' } },
      { label: '•', title: 'Unordered List', action: { type: 'line-prefix', prefix: '- ' } },
      { label: '1.', title: 'Ordered List', action: { type: 'line-prefix', prefix: '1. ' } },
    ],
    [
      { label: '—', title: 'Horizontal Rule', action: { type: 'insert', text: '\n---\n' } },
      { label: '[링크]', title: 'Link', action: { type: 'wrap', before: '[', after: '](url)' } },
      { label: '⊞', title: 'Table', action: { type: 'insert', text: '| 제목 | 제목 |\n| --- | --- |\n| 내용 | 내용 |' } },
    ],
  ];

  return (
    <div className="md-editor">
      <div className="md-toolbar">
        {TOOLBAR.map((group, gi) => (
          <div key={gi} className="md-toolbar-group">
            {group.map((btn) => (
              <button
                key={btn.label}
                type="button"
                className="md-toolbar-btn"
                title={btn.title}
                onMouseDown={(e) => { e.preventDefault(); exec(btn.action); }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        ))}
        {onImageUpload && (
          <div className="md-toolbar-group">
            <button
              type="button"
              className="md-toolbar-btn"
              title="이미지 업로드"
              disabled={uploading}
              onMouseDown={(e) => { e.preventDefault(); imgInputRef.current?.click(); }}
            >
              {uploading ? '...' : <FiImage size={13} />}
            </button>
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />
          </div>
        )}
        <div className="md-toolbar-spacer" />
        <div className="md-toolbar-group">
          <button type="button" className={`md-toolbar-btn md-mode-btn${mode === 'edit' ? ' active' : ''}`} onClick={() => setMode('edit')}>편집</button>
          <button type="button" className={`md-toolbar-btn md-mode-btn${mode === 'preview' ? ' active' : ''}`} onClick={() => setMode('preview')}>미리보기</button>
        </div>
      </div>
      {mode === 'edit' ? (
        <textarea
          ref={taRef}
          className="md-textarea"
          placeholder="마크다운으로 작성하세요..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          required
        />
      ) : (
        <div className="md-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value || '*내용이 없습니다.*'}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function ConfirmDialog({ item, onConfirm, onCancel, loading }) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <p className="confirm-msg">
          <strong>{item.label}</strong>을(를) 삭제할까요?
          <br />
          <span className="confirm-warn">삭제된 파일은 복구할 수 없습니다.</span>
        </p>
        <div className="confirm-btns">
          <button className="confirm-cancel" onClick={onCancel} disabled={loading}>취소</button>
          <button className="confirm-del" onClick={onConfirm} disabled={loading}>
            {loading ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => !o.disabled && o.value === value);

  return (
    <div className={`csel${open ? ' open' : ''}`} ref={ref}>
      <button type="button" className="csel-trigger" onClick={() => setOpen((v) => !v)}>
        <span className={selected ? 'csel-val' : 'csel-ph'}>{selected?.label || placeholder || '선택하세요'}</span>
        <FiChevronDown size={13} className="csel-arrow" />
      </button>
      {open && (
        <ul className="csel-menu">
          {options.map((opt, i) =>
            opt.disabled ? (
              <li key={`sep${i}`} className="csel-sep" />
            ) : (
              <li key={opt.value}>
                <button
                  type="button"
                  className={`csel-opt${opt.value === value ? ' active' : ''}`}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                >
                  {opt.label}
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => { const d = value ? new Date(value + 'T00:00:00') : new Date(); return d.getFullYear(); });
  const [viewMonth, setViewMonth] = useState(() => { const d = value ? new Date(value + 'T00:00:00') : new Date(); return d.getMonth(); });
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const DAYS = ['일','월','화','수','목','금','토'];
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const today = new Date();

  const prevMonth = () => { if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); } else setViewMonth((m) => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); } else setViewMonth((m) => m + 1); };

  const handleSelect = (day) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };

  const isSelected = (day) => parsed && parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth && parsed.getDate() === day;
  const isToday = (day) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;

  return (
    <div className={`datepick${open ? ' open' : ''}`} ref={ref}>
      <button type="button" className="datepick-trigger" onClick={() => setOpen((v) => !v)}>
        <FiCalendar size={13} className="datepick-icon" />
        <span className={value ? '' : 'datepick-ph'}>{value || '날짜 선택'}</span>
      </button>
      {open && (
        <div className="datepick-panel">
          <div className="datepick-head">
            <button type="button" className="datepick-nav" onClick={prevMonth}><FiChevronLeft size={14} /></button>
            <span className="datepick-title">{viewYear}년 {MONTHS[viewMonth]}</span>
            <button type="button" className="datepick-nav" onClick={nextMonth}><FiChevronRight size={14} /></button>
          </div>
          <div className="datepick-grid">
            {DAYS.map((d) => <span key={d} className="datepick-dow">{d}</span>)}
            {Array.from({ length: firstDay }, (_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
              <button
                key={day}
                type="button"
                className={`datepick-day${isSelected(day) ? ' sel' : ''}${isToday(day) && !isSelected(day) ? ' today' : ''}`}
                onClick={() => handleSelect(day)}
              >{day}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CoverUpload({ preview, url, onChange }) {
  const src = preview || url;
  return src ? (
    <div className="write-cover-thumb">
      <img src={src} alt="cover" />
      <label className="write-cover-change">
        변경
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onChange} />
      </label>
    </div>
  ) : (
    <label className="write-cover-empty">
      <FiImage size={18} />
      <span>이미지 선택</span>
      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onChange} />
    </label>
  );
}

function WritePost() {
  const today = new Date().toISOString().slice(0, 10);

  // Tree
  const [devTree, setDevTree] = useState([]);
  const [bookTree, setBookTree] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [expandedDev, setExpandedDev] = useState({});
  const [expandedBooks, setExpandedBooks] = useState({});
  const [selectedKey, setSelectedKey] = useState(null);

  // Editor type: null | 'dev' | 'book' | 'new-book'
  const [editorType, setEditorType] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  // Dev fields — structure: dev/{category}/{slug}/{slug}.md + cover.{ext}
  const [devCategory, setDevCategory] = useState('');
  const [devCategoryNew, setDevCategoryNew] = useState(false);
  const [devSlug, setDevSlug] = useState('');
  const [devTitle, setDevTitle] = useState('');
  const [devDate, setDevDate] = useState(today);
  const [devTags, setDevTags] = useState('');
  const [devDesc, setDevDesc] = useState('');
  const [devContent, setDevContent] = useState('');
  const [devCoverFile, setDevCoverFile] = useState(null);
  const [devCoverPreview, setDevCoverPreview] = useState(null);
  const [devCoverUrl, setDevCoverUrl] = useState('');
  const [devIsNew, setDevIsNew] = useState(false);
  const [devOrigCategory, setDevOrigCategory] = useState('');
  const [devOrigSlug, setDevOrigSlug] = useState('');
  const [devOrigIsFolder, setDevOrigIsFolder] = useState(false);

  // Book chapter fields — structure: books/{bookSlug}/{chapterPath}.md
  const [bookSlugVal, setBookSlugVal] = useState('');
  const [chapterPath, setChapterPath] = useState('');
  const [bookContent, setBookContent] = useState('');
  const [bookChapterIsNew, setBookChapterIsNew] = useState(false);
  const [bookOrigChapterPath, setBookOrigChapterPath] = useState('');

  // New book fields — structure: books/{bookSlug}/info.json + cover.{ext}
  const [newBookSlug, setNewBookSlug] = useState('');
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookSubtitle, setNewBookSubtitle] = useState('');
  const [newBookAuthor, setNewBookAuthor] = useState('');
  const [newBookPublisher, setNewBookPublisher] = useState('');
  const [newBookTotalPages, setNewBookTotalPages] = useState('');
  const [newBookCategory, setNewBookCategory] = useState('');
  const [newBookRating, setNewBookRating] = useState('');
  const [newBookTags, setNewBookTags] = useState('');
  const [newBookExcerpt, setNewBookExcerpt] = useState('');
  const [newBookDate, setNewBookDate] = useState('');
  const [newBookStatus, setNewBookStatus] = useState('독서중');
  const [newBookCoverFile, setNewBookCoverFile] = useState(null);
  const [newBookCoverPreview, setNewBookCoverPreview] = useState(null);
  const [newBookCoverUrl, setNewBookCoverUrl] = useState('');
  const [newBookIsEdit, setNewBookIsEdit] = useState(false);

  useEffect(() => {
    Promise.all([fetchDevTree(), fetchBookTree()]).then(([dev, books]) => {
      setDevTree(dev);
      setBookTree(books);
      setTreeLoading(false);
    });
  }, []);

  const activeContent = editorType === 'dev' ? devContent : bookContent;
  const setActiveContent = editorType === 'dev' ? setDevContent : setBookContent;

  const handleCoverChange = (setter, previewSetter, prevPreview) => (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (prevPreview) URL.revokeObjectURL(prevPreview);
    setter(file);
    previewSetter(URL.createObjectURL(file));
  };

  const handleNewDev = () => {
    const key = 'write_draft_dev_new';
    setEditorType('dev');
    setSelectedKey('__new_dev__');
    setDevIsNew(true);
    setDevCategory(''); setDevCategoryNew(false); setDevSlug(''); setDevTitle('');
    setDevDate(today); setDevTags(''); setDevDesc(''); setDevContent('');
    setDevCoverFile(null); setDevCoverPreview(null); setDevCoverUrl('');
    setDraftKey(key);
    setDraftSavedAt(null);
    const draft = checkForDraft(key);
    setPendingDraft(draft);
  };

  const handleNewBook = () => {
    setEditorType('new-book');
    setSelectedKey('__new_book__');
    setNewBookIsEdit(false);
    setNewBookSlug(''); setNewBookTitle(''); setNewBookSubtitle(''); setNewBookAuthor('');
    setNewBookPublisher(''); setNewBookTotalPages(''); setNewBookCategory('');
    setNewBookRating(''); setNewBookTags(''); setNewBookExcerpt('');
    setNewBookDate(''); setNewBookStatus('독서중');
    setNewBookCoverFile(null); setNewBookCoverPreview(null); setNewBookCoverUrl('');
  };

  const handleEditBook = async (bSlug) => {
    const key = `book-info/${bSlug}`;
    if (selectedKey === key) return;
    setSelectedKey(key);
    setEditorType('new-book');
    setNewBookIsEdit(true);
    setContentLoading(true);
    try {
      const info = await fetchBookInfo(bSlug);
      setNewBookSlug(bSlug);
      setNewBookTitle(info.title || '');
      setNewBookSubtitle(info.subtitle || '');
      setNewBookAuthor(info.author || '');
      setNewBookPublisher(info.publisher || '');
      setNewBookTotalPages(info.totalPages != null ? String(info.totalPages) : '');
      setNewBookCategory(info.category || '');
      setNewBookRating(info.rating != null ? String(info.rating) : '');
      setNewBookTags(Array.isArray(info.tags) ? info.tags.join(', ') : '');
      setNewBookExcerpt(info.excerpt || '');
      setNewBookDate(info.date || '');
      setNewBookStatus(info.status || '독서중');
      setNewBookCoverFile(null); setNewBookCoverPreview(null); setNewBookCoverUrl('');
    } catch {
      setToast({ type: 'error', message: 'info.json을 불러오지 못했습니다.' });
    } finally {
      setContentLoading(false);
    }
  };

  const loadDevPost = async (category, slug) => {
    const key = `dev/${category}/${slug}`;
    if (selectedKey === key) return;
    setSelectedKey(key);
    setContentLoading(true);
    const dKey = `write_draft_dev_${category}_${slug}`;
    try {
      const post = await fetchDevPost(category, slug);
      setDevCategory(category); setDevCategoryNew(false);
      setDevSlug(slug); setDevTitle(post.title);
      setDevDate(post.date || today);
      setDevTags(Array.isArray(post.tags) ? post.tags.join(', ') : '');
      setDevDesc(post.description || '');
      setDevContent(post.content);
      setDevCoverFile(null); setDevCoverPreview(null);
      setDevCoverUrl(post.cover || '');
      setDevIsNew(false);
      setDevOrigCategory(category); setDevOrigSlug(slug); setDevOrigIsFolder(post.isFolder || false);
      setEditorType('dev');
      setDraftKey(dKey);
      setDraftSavedAt(null);
      const draft = checkForDraft(dKey);
      setPendingDraft(draft);
    } catch {
      setToast({ type: 'error', message: '포스트를 불러오지 못했습니다.' });
    } finally {
      setContentLoading(false);
    }
  };

  const handleNewChapter = (bSlug) => {
    const key = `write_draft_book_${bSlug}_new`;
    setEditorType('book');
    setSelectedKey(`__new_chapter_${bSlug}__`);
    setBookChapterIsNew(true);
    setBookSlugVal(bSlug); setChapterPath(''); setBookContent('');
    setDraftKey(key);
    setDraftSavedAt(null);
    const draft = checkForDraft(key);
    setPendingDraft(draft);
  };

  const loadBookChapter = async (bSlug, cPath) => {
    const key = `book/${bSlug}/${cPath}`;
    if (selectedKey === key) return;
    setSelectedKey(key);
    setContentLoading(true);
    const dKey = `write_draft_book_${bSlug}_${cPath}`;
    try {
      const ch = await fetchChapter(bSlug, cPath);
      setBookSlugVal(bSlug); setChapterPath(cPath); setBookContent(ch.content);
      setBookChapterIsNew(false); setBookOrigChapterPath(cPath);
      setEditorType('book');
      setDraftKey(dKey);
      setDraftSavedAt(null);
      const draft = checkForDraft(dKey);
      setPendingDraft(draft);
    } catch {
      setToast({ type: 'error', message: '챕터를 불러오지 못했습니다.' });
    } finally {
      setContentLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editorType === 'dev') {
        if (!devCategory.trim() || !devSlug.trim() || !devTitle.trim() || !devContent.trim()) { setSaving(false); return; }
        const tagList = devTags.split(',').map((t) => t.trim()).filter(Boolean);
        await saveDevPost({ category: devCategory.trim(), slug: devSlug.trim(), title: devTitle.trim(), date: devDate, tags: tagList, description: devDesc.trim(), content: devContent, coverFile: devCoverFile });
        if (devCoverFile) { setDevCoverUrl(devCoverPreview || ''); setDevCoverFile(null); }
        // 기존 파일 경로 계산 (flat or folder)
        if (!devIsNew) {
          const newCat = devCategory.trim();
          const newSlug = devSlug.trim();
          const origMdPath = devOrigIsFolder
            ? `dev/${devOrigCategory}/${devOrigSlug}/${devOrigSlug}.md`
            : `dev/${devOrigCategory}/${devOrigSlug}.md`;
          const newMdPath = `dev/${newCat}/${newSlug}/${newSlug}.md`;

          if (origMdPath !== newMdPath) {
            // 커버 이미지 처리 (folder 형식이고 커버 있을 때)
            if (devOrigIsFolder && devCoverUrl) {
              const coverFileName = devCoverUrl.split('/').pop(); // "cover.png"
              const oldCoverPath = `dev/${devOrigCategory}/${devOrigSlug}/${coverFileName}`;
              if (!devCoverFile) {
                // 새 커버 없으면 기존 커버를 새 경로로 복사
                await copyGithubFile({
                  fromPath: oldCoverPath,
                  toPath: `dev/${newCat}/${newSlug}/${coverFileName}`,
                  message: `docs: move cover for ${newCat}/${newSlug}`,
                });
              }
              // 기존 커버 삭제 (복사 or 새 커버 업로드 후)
              await deleteGithubFile({ filePath: oldCoverPath, message: `docs: remove old cover ${devOrigCategory}/${devOrigSlug}` });
            }
            // 기존 md 삭제
            await deleteGithubFile({ filePath: origMdPath, message: `docs: rename post ${devOrigCategory}/${devOrigSlug} -> ${newCat}/${newSlug}` });
            setDevOrigCategory(newCat); setDevOrigSlug(newSlug); setDevOrigIsFolder(true);
          }
        }
        fetchDevTree().then(setDevTree);
      } else if (editorType === 'book') {
        if (!bookSlugVal || !chapterPath.trim() || !bookContent.trim()) { setSaving(false); return; }
        await saveBookChapter({ bookSlug: bookSlugVal, chapterPath: chapterPath.trim(), content: bookContent });
        // 경로가 변경된 경우 기존 파일 삭제
        if (!bookChapterIsNew && bookOrigChapterPath && bookOrigChapterPath !== chapterPath.trim()) {
          await deleteGithubFile({ filePath: `books/${bookSlugVal}/${bookOrigChapterPath}.md`, message: `docs: rename chapter ${bookOrigChapterPath} -> ${chapterPath}` });
          setBookOrigChapterPath(chapterPath.trim());
        }
        fetchBookTree().then(setBookTree);
      } else if (editorType === 'new-book') {
        if (!newBookSlug.trim() || !newBookTitle.trim()) { setSaving(false); return; }
        const tagList = newBookTags.split(',').map((t) => t.trim()).filter(Boolean);
        await saveNewBook({
          bookSlug: newBookSlug.trim(), title: newBookTitle.trim(), subtitle: newBookSubtitle.trim(),
          author: newBookAuthor.trim(), publisher: newBookPublisher.trim(),
          totalPages: newBookTotalPages, category: newBookCategory.trim(),
          rating: newBookRating, tags: tagList, excerpt: newBookExcerpt.trim(),
          date: newBookDate, status: newBookStatus, coverFile: newBookCoverFile,
        });
        if (newBookCoverFile) { setNewBookCoverPreview(null); setNewBookCoverFile(null); }
        fetchBookTree().then(setBookTree);
      }
      clearDraft();
      const okMsg = editorType === 'dev'
        ? `저장 완료 — dev/${devCategory.trim()}/${devSlug.trim()}/${devSlug.trim()}.md`
        : editorType === 'book'
          ? `저장 완료 — books/${bookSlugVal}/${chapterPath.trim()}.md`
          : `${newBookIsEdit ? '수정' : '저장'} 완료 — books/${newBookSlug.trim()}/info.json`;
      setToast({ type: 'ok', message: okMsg });
    } catch (err) {
      setToast({ type: 'error', message: err?.response?.data?.message || err.message || '저장 실패' });
    } finally {
      setSaving(false);
    }
  };

  // Draft
  const [draftKey, setDraftKey] = useState(null);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(null);
  const draftTimerRef = useRef(null);

  const saveDraft = useCallback(() => {
    if (!draftKey || !editorType || editorType === 'new-book') return;
    let data;
    if (editorType === 'dev') {
      data = { type: 'dev', category: devCategory, slug: devSlug, title: devTitle, date: devDate, tags: devTags, desc: devDesc, content: devContent, savedAt: new Date().toISOString() };
    } else if (editorType === 'book') {
      data = { type: 'book', bookSlug: bookSlugVal, chapterPath, content: bookContent, savedAt: new Date().toISOString() };
    }
    if (!data) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(data));
      const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      setDraftSavedAt(time);
    } catch { /* storage full */ }
  }, [draftKey, editorType, devCategory, devSlug, devTitle, devDate, devTags, devDesc, devContent, bookSlugVal, chapterPath, bookContent]);

  const clearDraft = useCallback((key) => {
    const k = key ?? draftKey;
    if (k) localStorage.removeItem(k);
    setDraftSavedAt(null);
  }, [draftKey]);

  const checkForDraft = (key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };

  // Auto-save with 3s debounce
  useEffect(() => {
    if (!draftKey || !editorType || editorType === 'new-book') return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(saveDraft, 3000);
    return () => clearTimeout(draftTimerRef.current);
  }, [devCategory, devSlug, devTitle, devDate, devTags, devDesc, devContent, bookContent, chapterPath, saveDraft]);

  const applyDraft = () => {
    if (!pendingDraft) return;
    if (pendingDraft.type === 'dev') {
      if (pendingDraft.category) setDevCategory(pendingDraft.category);
      if (pendingDraft.slug) setDevSlug(pendingDraft.slug);
      if (pendingDraft.title) setDevTitle(pendingDraft.title);
      if (pendingDraft.date) setDevDate(pendingDraft.date);
      if (pendingDraft.tags !== undefined) setDevTags(pendingDraft.tags);
      if (pendingDraft.desc !== undefined) setDevDesc(pendingDraft.desc);
      if (pendingDraft.content) setDevContent(pendingDraft.content);
    } else if (pendingDraft.type === 'book') {
      if (pendingDraft.chapterPath) setChapterPath(pendingDraft.chapterPath);
      if (pendingDraft.content) setBookContent(pendingDraft.content);
    }
    setPendingDraft(null);
  };

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.type === 'dev') {
        const { category, slug } = confirmDelete;
        const files = await fetchFolderFiles(`dev/${category}/${slug}`);
        if (files.length > 0) {
          for (const f of files) {
            await deleteGithubFile({ filePath: `dev/${category}/${slug}/${f.name}`, message: `docs: delete post ${category}/${slug}` });
          }
        } else {
          await deleteGithubFile({ filePath: `dev/${category}/${slug}.md`, message: `docs: delete post ${category}/${slug}` });
        }
        if (selectedKey === `dev/${category}/${slug}`) { setSelectedKey(null); setEditorType(null); }
        fetchDevTree().then(setDevTree);
      } else if (confirmDelete.type === 'chapter') {
        const { bookSlug, chapterPath: cPath } = confirmDelete;
        await deleteGithubFile({ filePath: `books/${bookSlug}/${cPath}.md`, message: `docs: delete chapter ${cPath}` });
        if (selectedKey === `book/${bookSlug}/${cPath}`) { setSelectedKey(null); setEditorType(null); }
        fetchBookTree().then(setBookTree);
      } else if (confirmDelete.type === 'book') {
        const { bookSlug } = confirmDelete;
        const files = await fetchFolderFiles(`books/${bookSlug}`);
        for (const f of files) {
          await deleteGithubFile({ filePath: `books/${bookSlug}/${f.name}`, message: `docs: delete book ${bookSlug}` });
        }
        if (selectedKey?.startsWith(`book/${bookSlug}`) || selectedKey === `book-info/${bookSlug}`) {
          setSelectedKey(null); setEditorType(null);
        }
        fetchBookTree().then(setBookTree);
      }
      setToast({ type: 'ok', message: `삭제 완료 — ${confirmDelete.label}` });
    } catch (err) {
      setToast({ type: 'error', message: err?.message || '삭제 실패' });
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const handleImageUpload = useCallback(async (file, insertSnippet) => {
    let imagePath;
    let relPath;
    if (editorType === 'dev' && devCategory && devSlug) {
      const cat = devCategory.trim();
      const slug = devSlug.trim();
      imagePath = `assets/images/dev/${cat}/${slug}/${file.name}`;
      relPath = `../../../assets/images/dev/${cat}/${slug}/${file.name}`;
    } else if (editorType === 'book' && bookSlugVal) {
      imagePath = `assets/images/books/${bookSlugVal}/${file.name}`;
      relPath = `../../assets/images/books/${bookSlugVal}/${file.name}`;
    } else {
      setToast({ type: 'error', message: '카테고리/슬러그를 먼저 입력해주세요.' });
      return;
    }
    try {
      await uploadImage({ imagePath, file });
      const snippet = `\n<div align="center"><img src="${relPath}" alt="${file.name.replace(/\.[^.]+$/, '')}" width="500"></div>\n`;
      insertSnippet(snippet);
      setToast({ type: 'ok', message: `이미지 업로드 완료: ${file.name}` });
    } catch (err) {
      setToast({ type: 'error', message: err?.response?.data?.message || err.message || '이미지 업로드 실패' });
    }
  }, [editorType, devCategory, devSlug, bookSlugVal]);

  const toggleDev = (cat) => setExpandedDev((p) => ({ ...p, [cat]: !p[cat] }));
  const toggleBook = (bSlug) => setExpandedBooks((p) => ({ ...p, [bSlug]: !p[bSlug] }));

  return (
    <>
    <div className="write-layout">
      {/* ── Left: File Browser ── */}
      <aside className="write-browser">
        <button className="write-new-btn" onClick={handleNewDev}>
          <FiPlus size={13} /> 새 블로그 글
        </button>

        {treeLoading ? (
          <p className="write-tree-loading">불러오는 중...</p>
        ) : (
          <>
            {/* 블로그 트리 */}
            <div className="write-tree-section">
              <div className="write-tree-label">블로그</div>
              {devTree.map(({ category, slugs }) => (
                <div key={category} className="write-tree-group">
                  <button className="write-tree-cat" onClick={() => toggleDev(category)}>
                    {expandedDev[category] ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
                    <span>{category}</span>
                    <span className="write-tree-count">{slugs.length}</span>
                  </button>
                  {expandedDev[category] && (
                    <ul className="write-tree-files">
                      {slugs.map((slug) => (
                        <li key={slug} className="write-tree-file-row">
                          <button
                            className={`write-tree-file${selectedKey === `dev/${category}/${slug}` ? ' active' : ''}`}
                            onClick={() => loadDevPost(category, slug)}
                          >
                            <FiFile size={11} />
                            <span className="write-tree-name">{slug}</span>
                          </button>
                          <button
                            className="write-tree-del"
                            title="삭제"
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'dev', category, slug, label: `${category}/${slug}` }); }}
                          >
                            <FiTrash2 size={10} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {/* 책방 트리 */}
            <div className="write-tree-section">
              <div className="write-tree-section-header">
                <div className="write-tree-label">책방</div>
                <button className="write-tree-add-book" onClick={handleNewBook}>
                  <FiPlus size={11} /> 새 책
                </button>
              </div>
              {bookTree.map(({ bookSlug: bSlug, chapters }) => (
                <div key={bSlug} className="write-tree-group">
                  <div className="write-tree-cat-row">
                    <button className="write-tree-cat" onClick={() => toggleBook(bSlug)}>
                      {expandedBooks[bSlug] ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
                      <span>{bSlug}</span>
                      <span className="write-tree-count">{chapters.length}</span>
                    </button>
                    <button
                      className={`write-tree-edit-book${selectedKey === `book-info/${bSlug}` ? ' active' : ''}`}
                      title="info.json 편집"
                      onClick={() => handleEditBook(bSlug)}
                    >
                      <FiEdit3 size={11} />
                    </button>
                    <button
                      className="write-tree-del-book"
                      title="책 전체 삭제"
                      onClick={() => setConfirmDelete({ type: 'book', bookSlug: bSlug, label: bSlug })}
                    >
                      <FiTrash2 size={11} />
                    </button>
                  </div>
                  {expandedBooks[bSlug] && (
                    <ul className="write-tree-files">
                      <li>
                        <button className="write-tree-new-ch" onClick={() => handleNewChapter(bSlug)}>
                          <FiPlus size={11} /> 새 챕터
                        </button>
                      </li>
                      {chapters.map((ch) => (
                        <li key={ch.path} className="write-tree-file-row">
                          <button
                            className={`write-tree-file${selectedKey === `book/${bSlug}/${ch.path}` ? ' active' : ''}`}
                            onClick={() => loadBookChapter(bSlug, ch.path)}
                          >
                            <FiFile size={11} />
                            <span className="write-tree-name">{ch.name}</span>
                          </button>
                          <button
                            className="write-tree-del"
                            title="챕터 삭제"
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'chapter', bookSlug: bSlug, chapterPath: ch.path, label: `${bSlug}/${ch.name}` }); }}
                          >
                            <FiTrash2 size={10} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </aside>

      {/* ── Right: Editor ── */}
      <div className="write-editor-pane">
        {contentLoading && <div className="write-center"><p>불러오는 중...</p></div>}

        {!contentLoading && !editorType && (
          <div className="write-center">
            <FiEdit3 size={28} className="write-placeholder-icon" />
            <p>왼쪽에서 파일을 선택하거나 새 글을 작성하세요.</p>
          </div>
        )}

        {!contentLoading && editorType && (
          <form className="write-form" onSubmit={handleSubmit}>

            {/* ── 임시 저장 복원 배너 ── */}
            {pendingDraft && (
              <div className="write-draft-banner">
                <span className="write-draft-banner-msg">
                  임시 저장된 초안이 있습니다
                  <span className="write-draft-banner-time">
                    {new Date(pendingDraft.savedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
                <div className="write-draft-banner-btns">
                  <button type="button" className="write-draft-restore" onClick={applyDraft}>복원</button>
                  <button type="button" className="write-draft-discard" onClick={() => setPendingDraft(null)}>무시</button>
                </div>
              </div>
            )}

            {/* ── 새 책 등록 폼 ── */}
            {editorType === 'new-book' && (
              <>
                <div className="write-section-title">{newBookIsEdit ? `책 정보 수정 — ${newBookSlug}` : '새 책 등록'}</div>

                {/* 커버 + 기본 정보 */}
                <div className="write-book-header-row">
                  <div className="write-book-cover-col">
                    <label className="write-label">대표 사진</label>
                    <CoverUpload
                      preview={newBookCoverPreview}
                      url={newBookCoverUrl}
                      onChange={handleCoverChange(setNewBookCoverFile, setNewBookCoverPreview, newBookCoverPreview)}
                    />
                  </div>
                  <div className="write-book-info-col">
                    <div className="write-meta-row">
                      <div className={`write-field${newBookIsEdit ? ' write-field-readonly' : ''}`}>
                        <label className="write-label">폴더명 (slug) *</label>
                        <input className="write-input" placeholder="예: 클린코드" value={newBookSlug} onChange={(e) => !newBookIsEdit && setNewBookSlug(e.target.value)} readOnly={newBookIsEdit} required />
                      </div>
                      <div className="write-field" style={{ flex: 2 }}>
                        <label className="write-label">제목 *</label>
                        <input className="write-input" placeholder="예: 클린 코드" value={newBookTitle} onChange={(e) => setNewBookTitle(e.target.value)} required />
                      </div>
                    </div>
                    <div className="write-field">
                      <label className="write-label">부제목</label>
                      <input className="write-input" placeholder="예: 애자일 소프트웨어 장인 정신" value={newBookSubtitle} onChange={(e) => setNewBookSubtitle(e.target.value)} />
                    </div>
                    <div className="write-meta-row">
                      <div className="write-field">
                        <label className="write-label">저자</label>
                        <input className="write-input" placeholder="예: 로버트 C. 마틴" value={newBookAuthor} onChange={(e) => setNewBookAuthor(e.target.value)} />
                      </div>
                      <div className="write-field">
                        <label className="write-label">출판사</label>
                        <input className="write-input" placeholder="예: 인사이트" value={newBookPublisher} onChange={(e) => setNewBookPublisher(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 상세 정보 */}
                <div className="write-meta-row">
                  <div className="write-field write-field-sm">
                    <label className="write-label">총 페이지</label>
                    <input className="write-input" type="number" placeholder="464" min="1" value={newBookTotalPages} onChange={(e) => setNewBookTotalPages(e.target.value)} />
                  </div>
                  <div className="write-field write-field-sm">
                    <label className="write-label">평점</label>
                    <input className="write-input" type="number" placeholder="4.5" min="0" max="5" step="0.1" value={newBookRating} onChange={(e) => setNewBookRating(e.target.value)} />
                  </div>
                  <div className="write-field write-field-sm">
                    <label className="write-label">날짜</label>
                    <DatePicker value={newBookDate} onChange={(v) => setNewBookDate(v)} />
                  </div>
                  <div className="write-field write-field-sm">
                    <label className="write-label">상태</label>
                    <CustomSelect
                      value={newBookStatus}
                      onChange={(v) => setNewBookStatus(v)}
                      options={[
                        { value: '독서중', label: '독서중' },
                        { value: '완독', label: '완독' },
                        { value: '예정', label: '예정' },
                        { value: '중단', label: '중단' },
                      ]}
                    />
                  </div>
                  <div className="write-field">
                    <label className="write-label">카테고리</label>
                    <input className="write-input" placeholder="예: Programming" value={newBookCategory} onChange={(e) => setNewBookCategory(e.target.value)} />
                  </div>
                </div>
                <div className="write-meta-row">
                  <div className="write-field">
                    <label className="write-label">태그 (쉼표 구분)</label>
                    <input className="write-input" placeholder="예: clean-code, java" value={newBookTags} onChange={(e) => setNewBookTags(e.target.value)} />
                  </div>
                  <div className="write-field" style={{ flex: 2 }}>
                    <label className="write-label">한 줄 요약 (excerpt)</label>
                    <input className="write-input" placeholder="예: 깨끗한 코드를 작성하는 방법" value={newBookExcerpt} onChange={(e) => setNewBookExcerpt(e.target.value)} />
                  </div>
                </div>

                <div className="write-book-path-hint">
                  저장 위치: <code>books/{newBookSlug || '{폴더명}'}/info.json</code>
                  {newBookCoverFile && <> + <code>cover.{newBookCoverFile.name.split('.').pop()}</code></>}
                </div>
              </>
            )}

            {/* ── 블로그 글 폼 ── */}
            {editorType === 'dev' && (
              <>
                <div className="write-meta-row">
                  <div className="write-field">
                    <label className="write-label">카테고리 (폴더)</label>
                    {devCategoryNew ? (
                      <div className="write-cat-new-row">
                        <input className="write-input" placeholder="새 카테고리명" value={devCategory} onChange={(e) => setDevCategory(e.target.value)} autoFocus required />
                        <button type="button" className="write-cat-cancel" onClick={() => { setDevCategoryNew(false); setDevCategory(devIsNew ? '' : devOrigCategory); }}>취소</button>
                      </div>
                    ) : (
                      <CustomSelect
                        value={devCategory}
                        onChange={(v) => { if (v === '__new__') { setDevCategoryNew(true); setDevCategory(''); } else setDevCategory(v); }}
                        options={[
                          ...devTree.map(({ category }) => ({ value: category, label: category })),
                          { value: '__sep__', label: '', disabled: true },
                          { value: '__new__', label: '+ 새 카테고리' },
                        ]}
                        placeholder="카테고리 선택"
                      />
                    )}
                  </div>
                  <div className="write-field">
                    <label className="write-label">슬러그 (폴더명)</label>
                    <input className="write-input" placeholder="예: effective-java-ch1" value={devSlug} onChange={(e) => setDevSlug(e.target.value)} required />
                  </div>
                  <div className="write-field write-field-date">
                    <label className="write-label">날짜</label>
                    <DatePicker value={devDate} onChange={(v) => setDevDate(v)} />
                  </div>
                </div>
                <div className="write-meta-row write-meta-row-title">
                  <div className="write-field" style={{ flex: 1 }}>
                    <label className="write-label">제목</label>
                    <input className="write-input" placeholder="포스트 제목" value={devTitle} onChange={(e) => setDevTitle(e.target.value)} required />
                  </div>
                  <div className="write-field write-field-cover">
                    <label className="write-label">대표 사진</label>
                    <CoverUpload
                      preview={devCoverPreview}
                      url={devCoverUrl}
                      onChange={handleCoverChange(setDevCoverFile, setDevCoverPreview, devCoverPreview)}
                    />
                  </div>
                </div>
                <div className="write-meta-row">
                  <div className="write-field">
                    <label className="write-label">태그 (쉼표 구분)</label>
                    <input className="write-input" placeholder="예: Java, OOP, 설계" value={devTags} onChange={(e) => setDevTags(e.target.value)} />
                  </div>
                  <div className="write-field" style={{ flex: 2 }}>
                    <label className="write-label">설명</label>
                    <input className="write-input" placeholder="포스트 간단 설명" value={devDesc} onChange={(e) => setDevDesc(e.target.value)} />
                  </div>
                </div>
                {devCategory && devSlug && (
                  <div className="write-book-path-hint">
                    저장 위치: <code>dev/{devCategory}/{devSlug}/{devSlug}.md</code>
                    {(devCoverFile || devCoverUrl) && <> + <code>cover.*</code></>}
                  </div>
                )}
              </>
            )}

            {/* ── 책 챕터 폼 ── */}
            {editorType === 'book' && (
              <>
                <div className="write-meta-row">
                  <div className="write-field write-field-readonly">
                    <label className="write-label">책 (폴더)</label>
                    <input className="write-input" value={bookSlugVal} readOnly />
                  </div>
                  <div className="write-field" style={{ flex: 2 }}>
                    <label className="write-label">챕터 파일명 (.md 제외)</label>
                    <input className="write-input" placeholder="예: 01-01장._객체,_설계" value={chapterPath} onChange={(e) => setChapterPath(e.target.value)} required />
                  </div>
                </div>
                {bookSlugVal && chapterPath && (
                  <div className="write-book-path-hint">
                    저장 위치: <code>books/{bookSlugVal}/{chapterPath}.md</code>
                  </div>
                )}
              </>
            )}

            {/* ── 본문 에디터 (dev / book만) ── */}
            {(editorType === 'dev' || editorType === 'book') && (
              <MarkdownEditor value={activeContent} onChange={setActiveContent} onImageUpload={handleImageUpload} />
            )}

            <div className="write-actions">
              {draftSavedAt && (
                <span className="write-draft-saved">임시 저장됨 {draftSavedAt}</span>
              )}
              {(editorType === 'dev' || editorType === 'book') && (
                <button
                  type="button"
                  className="write-draft-btn"
                  onClick={() => { saveDraft(); setToast({ type: 'ok', message: '임시 저장됐습니다.' }); }}
                  disabled={saving}
                >
                  임시 저장
                </button>
              )}
              <button type="submit" className="write-submit" disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
    <Toast toast={toast} onDismiss={() => setToast(null)} />
    {confirmDelete && (
      <ConfirmDialog
        item={confirmDelete}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
        loading={deleting}
      />
    )}
    </>
  );
}

function RateLimitCard({ rateLimit }) {
  if (!rateLimit) return null;

  const { remaining, limit, reset } = rateLimit;
  const pct = (remaining / limit) * 100;
  const resetTime = new Date(reset * 1000).toLocaleTimeString();
  const barClass = pct < 10 ? 'danger' : pct < 30 ? 'warning' : '';

  return (
    <div className="admin-card">
      <div className="admin-card-title">GitHub API Rate Limit</div>
      <div className="rate-limit-info">
        <div className="rate-limit-bar-wrap">
          <div className={`rate-limit-bar ${barClass}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="rate-limit-text">
          <span>남은 요청</span>
          <span className="rate-limit-remaining">{remaining.toLocaleString()} / {limit.toLocaleString()}</span>
        </div>
        <span className="rate-limit-reset">리셋 시간: {resetTime}</span>
      </div>
    </div>
  );
}

function LoginForm({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    setSubmitting(true);
    setError('');

    const success = await onLogin(password);
    if (!success) {
      setError('비밀번호가 틀렸습니다.');
    }
    setSubmitting(false);
  };

  return (
    <div className="admin-login-prompt">
      <FiLock size={32} className="admin-lock-icon" />
      <p>관리자 인증이 필요합니다.</p>
      <form className="admin-login-form" onSubmit={handleSubmit}>
        <input
          type="password"
          className="admin-password-input"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          disabled={submitting}
        />
        <button type="submit" className="admin-login-btn" disabled={submitting}>
          {submitting ? '확인 중...' : '확인'}
        </button>
      </form>
      {error && <span className="admin-login-error">{error}</span>}
    </div>
  );
}

function Admin() {
  const { authenticated, loading: authLoading, login, logout, getToken } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');

  useEffect(() => {
    if (!authenticated) return;

    const token = getToken();
    fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [authenticated, getToken]);

  if (authLoading || (authenticated && loading)) {
    return (
      <div className="page-loading">
        <img src="/profile.jpg" alt="이찬한" className="loading-avatar" />
        <p className="loading-text">페이지를 불러오는 중...</p>
        <span className="loading-dots"><span className="dot" /><span className="dot" /><span className="dot" /></span>
      </div>
    );
  }

  if (!authenticated) {
    return <main className="admin"><LoginForm onLogin={login} /></main>;
  }

  if (!stats) {
    return (
      <main className="admin">
        <div className="admin-login-prompt">
          <p>통계 데이터를 불러올 수 없습니다.</p>
          <button className="admin-logout-btn" onClick={logout}>로그아웃</button>
        </div>
      </main>
    );
  }

  return (
    <main className="admin">
      <div className="admin-page">
        <div className="admin-header">
          <div className="admin-tabs">
            <button className={`admin-tab${tab === 'dashboard' ? ' active' : ''}`} onClick={() => setTab('dashboard')}>대시보드</button>
            <button className={`admin-tab${tab === 'write' ? ' active' : ''}`} onClick={() => setTab('write')}><FiEdit3 size={13} /> 글쓰기</button>
          </div>
          <button className="admin-logout-btn" onClick={logout}>로그아웃</button>
        </div>

        {tab === 'write' ? (
          <WritePost />
        ) : (
          <div className="admin-grid">
            <VisitorCard visitors={stats.visitors || { today: 0, yesterday: 0, total: 0 }} />
            <RateLimitCard rateLimit={stats.rateLimit} />
            <PeriodChart hits={stats.hits} />
            <HitsTable hits={stats.hits} />
            <StatBarCard title="유입 경로" data={stats.referrers} />
            <StatBarCard title="브라우저" data={stats.browsers} />
            <StatBarCard title="운영체제" data={stats.systems} />
            <StatBarCard title="지역" data={stats.locations} />
            <CommentsCard comments={stats.allComments || []} />
            <GuestbookCard guestbook={stats.allGuestbook || []} />
          </div>
        )}
      </div>
    </main>
  );
}

export default Admin;
