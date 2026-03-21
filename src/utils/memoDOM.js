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

function insertIconAfterText(nodePositions, idx, end, memo, onMemoClick) {
  const affected = nodePositions.filter(
    ({ node, start }) => start < end && start + node.textContent.length > idx
  );
  if (!affected.length) return;

  const last = affected[affected.length - 1];
  const { node, start: nodeStart } = last;
  const hlEnd = Math.min(node.textContent.length, end - nodeStart);

  const after = node.textContent.slice(hlEnd);
  const before = node.textContent.slice(0, hlEnd);

  const icon = document.createElement('span');
  icon.className = 'memo-icon';
  icon.dataset.mid = memo.id;
  icon.textContent = '📝';
  icon.title = memo.note;
  icon.addEventListener('click', (e) => {
    e.stopPropagation();
    onMemoClick(memo, icon);
  });

  const parent = node.parentNode;
  if (before) parent.insertBefore(document.createTextNode(before), node);
  parent.insertBefore(icon, node);
  if (after) parent.insertBefore(document.createTextNode(after), node);
  parent.removeChild(node);
}

export function clearMemos(container) {
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

    insertIconAfterText(nodePositions, match.index, match.index + match[0].length, memo, onMemoClick);
  }
}
