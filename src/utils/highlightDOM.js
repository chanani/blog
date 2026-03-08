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

function clearHighlights(container) {
  container.querySelectorAll('mark[data-hid]').forEach((mark) => {
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  container.normalize();
}

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
      break;
    }
  }
}
