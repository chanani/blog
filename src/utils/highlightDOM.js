function getTextNodes(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (!node.parentElement.closest('pre, code, mark')) {
      nodes.push(node);
    }
  }
  return nodes;
}

function clearHighlights(container) {
  container.querySelectorAll('mark[data-hid]').forEach((mark) => {
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  container.normalize();
}

function makeMarkEl(id, text, onRemove) {
  const mark = document.createElement('mark');
  mark.dataset.hid = id;
  mark.className = 'chapter-highlight';
  mark.textContent = text;
  mark.addEventListener('click', (e) => {
    e.stopPropagation();
    onRemove(id);
  });
  return mark;
}

// 태그 경계를 넘는 텍스트도 처리: 전체 텍스트 노드를 합쳐 위치를 찾고 여러 노드에 분할 적용
function findAndHighlight(container, text, id, onRemove) {
  const textNodes = getTextNodes(container);
  if (!textNodes.length) return false;

  // 각 텍스트 노드의 시작 위치를 기록
  let fullText = '';
  const nodePositions = [];
  for (const node of textNodes) {
    nodePositions.push({ node, start: fullText.length });
    fullText += node.textContent;
  }

  const idx = fullText.indexOf(text);
  if (idx === -1) return false;

  const end = idx + text.length;

  // 범위에 걸친 노드 추출 (역순으로 처리해 offset 틀어짐 방지)
  const affected = nodePositions.filter(
    ({ node, start }) => start < end && start + node.textContent.length > idx
  );

  for (let i = affected.length - 1; i >= 0; i--) {
    const { node, start: nodeStart } = affected[i];
    const hlStart = Math.max(0, idx - nodeStart);
    const hlEnd = Math.min(node.textContent.length, end - nodeStart);

    const before = node.textContent.slice(0, hlStart);
    const highlighted = node.textContent.slice(hlStart, hlEnd);
    const after = node.textContent.slice(hlEnd);

    const mark = makeMarkEl(id, highlighted, onRemove);
    const parent = node.parentNode;
    if (before) parent.insertBefore(document.createTextNode(before), node);
    parent.insertBefore(mark, node);
    if (after) parent.insertBefore(document.createTextNode(after), node);
    parent.removeChild(node);
  }

  return true;
}

export function applyHighlightsToDOM(container, highlights, onRemove) {
  if (!container) return;
  clearHighlights(container);

  for (const { id, text } of highlights) {
    if (!text) continue;
    findAndHighlight(container, text, id, onRemove);
  }
}
