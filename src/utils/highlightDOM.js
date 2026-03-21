export function getTextNodes(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement.closest('pre, code, mark')) continue;
    if (!node.textContent.trim()) continue; // whitespace-only 노드 제외
    nodes.push(node);
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

function findAndHighlight(container, text, id, onRemove) {
  const textNodes = getTextNodes(container);
  if (!textNodes.length) return false;

  // 텍스트 노드를 연결할 때 단어 경계에서 공백 삽입 (br/블록 경계 대응)
  let fullText = '';
  const nodePositions = [];
  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    if (i > 0 && fullText.length > 0) {
      const lastChar = fullText[fullText.length - 1];
      const firstChar = node.textContent[0] || '';
      if (!/\s/.test(lastChar) && firstChar && !/\s/.test(firstChar)) {
        fullText += ' '; // br이나 블록 경계에 공백 삽입
      }
    }
    nodePositions.push({ node, start: fullText.length });
    fullText += node.textContent;
  }

  // whitespace를 유연하게 매칭 (블록 경계 \n 등 대응)
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/\s+/g, '\\s+');
  const match = new RegExp(pattern).exec(fullText);
  if (!match) return false;

  const idx = match.index;
  const end = idx + match[0].length;

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

    if (!highlighted) continue;

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
