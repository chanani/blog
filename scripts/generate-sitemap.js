import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'https://chanhan.blog';
const GITHUB_API = 'https://api.github.com';

const OWNER = process.env.VITE_GITHUB_OWNER || 'chanani';
const REPO = process.env.VITE_GITHUB_REPO || 'blog-posts';
const BOOKS_PATH = process.env.VITE_GITHUB_PATH || 'books';
const DEV_PATH = 'dev';
const TOKEN = process.env.VITE_GITHUB_TOKEN || '';

const headers = {
  Accept: 'application/vnd.github.v3+json',
};
if (TOKEN) {
  headers.Authorization = `token ${TOKEN}`;
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
  return Buffer.from(bytes).toString('utf-8');
}

async function fetchJSON(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.warn(`Failed to fetch ${url}: ${res.status}`);
    return null;
  }
  return res.json();
}

async function generateSitemap() {
  const today = new Date().toISOString().split('T')[0];

  // Static pages
  const urls = [
    { loc: '/', changefreq: 'weekly', priority: '1.0' },
    { loc: '/books', changefreq: 'weekly', priority: '0.8' },
    { loc: '/books/reading', changefreq: 'weekly', priority: '0.7' },
    { loc: '/about', changefreq: 'monthly', priority: '0.6' },
  ];

  // Fetch dev post directories
  const devDirs = await fetchJSON(
    `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${DEV_PATH}`
  );

  if (devDirs && Array.isArray(devDirs)) {
    for (const dir of devDirs) {
      if (dir.type !== 'dir') continue;
      const catName = decodeGitQuotedName(dir.name);

      const files = await fetchJSON(
        `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${DEV_PATH}/${encodeURIComponent(catName)}`
      );
      if (files && Array.isArray(files)) {
        for (const file of files) {
          const fileName = decodeGitQuotedName(file.name);
          if (file.type === 'file' && fileName.endsWith('.md')) {
            const slug = fileName.replace(/\.md$/, '');
            urls.push({
              loc: `/post/${catName}/${slug}`,
              changefreq: 'weekly',
              priority: '0.8',
            });
          }
        }
      }
    }
  }

  // Fetch book directories
  const books = await fetchJSON(
    `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${BOOKS_PATH}`
  );

  if (books && Array.isArray(books)) {
    for (const item of books) {
      if (item.type !== 'dir') continue;

      const slug = decodeGitQuotedName(item.name);
      urls.push({
        loc: `/book/${slug}`,
        changefreq: 'weekly',
        priority: '0.7',
      });

      // Fetch chapters for each book
      const contents = await fetchJSON(
        `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${BOOKS_PATH}/${encodeURIComponent(slug)}`
      );

      if (contents && Array.isArray(contents)) {
        for (const file of contents) {
          const fName = decodeGitQuotedName(file.name);
          if (file.type === 'file' && fName.endsWith('.md')) {
            const chapterPath = fName.replace(/\.md$/, '');
            urls.push({
              loc: `/book/${slug}/read/${chapterPath}`,
              changefreq: 'monthly',
              priority: '0.5',
            });
          }
          // Handle subdirectories (folder groups)
          if (file.type === 'dir' && fName !== '.git') {
            const subContents = await fetchJSON(
              `${GITHUB_API}/repos/${OWNER}/${REPO}/contents/${BOOKS_PATH}/${encodeURIComponent(slug)}/${encodeURIComponent(fName)}`
            );
            if (subContents && Array.isArray(subContents)) {
              for (const subFile of subContents) {
                const subName = decodeGitQuotedName(subFile.name);
                if (subFile.type === 'file' && subName.endsWith('.md')) {
                  const chapterPath = `${fName}/${subName.replace(/\.md$/, '')}`;
                  urls.push({
                    loc: `/book/${slug}/read/${chapterPath}`,
                    changefreq: 'monthly',
                    priority: '0.5',
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE_URL}${encodeURI(u.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  // Write to both public (for dev) and dist (for build)
  const publicPath = path.resolve(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(publicPath, xml, 'utf-8');
  console.log(`Sitemap generated with ${urls.length} URLs → ${publicPath}`);

  const distPath = path.resolve(__dirname, '../dist/sitemap.xml');
  if (fs.existsSync(path.dirname(distPath))) {
    fs.writeFileSync(distPath, xml, 'utf-8');
    console.log(`Sitemap also written to → ${distPath}`);
  }
}

generateSitemap().catch(console.error);
