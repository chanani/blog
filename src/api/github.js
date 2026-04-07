import axios from 'axios';

const GITHUB_API = 'https://api.github.com';
const OWNER = import.meta.env.VITE_GITHUB_OWNER;
const REPO = import.meta.env.VITE_GITHUB_REPO;
const BOOKS_PATH = import.meta.env.VITE_GITHUB_PATH || 'books';
const DEV_PATH = 'dev';
const TOKEN = import.meta.env.VITE_GITHUB_TOKEN;

const githubApi = axios.create({
  baseURL: GITHUB_API,
  headers: {
    Accept: 'application/vnd.github.v3+json',
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  },
});

function decodeBase64(encoded) {
  const cleaned = encoded.replace(/\n/g, '');
  const bytes = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

// Git quotes non-ASCII paths: "\NNN\NNN..." (octal escape in double quotes)
function decodeGitQuotedName(name) {
  if (!name.startsWith('"') || !name.endsWith('"')) return name;
  const inner = name.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && i + 3 < inner.length && /^[0-7]{3}$/.test(inner.substring(i + 1, i + 4))) {
      bytes.push(parseInt(inner.substring(i + 1, i + 4), 8));
      i += 3;
      continue;
    }
    bytes.push(inner.charCodeAt(i));
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
}

function findCover(files) {
  const cover = files.find(
    (f) => f.type === 'file' && /^cover\.(png|jpe?g|webp|gif|svg)$/i.test(f.name),
  );
  if (!cover) return '';
  return `${cover.download_url}?v=${cover.sha.slice(0, 8)}`;
}

function formatChapterName(filename) {
  let name = filename.replace(/\.md$/, '');
  name = name.replace(/^\d+-?/, '');
  name = name
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return name || filename;
}

function getChapterOrder(filename) {
  const match = filename.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 999;
}

// Strip markdown syntax to get plain text
export function stripMarkdown(content) {
  return content
    .replace(/```[\s\S]*?```/g, '')       // code blocks
    .replace(/`[^`]+`/g, '')              // inline code
    .replace(/!\[.*?\]\(.*?\)/g, '')       // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links → text
    .replace(/#{1,6}\s+/g, '')             // headings
    .replace(/[*_~]{1,3}(.*?)[*_~]{1,3}/g, '$1') // bold/italic/strikethrough
    .replace(/^\s*[-*+]\s+/gm, '')         // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, '')         // ordered list markers
    .replace(/^\s*>\s+/gm, '')             // blockquotes
    .replace(/\|.*\|/g, '')                // tables
    .replace(/[-=]{3,}/g, '')              // horizontal rules
    .replace(/\n{2,}/g, '\n')             // collapse blank lines
    .trim();
}

// Fetch all chapter contents with concurrency limit
export async function fetchAllChapterContents(books, onProgress) {
  const results = [];
  let completed = 0;
  const total = { value: 0 };

  // First, gather all chapter entries per book
  const bookChapterEntries = await Promise.all(
    books.map(async (book) => {
      try {
        const basePath = `${BOOKS_PATH}/${encodeURIComponent(book.slug)}`;
        const { data: entries } = await githubApi.get(
          `/repos/${OWNER}/${REPO}/contents/${basePath}`,
        );

        const chapters = [];
        const subDirs = [];

        for (const entry of entries) {
          const eName = decodeGitQuotedName(entry.name);
          if (entry.type === 'file' && eName.endsWith('.md') && eName !== 'index.md') {
            chapters.push({
              name: formatChapterName(eName),
              path: eName.replace(/\.md$/, ''),
              filePath: `${BOOKS_PATH}/${book.slug}/${eName}`,
            });
          } else if (entry.type === 'dir') {
            subDirs.push(eName);
          }
        }

        // Fetch subdirectory chapters
        const subResults = await Promise.all(
          subDirs.map(async (folderName) => {
            try {
              const { data: subEntries } = await githubApi.get(
                `/repos/${OWNER}/${REPO}/contents/${basePath}/${encodeURIComponent(folderName)}`,
              );
              return subEntries
                .filter((e) => e.type === 'file' && decodeGitQuotedName(e.name).endsWith('.md'))
                .map((e) => {
                  const seName = decodeGitQuotedName(e.name);
                  return {
                    name: formatChapterName(seName),
                    path: `${folderName}/${seName.replace(/\.md$/, '')}`,
                    filePath: `${BOOKS_PATH}/${book.slug}/${folderName}/${seName}`,
                  };
                });
            } catch {
              return [];
            }
          }),
        );

        subResults.forEach((sub) => chapters.push(...sub));

        return { book, chapters };
      } catch {
        return { book, chapters: [] };
      }
    }),
  );

  // Count total chapters
  const allTasks = [];
  for (const { book, chapters } of bookChapterEntries) {
    for (const ch of chapters) {
      allTasks.push({ book, chapter: ch });
    }
  }
  total.value = allTasks.length;
  onProgress?.(0, total.value);

  // Fetch content with concurrency limit of 5
  const concurrency = 5;
  let cursor = 0;

  async function runNext() {
    while (cursor < allTasks.length) {
      const idx = cursor++;
      const { book, chapter } = allTasks[idx];
      try {
        const { data } = await githubApi.get(
          `/repos/${OWNER}/${REPO}/contents/${chapter.filePath}`,
        );
        const content = decodeBase64(data.content);
        const plainText = stripMarkdown(content);

        results.push({
          bookSlug: book.slug,
          bookTitle: book.title,
          chapterPath: chapter.path,
          chapterName: chapter.name,
          plainText,
        });
      } catch {
        // skip failed chapters
      }
      completed++;
      onProgress?.(completed, total.value);
    }
  }

  const workers = Array.from({ length: concurrency }, () => runNext());
  await Promise.all(workers);

  return results;
}

// Fetch all books
export async function fetchBookList() {
  const { data: dirs } = await githubApi.get(
    `/repos/${OWNER}/${REPO}/contents/${BOOKS_PATH}`,
  );

  const bookDirs = dirs.filter((d) => d.type === 'dir');

  const books = await Promise.all(
    bookDirs.map(async (dir) => {
      const decodedName = decodeGitQuotedName(dir.name);
      try {
        // List book folder to find info.json + cover image
        const { data: files } = await githubApi.get(
          `/repos/${OWNER}/${REPO}/contents/${BOOKS_PATH}/${encodeURIComponent(decodedName)}`,
        );

        const infoEntry = files.find((f) => f.name === 'info.json');
        let info = { title: decodedName.replace(/[-_]/g, ' ') };
        if (infoEntry) {
          const { data: infoData } = await githubApi.get(infoEntry.url);
          info = JSON.parse(decodeBase64(infoData.content));
        }

        return {
          slug: decodedName,
          cover: findCover(files),
          ...info,
        };
      } catch {
        return {
          slug: decodedName,
          title: decodedName.replace(/[-_]/g, ' '),
          cover: '',
        };
      }
    }),
  );

  return books.sort((a, b) => {
    if (a.date && b.date) return new Date(b.date) - new Date(a.date);
    return (a.title || '').localeCompare(b.title || '');
  });
}

// Fetch book detail: info + chapter list
export async function fetchBookDetail(bookSlug) {
  const encodedSlug = encodeURIComponent(bookSlug);
  const basePath = `${BOOKS_PATH}/${encodedSlug}`;

  const { data: entries } = await githubApi.get(
    `/repos/${OWNER}/${REPO}/contents/${basePath}`,
  );

  // info.json
  const infoEntry = entries.find((e) => decodeGitQuotedName(e.name) === 'info.json');
  let info = { title: bookSlug };
  if (infoEntry) {
    const { data: infoData } = await githubApi.get(
      `/repos/${OWNER}/${REPO}/contents/${basePath}/info.json`,
    );
    info = JSON.parse(decodeBase64(infoData.content));
  }

  // Cover
  const decodedEntries = entries.map((e) => ({ ...e, name: decodeGitQuotedName(e.name) }));
  const cover = findCover(decodedEntries);

  // Chapters
  const chapters = [];
  const subDirs = [];

  for (const entry of entries) {
    const eName = decodeGitQuotedName(entry.name);
    if (
      entry.type === 'file' &&
      eName.endsWith('.md') &&
      eName !== 'index.md'
    ) {
      chapters.push({
        name: formatChapterName(eName),
        fileName: eName,
        path: eName.replace(/\.md$/, ''),
        order: getChapterOrder(eName),
        folder: null,
      });
    } else if (entry.type === 'dir') {
      subDirs.push(eName);
    }
  }

  // Subdirectory chapters
  const subResults = await Promise.all(
    subDirs.map(async (folderName) => {
      try {
        const { data: subEntries } = await githubApi.get(
          `/repos/${OWNER}/${REPO}/contents/${basePath}/${encodeURIComponent(folderName)}`,
        );
        return subEntries
          .filter((e) => e.type === 'file' && decodeGitQuotedName(e.name).endsWith('.md'))
          .map((e) => {
            const seName = decodeGitQuotedName(e.name);
            return {
              name: formatChapterName(seName),
              fileName: seName,
              path: `${folderName}/${seName.replace(/\.md$/, '')}`,
              order: getChapterOrder(seName),
              folder: folderName
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase()),
            };
          });
      } catch {
        return [];
      }
    }),
  );

  subResults.forEach((sub) => chapters.push(...sub));

  // Fetch last commit date for each chapter
  await Promise.all(
    chapters.map(async (ch) => {
      try {
        const filePath = `${BOOKS_PATH}/${bookSlug}/${ch.path}.md`;
        const { data: commits } = await githubApi.get(
          `/repos/${OWNER}/${REPO}/commits`,
          { params: { path: filePath, per_page: 1 } },
        );
        ch.date = commits[0]
          ? formatDate(commits[0].commit.committer.date)
          : '';
      } catch {
        ch.date = '';
      }
    }),
  );

  const rootChapters = chapters
    .filter((c) => !c.folder)
    .sort((a, b) => a.order - b.order);

  const folderGroups = {};
  chapters
    .filter((c) => c.folder)
    .sort((a, b) => a.order - b.order)
    .forEach((c) => {
      if (!folderGroups[c.folder]) folderGroups[c.folder] = [];
      folderGroups[c.folder].push(c);
    });

  return {
    slug: bookSlug,
    cover,
    ...info,
    rootChapters,
    folderGroups,
    totalChapters: chapters.length,
  };
}

// Fetch discussion comment counts from giscus (GitHub Discussions)
const BLOG_REPO = 'blog';
const DISCUSSION_CATEGORY_ID = 'DIC_kwDORI3Ks84C15da';

export async function fetchDiscussionCounts(bookSlug) {
  if (!TOKEN) return {};

  try {
    const query = `{
      repository(owner: "${OWNER}", name: "${BLOG_REPO}") {
        discussions(first: 100, categoryId: "${DISCUSSION_CATEGORY_ID}") {
          nodes {
            title
            comments { totalCount }
          }
        }
      }
    }`;

    const { data } = await axios.post(
      'https://api.github.com/graphql',
      { query },
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );

    const discussions = data.data?.repository?.discussions?.nodes || [];
    const counts = {};
    const prefix = `book/${bookSlug}/read/`;

    for (const d of discussions) {
      let title;
      try {
        title = decodeURIComponent(d.title.replace(/^\//, ''));
      } catch {
        title = d.title.replace(/^\//, '');
      }

      if (title.startsWith(prefix)) {
        const chapterPath = title.slice(prefix.length);
        counts[chapterPath] = (counts[chapterPath] || 0) + d.comments.totalCount;
      }
    }

    return counts;
  } catch {
    return {};
  }
}

// Fetch dev discussion comment counts from giscus (GitHub Discussions)
export async function fetchDevDiscussionCounts() {
  if (!TOKEN) return {};

  try {
    const query = `{
      repository(owner: "${OWNER}", name: "${BLOG_REPO}") {
        discussions(first: 100, categoryId: "${DISCUSSION_CATEGORY_ID}") {
          nodes {
            title
            comments { totalCount }
          }
        }
      }
    }`;

    const { data } = await axios.post(
      'https://api.github.com/graphql',
      { query },
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );

    const discussions = data.data?.repository?.discussions?.nodes || [];
    const counts = {};
    const prefix = 'post/';

    for (const d of discussions) {
      let title;
      try {
        title = decodeURIComponent(d.title.replace(/^\//, ''));
      } catch {
        title = d.title.replace(/^\//, '');
      }

      if (title.startsWith(prefix)) {
        const key = title.slice(prefix.length);
        counts[key] = (counts[key] || 0) + d.comments.totalCount;
      }
    }

    return counts;
  } catch {
    return {};
  }
}

// Fetch commit dates (first = created, last = updated)
async function fetchCommitDates(filePath) {
  try {
    const { data: commits } = await githubApi.get(
      `/repos/${OWNER}/${REPO}/commits`,
      { params: { path: filePath, per_page: 1 } },
    );
    const lastCommit = commits[0];
    if (!lastCommit) return { createdAt: '', updatedAt: '' };

    const updatedAt = lastCommit.commit.committer.date;

    // Get first commit (created date)
    const linkHeader = commits.__headers?.link || '';
    let createdAt = updatedAt;

    // If there's pagination, fetch the last page for the first commit
    const lastPageMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
    if (lastPageMatch) {
      const { data: firstCommits } = await githubApi.get(
        `/repos/${OWNER}/${REPO}/commits`,
        { params: { path: filePath, per_page: 1, page: lastPageMatch[1] } },
      );
      if (firstCommits[0]) {
        createdAt = firstCommits[0].commit.committer.date;
      }
    }

    return { createdAt, updatedAt };
  } catch {
    return { createdAt: '', updatedAt: '' };
  }
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

// Parse YAML frontmatter from markdown content
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const yamlBlock = match[1];
  const body = match[2];
  const meta = {};

  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    // Handle quoted strings
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Handle arrays like ["tag1", "tag2"]
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }

    meta[key] = value;
  }

  return { meta, body };
}

// Find the first .md file in a list of GitHub entries
function findMarkdown(files) {
  return files.find((f) => f.type === 'file' && f.name.endsWith('.md'));
}

// Fetch dev post list from dev/ folder
// Supports two formats:
//   1. dev/category/post-name.md          (flat file, no cover)
//   2. dev/category/post-name/any.md      (folder with any .md + optional cover image)
const VISIBILITY_PATH = `${DEV_PATH}/_visibility.json`;

export async function fetchVisibility() {
  try {
    const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${VISIBILITY_PATH}`);
    return JSON.parse(decodeBase64(data.content));
  } catch {
    return {};
  }
}

export async function saveVisibility(visibility) {
  let sha;
  try {
    const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${VISIBILITY_PATH}`);
    sha = data.sha;
  } catch { sha = undefined; }

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(visibility, null, 2))));
  await githubApi.put(`/repos/${OWNER}/${REPO}/contents/${VISIBILITY_PATH}`, {
    message: 'chore: update post visibility',
    content,
    branch: 'master',
    ...(sha ? { sha } : {}),
  });
}

export async function fetchDevPostList() {
  try {
    const { data: categories } = await githubApi.get(
      `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}`,
    );

    const categoryDirs = categories.filter((d) => d.type === 'dir');
    const posts = [];

    await Promise.all(
      categoryDirs.map(async (dir) => {
        const catName = decodeGitQuotedName(dir.name);
        try {
          const { data: entries } = await githubApi.get(
            `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encodeURIComponent(catName)}`,
          );

          const tasks = entries.map(async (entry) => {
            const entryName = decodeGitQuotedName(entry.name);
            try {
              // Case 1: flat .md file
              if (entry.type === 'file' && entryName.endsWith('.md')) {
                const { data: fileData } = await githubApi.get(
                  `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encodeURIComponent(catName)}/${encodeURIComponent(entryName)}`,
                );
                const content = decodeBase64(fileData.content);
                const { meta } = parseFrontmatter(content);

                posts.push({
                  slug: entryName.replace(/\.md$/, ''),
                  category: catName,
                  title: meta.title || entryName.replace(/\.md$/, ''),
                  date: meta.date || '',
                  tags: Array.isArray(meta.tags) ? meta.tags : [],
                  description: meta.description || '',
                  cover: '',
                });
                return;
              }

              // Case 2: folder with any .md + optional cover image, OR series folder (has info.json)
              if (entry.type === 'dir') {
                const { data: folderFiles } = await githubApi.get(
                  `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encodeURIComponent(catName)}/${encodeURIComponent(entryName)}`,
                );

                // Series detection: folder contains info.json
                const hasInfoJson = folderFiles.some((f) => f.name === 'info.json');
                if (hasInfoJson) {
                  const { data: infoData } = await githubApi.get(
                    `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encodeURIComponent(catName)}/${encodeURIComponent(entryName)}/info.json`,
                  );
                  const info = JSON.parse(decodeBase64(infoData.content));
                  const episodeDirs = folderFiles.filter((f) => f.type === 'dir');
                  posts.push({
                    isSeries: true,
                    slug: entryName,
                    category: catName,
                    title: info.title || entryName,
                    description: info.description || '',
                    cover: findCover(folderFiles) || '',
                    status: info.status || '연재중',
                    episodeCount: episodeDirs.length,
                    date: info.updatedAt || '',
                    tags: Array.isArray(info.tags) ? info.tags : [],
                  });
                  return;
                }

                const mdFile = findMarkdown(folderFiles);
                if (!mdFile) return;

                const mdName = decodeGitQuotedName(mdFile.name);
                const { data: fileData } = await githubApi.get(
                  `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encodeURIComponent(catName)}/${encodeURIComponent(entryName)}/${encodeURIComponent(mdName)}`,
                );
                const content = decodeBase64(fileData.content);
                const { meta } = parseFrontmatter(content);
                const cover = findCover(folderFiles);

                posts.push({
                  slug: entryName,
                  category: catName,
                  title: meta.title || entryName,
                  date: meta.date || '',
                  tags: Array.isArray(meta.tags) ? meta.tags : [],
                  description: meta.description || '',
                  cover,
                });
              }
            } catch {
              // skip failed entries
            }
          });

          await Promise.all(tasks);
        } catch {
          // skip failed directories
        }
      }),
    );

    const seen = new Set();
    const unique = posts.filter((p) => {
      const key = `${p.category}/${p.slug}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date);
      return a.title.localeCompare(b.title);
    });
  } catch {
    return [];
  }
}

// Convert a File object to base64 string (without data URL prefix)
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Fetch a single dev post
// Tries folder format first (finds any .md inside), falls back to flat file (slug.md)
export async function fetchDevPost(category, slug) {
  let rawContent;
  let cover = '';
  let mdFilePath;
  let isFolder = false;

  const encCat = encodeURIComponent(category);
  const encSlug = encodeURIComponent(slug);

  try {
    // Try folder format first: dev/category/slug/
    const folderPath = `${DEV_PATH}/${category}/${slug}`;
    const { data: folderFiles } = await githubApi.get(
      `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encCat}/${encSlug}`,
    );

    const decodedFiles = folderFiles.map((f) => ({ ...f, name: decodeGitQuotedName(f.name) }));
    const mdFile = findMarkdown(decodedFiles);
    if (!mdFile) throw new Error('No .md file found');

    cover = findCover(decodedFiles);
    mdFilePath = `${folderPath}/${mdFile.name}`;
    isFolder = true;

    const { data: fileData } = await githubApi.get(
      `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encCat}/${encSlug}/${encodeURIComponent(mdFile.name)}`,
    );
    rawContent = decodeBase64(fileData.content);
  } catch {
    // Fall back to flat file: dev/category/slug.md
    mdFilePath = `${DEV_PATH}/${category}/${slug}.md`;
    const { data: fileData } = await githubApi.get(
      `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encCat}/${encSlug}.md`,
    );
    rawContent = decodeBase64(fileData.content);
  }

  const dates = await fetchCommitDates(mdFilePath);
  const { meta, body } = parseFrontmatter(rawContent);

  return {
    slug,
    category,
    title: meta.title || slug,
    date: meta.date || '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    description: meta.description || '',
    cover,
    isFolder,
    content: body,
    createdAt: formatDate(dates.createdAt),
    updatedAt: formatDate(dates.updatedAt),
  };
}

// Fetch dev post folder tree (lightweight - no content fetching)
export async function fetchDevTree() {
  try {
    const { data: categories } = await githubApi.get(
      `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}`,
    );
    const categoryDirs = categories.filter((d) => d.type === 'dir');

    const result = await Promise.all(
      categoryDirs.map(async (dir) => {
        const catName = decodeGitQuotedName(dir.name);
        try {
          const { data: entries } = await githubApi.get(
            `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encodeURIComponent(catName)}`,
          );
          const eligible = entries.filter((e) => {
            const eName = decodeGitQuotedName(e.name);
            return (e.type === 'file' && eName.endsWith('.md')) || e.type === 'dir';
          });

          const slugs = await Promise.all(
            eligible.map(async (e) => {
              const eName = decodeGitQuotedName(e.name).replace(/\.md$/, '');
              if (e.type !== 'dir') return { name: eName, isSeries: false };
              try {
                const { data: slugFiles } = await githubApi.get(
                  `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encodeURIComponent(catName)}/${encodeURIComponent(eName)}`,
                );
                const hasInfoJson = slugFiles.some((f) => f.name === 'info.json');
                if (hasInfoJson) {
                  const episodes = slugFiles
                    .filter((f) => f.type === 'dir')
                    .map((f) => decodeGitQuotedName(f.name));
                  return { name: eName, isSeries: true, episodes };
                }
              } catch { /* skip */ }
              return { name: eName, isSeries: false };
            }),
          );

          return { category: catName, slugs };
        } catch {
          return { category: catName, slugs: [] };
        }
      }),
    );

    return result.filter((c) => c.slugs.length > 0);
  } catch {
    return [];
  }
}

// Fetch book chapter tree (lightweight - no content fetching)
export async function fetchBookTree() {
  try {
    const { data: dirs } = await githubApi.get(
      `/repos/${OWNER}/${REPO}/contents/${BOOKS_PATH}`,
    );
    const bookDirs = dirs.filter((d) => d.type === 'dir');

    const result = await Promise.all(
      bookDirs.map(async (dir) => {
        const bookSlug = decodeGitQuotedName(dir.name);
        try {
          const { data: entries } = await githubApi.get(
            `/repos/${OWNER}/${REPO}/contents/${BOOKS_PATH}/${encodeURIComponent(bookSlug)}`,
          );

          const chapters = [];
          const subDirs = [];

          for (const entry of entries) {
            const eName = decodeGitQuotedName(entry.name);
            if (entry.type === 'file' && eName.endsWith('.md') && eName !== 'index.md') {
              chapters.push({ name: eName, path: eName.replace(/\.md$/, '') });
            } else if (entry.type === 'dir' && !['images', 'assets'].includes(eName)) {
              subDirs.push(eName);
            }
          }

          await Promise.all(
            subDirs.map(async (folderName) => {
              try {
                const { data: subEntries } = await githubApi.get(
                  `/repos/${OWNER}/${REPO}/contents/${BOOKS_PATH}/${encodeURIComponent(bookSlug)}/${encodeURIComponent(folderName)}`,
                );
                subEntries
                  .filter((e) => e.type === 'file' && decodeGitQuotedName(e.name).endsWith('.md'))
                  .forEach((e) => {
                    const seName = decodeGitQuotedName(e.name);
                    chapters.push({
                      name: `${folderName}/${seName}`,
                      path: `${folderName}/${seName.replace(/\.md$/, '')}`,
                    });
                  });
              } catch {
                // skip
              }
            }),
          );

          return { bookSlug, chapters };
        } catch {
          return { bookSlug, chapters: [] };
        }
      }),
    );

    return result;
  } catch {
    return [];
  }
}

// Save a book chapter to GitHub (create or update)
export async function saveBookChapter({ bookSlug, chapterPath, content }) {
  const filePath = `${BOOKS_PATH}/${bookSlug}/${chapterPath}.md`;
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const encoded = btoa(unescape(encodeURIComponent(content)));

  let sha;
  try {
    const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${encodedPath}`);
    sha = data.sha;
  } catch {
    sha = undefined;
  }

  const body = {
    message: sha ? `docs: update chapter ${bookSlug}/${chapterPath}` : `docs: add chapter ${bookSlug}/${chapterPath}`,
    content: encoded,
    branch: 'master',
    ...(sha ? { sha } : {}),
  };

  const { data } = await githubApi.put(`/repos/${OWNER}/${REPO}/contents/${encodedPath}`, body);
  return data;
}

// Save a dev post to GitHub (create or update)
// Structure: dev/{category}/{slug}/{slug}.md  +  optional cover.{ext}
export async function saveDevPost({ category, slug, title, date, tags, description, content, coverFile }) {
  const tagStr = Array.isArray(tags) ? `[${tags.map((t) => `"${t}"`).join(', ')}]` : '[]';
  const frontmatter = `---\ntitle: "${title}"\ndate: "${date}"\ntags: ${tagStr}\ndescription: "${description}"\n---\n`;
  const encoded = btoa(unescape(encodeURIComponent(frontmatter + content)));

  // Always folder format: dev/{category}/{slug}/{slug}.md
  const mdFilePath = `${DEV_PATH}/${category}/${slug}/${slug}.md`;
  const mdEncodedPath = mdFilePath.split('/').map(encodeURIComponent).join('/');

  let sha;
  try {
    const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${mdEncodedPath}`);
    sha = data.sha;
  } catch {
    sha = undefined;
  }

  await githubApi.put(`/repos/${OWNER}/${REPO}/contents/${mdEncodedPath}`, {
    message: sha ? `docs: update post ${category}/${slug}` : `docs: add post ${category}/${slug}`,
    content: encoded,
    branch: 'master',
    ...(sha ? { sha } : {}),
  });

  if (coverFile) {
    const ext = coverFile.name.split('.').pop().toLowerCase();
    const coverEncodedPath = `${DEV_PATH}/${category}/${slug}/cover.${ext}`
      .split('/').map(encodeURIComponent).join('/');
    const coverBase64 = await fileToBase64(coverFile);

    let coverSha;
    try {
      const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${coverEncodedPath}`);
      coverSha = data.sha;
    } catch {
      coverSha = undefined;
    }

    await githubApi.put(`/repos/${OWNER}/${REPO}/contents/${coverEncodedPath}`, {
      message: `docs: ${coverSha ? 'update' : 'add'} cover for ${category}/${slug}`,
      content: coverBase64,
      branch: 'master',
      ...(coverSha ? { sha: coverSha } : {}),
    });
  }
}

// Delete a file from GitHub
export async function uploadImage({ imagePath, file }) {
  const base64 = await fileToBase64(file);
  const encodedPath = imagePath.split('/').map(encodeURIComponent).join('/');

  let sha;
  try {
    const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${encodedPath}`);
    sha = data.sha;
  } catch {
    sha = undefined;
  }

  await githubApi.put(`/repos/${OWNER}/${REPO}/contents/${encodedPath}`, {
    message: `docs: add image ${file.name}`,
    content: base64,
    branch: 'master',
    ...(sha ? { sha } : {}),
  });
}

export async function fetchSeriesInfo(category, seriesSlug) {
  const encCat = encodeURIComponent(category);
  const encSlug = encodeURIComponent(seriesSlug);

  const { data: folderFiles } = await githubApi.get(
    `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encCat}/${encSlug}`,
  );

  const { data: infoData } = await githubApi.get(
    `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encCat}/${encSlug}/info.json`,
  );
  const info = JSON.parse(decodeBase64(infoData.content));
  const cover = findCover(folderFiles) || '';

  const episodeDirs = folderFiles.filter((f) => f.type === 'dir');
  const episodes = await Promise.all(
    episodeDirs.map(async (epDir) => {
      const epName = decodeGitQuotedName(epDir.name);
      try {
        const { data: epFiles } = await githubApi.get(
          `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encCat}/${encSlug}/${encodeURIComponent(epName)}`,
        );
        const decodedEpFiles = epFiles.map((f) => ({ ...f, name: decodeGitQuotedName(f.name) }));
        const mdFile = findMarkdown(decodedEpFiles);
        if (!mdFile) return null;
        const { data: mdData } = await githubApi.get(
          `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encCat}/${encSlug}/${encodeURIComponent(epName)}/${encodeURIComponent(mdFile.name)}`,
        );
        const { meta } = parseFrontmatter(decodeBase64(mdData.content));
        return {
          slug: epName,
          title: meta.title || epName,
          date: meta.date || '',
          episode: meta.episode ? Number(meta.episode) : null,
          description: meta.description || '',
        };
      } catch {
        return null;
      }
    }),
  );

  const validEpisodes = episodes
    .filter(Boolean)
    .sort((a, b) => (a.episode ?? 999) - (b.episode ?? 999));

  return { ...info, cover, slug: seriesSlug, category, episodes: validEpisodes };
}

export async function fetchSeriesEpisode(category, seriesSlug, episodeSlug) {
  const encCat = encodeURIComponent(category);
  const encSeries = encodeURIComponent(seriesSlug);
  const encEp = encodeURIComponent(episodeSlug);

  const { data: epFiles } = await githubApi.get(
    `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encCat}/${encSeries}/${encEp}`,
  );
  const decodedFiles = epFiles.map((f) => ({ ...f, name: decodeGitQuotedName(f.name) }));
  const mdFile = findMarkdown(decodedFiles);
  if (!mdFile) throw new Error('No .md file found in episode folder');

  const { data: fileData } = await githubApi.get(
    `/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encCat}/${encSeries}/${encEp}/${encodeURIComponent(mdFile.name)}`,
  );
  const rawContent = decodeBase64(fileData.content);
  const mdFilePath = `${DEV_PATH}/${category}/${seriesSlug}/${episodeSlug}/${mdFile.name}`;
  const dates = await fetchCommitDates(mdFilePath);
  const { meta, body } = parseFrontmatter(rawContent);

  return {
    slug: episodeSlug,
    seriesSlug,
    category,
    title: meta.title || episodeSlug,
    date: meta.date || '',
    episode: meta.episode ? Number(meta.episode) : null,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    description: meta.description || '',
    cover: findCover(decodedFiles),
    isFolder: true,
    content: body,
    createdAt: formatDate(dates.createdAt),
    updatedAt: formatDate(dates.updatedAt),
  };
}

export async function saveSeriesInfo({ category, seriesSlug, title, description, status, tags, updatedAt, coverFile }) {
  const encCat = encodeURIComponent(category);
  const encSlug = encodeURIComponent(seriesSlug);
  const infoPath = `${DEV_PATH}/${category}/${seriesSlug}/info.json`;
  const encodedInfoPath = `${DEV_PATH}/${encCat}/${encSlug}/info.json`;

  // Get existing sha if any
  let sha;
  try {
    const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${encodedInfoPath}`);
    sha = data.sha;
  } catch { sha = undefined; }

  const info = { title, description, status, tags, updatedAt: updatedAt || new Date().toISOString().slice(0, 10) };
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(info, null, 2))));

  await githubApi.put(`/repos/${OWNER}/${REPO}/contents/${encodedInfoPath}`, {
    message: `docs: ${sha ? 'update' : 'create'} series info ${category}/${seriesSlug}`,
    content,
    branch: 'master',
    ...(sha ? { sha } : {}),
  });

  if (coverFile) {
    const coverBase64 = await fileToBase64(coverFile);
    const ext = coverFile.name.split('.').pop();
    const coverPath = `${DEV_PATH}/${encCat}/${encSlug}/cover.${ext}`;
    let coverSha;
    try {
      const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${coverPath}`);
      coverSha = data.sha;
    } catch { coverSha = undefined; }
    await githubApi.put(`/repos/${OWNER}/${REPO}/contents/${coverPath}`, {
      message: `docs: add cover for series ${category}/${seriesSlug}`,
      content: coverBase64,
      branch: 'master',
      ...(coverSha ? { sha: coverSha } : {}),
    });
  }
}

export async function saveSeriesEpisode({ category, seriesSlug, episodeSlug, title, date, episode, tags, description, content: mdContent }) {
  const encCat = encodeURIComponent(category);
  const encSeries = encodeURIComponent(seriesSlug);
  const encEp = encodeURIComponent(episodeSlug);
  const mdPath = `${DEV_PATH}/${encCat}/${encSeries}/${encEp}/${encEp}.md`;

  const frontmatter = [
    '---',
    `title: "${title}"`,
    `date: "${date}"`,
    episode != null ? `episode: ${episode}` : null,
    `tags: [${tags.map((t) => `"${t}"`).join(', ')}]`,
    description ? `description: "${description}"` : null,
    '---',
  ].filter(Boolean).join('\n');

  const fullContent = `${frontmatter}\n\n${mdContent}`;
  const encoded = btoa(unescape(encodeURIComponent(fullContent)));

  let sha;
  try {
    const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${mdPath}`);
    sha = data.sha;
  } catch { sha = undefined; }

  await githubApi.put(`/repos/${OWNER}/${REPO}/contents/${mdPath}`, {
    message: `docs: ${sha ? 'update' : 'add'} episode ${category}/${seriesSlug}/${episodeSlug}`,
    content: encoded,
    branch: 'master',
    ...(sha ? { sha } : {}),
  });

  // Also update info.json updatedAt
  try {
    const infoPath = `${DEV_PATH}/${encCat}/${encSeries}/info.json`;
    const { data: infoData } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${infoPath}`);
    const info = JSON.parse(decodeBase64(infoData.content));
    info.updatedAt = date || new Date().toISOString().slice(0, 10);
    const updatedContent = btoa(unescape(encodeURIComponent(JSON.stringify(info, null, 2))));
    await githubApi.put(`/repos/${OWNER}/${REPO}/contents/${infoPath}`, {
      message: `docs: update series updatedAt for ${seriesSlug}`,
      content: updatedContent,
      branch: 'master',
      sha: infoData.sha,
    });
  } catch { /* best effort */ }
}

export async function fetchFolderFiles(folderPath) {
  const encodedPath = folderPath.split('/').map(encodeURIComponent).join('/');
  try {
    const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${encodedPath}`);
    return Array.isArray(data) ? data.filter((f) => f.type === 'file') : [];
  } catch {
    return [];
  }
}

export async function deleteGithubFile({ filePath, message }) {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${encodedPath}`);
  await githubApi.delete(`/repos/${OWNER}/${REPO}/contents/${encodedPath}`, {
    data: { message, sha: data.sha, branch: 'master' },
  });
}

// Copy a file to a new path (read → write)
export async function copyGithubFile({ fromPath, toPath, message }) {
  const encodedFrom = fromPath.split('/').map(encodeURIComponent).join('/');
  const { data: src } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${encodedFrom}`);

  const encodedTo = toPath.split('/').map(encodeURIComponent).join('/');
  let toSha;
  try {
    const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${encodedTo}`);
    toSha = data.sha;
  } catch {
    toSha = undefined;
  }

  await githubApi.put(`/repos/${OWNER}/${REPO}/contents/${encodedTo}`, {
    message,
    content: src.content.replace(/\n/g, ''), // already base64
    branch: 'master',
    ...(toSha ? { sha: toSha } : {}),
  });
}

// Fetch a book's info.json
export async function fetchBookInfo(bookSlug) {
  const encodedPath = `${BOOKS_PATH}/${bookSlug}/info.json`
    .split('/').map(encodeURIComponent).join('/');
  const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${encodedPath}`);
  return JSON.parse(decodeBase64(data.content));
}

// Create or update a book (info.json + optional cover)
// Structure: books/{bookSlug}/info.json  +  optional cover.{ext}
export async function saveNewBook({ bookSlug, title, subtitle, author, publisher, totalPages, category, rating, tags, excerpt, date, status, coverFile }) {
  const info = {
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(author ? { author } : {}),
    ...(publisher ? { publisher } : {}),
    ...(totalPages ? { totalPages: Number(totalPages) } : {}),
    ...(category ? { category } : {}),
    ...(rating !== '' && rating != null ? { rating: Number(rating) } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(excerpt ? { excerpt } : {}),
    ...(date ? { date } : {}),
    ...(status ? { status } : {}),
  };
  const infoEncoded = btoa(unescape(encodeURIComponent(JSON.stringify(info, null, 2))));
  const infoEncodedPath = `${BOOKS_PATH}/${bookSlug}/info.json`
    .split('/').map(encodeURIComponent).join('/');

  let infoSha;
  try {
    const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${infoEncodedPath}`);
    infoSha = data.sha;
  } catch {
    infoSha = undefined;
  }

  await githubApi.put(`/repos/${OWNER}/${REPO}/contents/${infoEncodedPath}`, {
    message: infoSha ? `docs: update book info ${bookSlug}` : `docs: add book ${bookSlug}`,
    content: infoEncoded,
    branch: 'master',
    ...(infoSha ? { sha: infoSha } : {}),
  });

  if (coverFile) {
    const ext = coverFile.name.split('.').pop().toLowerCase();
    const coverEncodedPath = `${BOOKS_PATH}/${bookSlug}/cover.${ext}`
      .split('/').map(encodeURIComponent).join('/');
    const coverBase64 = await fileToBase64(coverFile);

    let coverSha;
    try {
      const { data } = await githubApi.get(`/repos/${OWNER}/${REPO}/contents/${coverEncodedPath}`);
      coverSha = data.sha;
    } catch {
      coverSha = undefined;
    }

    await githubApi.put(`/repos/${OWNER}/${REPO}/contents/${coverEncodedPath}`, {
      message: `docs: ${coverSha ? 'update' : 'add'} cover for book ${bookSlug}`,
      content: coverBase64,
      branch: 'master',
      ...(coverSha ? { sha: coverSha } : {}),
    });
  }
}

// Fetch a single chapter
export async function fetchChapter(bookSlug, chapterPath) {
  const filePath = `${BOOKS_PATH}/${bookSlug}/${chapterPath}.md`;
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');

  const [fileRes, dates] = await Promise.all([
    githubApi.get(`/repos/${OWNER}/${REPO}/contents/${encodedPath}`),
    fetchCommitDates(filePath),
  ]);

  const content = decodeBase64(fileRes.data.content);
  const fileName = decodeGitQuotedName(fileRes.data.name);

  return {
    bookSlug,
    path: chapterPath,
    fileName,
    title: formatChapterName(fileName),
    content,
    createdAt: formatDate(dates.createdAt),
    updatedAt: formatDate(dates.updatedAt),
  };
}
