import { getTextNodes } from './highlightDOM';

function buildFullText(textNodes) {
  let fullText = '';
  const nodePositions = [];
  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    if (i > 0 && fullText.length > 0) {
      const lastChar = fullText[fullText.length - 1];
      const firstChar = node.textContent[0] || '';
      if (!/\s/.test(lastChar) && firstChar && !/\s/.test(firstChar)) {
        fullText += ' ';
      }
    }
    nodePositions.push({ node, start: fullText.length });
    fullText += node.textContent;
  }
  return { fullText, nodePositions };
}

function findNthMatch(fullText, text, occurrence) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/\s+/g, '\\s+');
  const regex = new RegExp(pattern, 'g');
  let match;
  let count = 0;
  while ((match = regex.exec(fullText)) !== null) {
    if (count === occurrence) return match;
    count++;
  }
  return null;
}

function wrapTextWithHighlight(nodePositions, matchStart, matchEnd, memo, onMemoClick) {
  const affected = nodePositions.filter(
    ({ node, start }) => start < matchEnd && start + node.textContent.length > matchStart
  );
  if (!affected.length) return;

  for (const { node, start: nodeStart } of affected) {
    const hlStart = Math.max(0, matchStart - nodeStart);
    const hlEnd = Math.min(node.textContent.length, matchEnd - nodeStart);
    const highlighted = node.textContent.slice(hlStart, hlEnd);
    if (!highlighted) continue;

    const before = node.textContent.slice(0, hlStart);
    const after = node.textContent.slice(hlEnd);

    const mark = document.createElement('mark');
    mark.className = 'memo-highlight';
    mark.dataset.mid = memo.id;
    mark.textContent = highlighted;
    mark.title = memo.note;
    mark.addEventListener('click', (e) => {
      e.stopPropagation();
      onMemoClick(memo, mark);
    });

    const parent = node.parentNode;
    if (before) parent.insertBefore(document.createTextNode(before), node);
    parent.insertBefore(mark, node);
    if (after) parent.insertBefore(document.createTextNode(after), node);
    parent.removeChild(node);
  }
}

export function clearMemos(container) {
  container.querySelectorAll('mark.memo-highlight').forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent));
  });
  container.querySelectorAll('span[data-mid]').forEach((span) => span.remove());
  container.normalize();
}

export function applyMemosToDOM(container, memos, onMemoClick) {
  if (!container) return;
  clearMemos(container);

  for (const memo of memos) {
    if (!memo.selectedText) continue;
    const textNodes = getTextNodes(container);
    if (!textNodes.length) continue;

    const { fullText, nodePositions } = buildFullText(textNodes);
    const match = findNthMatch(fullText, memo.selectedText, memo.occurrence ?? 0);
    if (!match) continue;

    wrapTextWithHighlight(nodePositions, match.index, match.index + match[0].length, memo, onMemoClick);
  }
}
