# 형광펜 하이라이트 기능 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 책 챕터 페이지에서 텍스트 드래그 시 형광펜 마킹이 가능하고, localStorage에 저장되어 재방문 시 자동 복원되는 기능 구현

**Architecture:** useHighlight 커스텀 훅으로 localStorage 저장/조회를 담당하고, Chapter.jsx에서 mouseup 이벤트로 선택 텍스트를 감지해 팝업 버튼을 표시한다. ReactMarkdown 렌더링 후 useEffect에서 DOM을 직접 순회해 저장된 텍스트를 `<mark>` 태그로 래핑한다.

**Tech Stack:** React hooks, localStorage, DOM TreeWalker API, CSS

---

## Task 1: useHighlight 커스텀 훅 생성

**Files:**
- Create: `src/hooks/useHighlight.js`

**Step 1: 파일 생성**

```javascript
// src/hooks/useHighlight.js
import { useState, useCallback } from 'react';

export function useHighlight(bookSlug, chapterPath) {
  const key = `highlights_${bookSlug}_${chapterPath}`;

  const [highlights, setHighlights] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  });

  const addHighlight = useCallback((text) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    setHighlights((prev) => {
      const next = [...prev, { id, text }];
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);

  const removeHighlight = useCallback((id) => {
    setHighlights((prev) => {
      const next = prev.filter((h) => h.id !== id);
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);

  return { highlights, addHighlight, removeHighlight };
}
```

**Step 2: 커밋**
```bash
git add src/hooks/useHighlight.js
git commit -m "feat: useHighlight 커스텀 훅 추가"
```

---

## Task 2: DOM 하이라이트 적용 유틸 함수 작성

**Files:**
- Create: `src/utils/highlightDOM.js`

**Step 1: 파일 생성**

```javascript
// src/utils/highlightDOM.js

// 텍스트 노드만 순회 (코드 블록 제외)
function getTextNodes(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (!node.parentElement.closest('pre, code')) {
      nodes.push(node);
    }
  }
  return nodes;
}

// 기존 mark 태그 제거 후 텍스트 노드 정규화
function clearHighlights(container) {
  container.querySelectorAll('mark[data-hid]').forEach((mark) => {
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  container.normalize();
}

// highlights 배열을 DOM에 적용
export function applyHighlightsToDOM(container, highlights, onRemove) {
  if (!container) return;
  clearHighlights(container);

  for (const { id, text } of highlights) {
    if (!text) continue;
    const textNodes = getTextNodes(container);
    for (const node of textNodes) {
      const idx = node.textContent.indexOf(text);
      if (idx === -1) continue;

      const before = node.textContent.slice(0, idx);
      const after = node.textContent.slice(idx + text.length);

      const mark = document.createElement('mark');
      mark.dataset.hid = id;
      mark.className = 'chapter-highlight';
      mark.textContent = text;
      mark.addEventListener('click', (e) => {
        e.stopPropagation();
        onRemove(id);
      });

      const parent = node.parentNode;
      if (before) parent.insertBefore(document.createTextNode(before), node);
      parent.insertBefore(mark, node);
      if (after) parent.insertBefore(document.createTextNode(after), node);
      parent.removeChild(node);
      break; // 동일 텍스트는 첫 번째만 하이라이트
    }
  }
}
```

**Step 2: 커밋**
```bash
git add src/utils/highlightDOM.js
git commit -m "feat: 하이라이트 DOM 적용 유틸 함수 추가"
```

---

## Task 3: Chapter.jsx에 하이라이트 로직 통합

**Files:**
- Modify: `src/page/chapter/Chapter.jsx`

**Step 1: import 추가**

파일 상단 import 목록에 추가:
```javascript
import { useRef, useCallback } from 'react'; // 기존 import에 useRef, useCallback 확인
import { useHighlight } from '../../hooks/useHighlight';
import { applyHighlightsToDOM } from '../../utils/highlightDOM';
```

**Step 2: 상태 추가**

`Chapter` 함수 내 기존 useState 아래에 추가:
```javascript
const chapterBodyRef = useRef(null);
const { highlights, addHighlight, removeHighlight } = useHighlight(bookSlug, chapterPath);
const [popupPos, setPopupPos] = useState(null);
const [pendingText, setPendingText] = useState('');
```

**Step 3: mouseup 핸들러 추가**

```javascript
const handleMouseUp = useCallback(() => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  if (!text || text.length < 2) {
    setPopupPos(null);
    return;
  }
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  setPopupPos({
    x: rect.left + rect.width / 2 + window.scrollX,
    y: rect.top + window.scrollY - 44,
  });
  setPendingText(text);
}, []);

const handleHighlightSave = useCallback(() => {
  if (!pendingText) return;
  addHighlight(pendingText);
  window.getSelection()?.removeAllRanges();
  setPopupPos(null);
  setPendingText('');
}, [pendingText, addHighlight]);

const handlePopupClose = useCallback(() => {
  setPopupPos(null);
  setPendingText('');
}, []);
```

**Step 4: 하이라이트 DOM 적용 useEffect 추가**

기존 useEffect들 아래에 추가:
```javascript
useEffect(() => {
  const container = chapterBodyRef.current;
  if (!container || !currentChapter?.content) return;
  applyHighlightsToDOM(container, highlights, removeHighlight);
}, [highlights, currentChapter?.content, removeHighlight]);
```

**Step 5: chapter-body div에 ref와 이벤트 연결**

760번 줄 근처:
```jsx
<div
  ref={chapterBodyRef}
  className={`chapter-body font-${fontFamily}${sepiaMode ? ' sepia' : ''}`}
  style={{ fontSize: `${fontSize}px` }}
  onMouseUp={handleMouseUp}
>
```

**Step 6: 팝업 버튼 JSX 추가**

`</article>` 바로 위에 추가:
```jsx
{popupPos && (
  <div
    className="highlight-popup"
    style={{ left: popupPos.x, top: popupPos.y }}
    onMouseDown={(e) => e.preventDefault()}
  >
    <button className="highlight-popup-btn" onClick={handleHighlightSave}>
      형광펜
    </button>
    <button className="highlight-popup-cancel" onClick={handlePopupClose}>
      ✕
    </button>
  </div>
)}
```

**Step 7: 커밋**
```bash
git add src/page/chapter/Chapter.jsx
git commit -m "feat: Chapter 페이지에 형광펜 하이라이트 기능 통합"
```

---

## Task 4: CSS 스타일 추가

**Files:**
- Modify: `src/page/chapter/Chapter.css`

**Step 1: 파일 하단에 CSS 추가**

```css
/* ── Highlight ── */
mark.chapter-highlight {
  background: rgba(255, 220, 0, 0.45);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
  cursor: pointer;
  transition: background 0.15s;
}

mark.chapter-highlight:hover {
  background: rgba(255, 80, 80, 0.35);
}

mark.chapter-highlight:hover::after {
  content: ' ✕';
  font-size: 0.75em;
  color: #e53e3e;
}

[data-theme='dark'] mark.chapter-highlight {
  background: rgba(255, 220, 0, 0.25);
}

[data-theme='dark'] mark.chapter-highlight:hover {
  background: rgba(255, 80, 80, 0.25);
}

/* ── Highlight Popup ── */
.highlight-popup {
  position: absolute;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  z-index: 300;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 4px 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  pointer-events: all;
}

.highlight-popup-btn {
  font-size: 0.78rem;
  font-weight: 600;
  color: #1a1613;
  background: rgba(255, 220, 0, 0.8);
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.highlight-popup-btn:hover {
  background: rgba(255, 200, 0, 1);
}

.highlight-popup-cancel {
  font-size: 0.78rem;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 4px 6px;
  cursor: pointer;
  transition: color 0.15s;
}

.highlight-popup-cancel:hover {
  color: var(--text-primary);
}
```

**Step 2: 커밋**
```bash
git add src/page/chapter/Chapter.css
git commit -m "style: 형광펜 하이라이트 CSS 추가"
```

---

## Task 5: 빌드 확인 및 최종 푸시

**Step 1: 빌드 확인**
```bash
npm run build
```
Expected: 오류 없이 빌드 성공

**Step 2: 최종 커밋 및 푸시**
```bash
git push
```
