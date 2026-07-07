import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUT_DIR = 'D:\\flowwright\\langgraph-docs';
const BASE_URL = 'https://docs.langchain.com/oss/javascript/langgraph';

const pages = [
  'overview',
  'install',
  'quickstart',
  'local-server',
  'thinking-in-langgraph',
  'workflows-agents',
  'persistence',
  'fault-tolerance',
  'checkpointers',
  'stores',
  'event-streaming',
  'streaming',
  'interrupts',
  'use-time-travel',
  'add-memory',
  'use-subgraphs',
  'application-structure',
  'test',
  'backward-compatibility',
  'studio',
  'ui',
  'deploy',
  'observability',
  'frontend/overview',
  'frontend/graph-execution',
  'frontend/custom-stream-channels',
  'pregel',
];

const extractFn = () => {
  const main = document.querySelector('main');
  if (!main) return '';
  const container = main.querySelector('article') || main;
  let md = '';
  function walk(el) {
    const tag = el.tagName?.toLowerCase() || '';
    const cls = typeof el.className === 'string' ? el.className : '';
    if (el.hidden || el.getAttribute('role') === 'navigation') return;
    if (cls.includes('table-of-contents')) return;
    if (['svg','path','img','button','style','script','nav','link','meta'].includes(tag)) return;
    if (['h1','h2','h3','h4'].includes(tag)) {
      md += '\n' + '#'.repeat(Number(tag[1])) + ' ' + el.textContent.trim() + '\n\n';
      return;
    }
    if (tag === 'p') {
      const t = el.textContent.trim();
      if (t && t !== 'Was this page helpful?') md += t + '\n\n';
      return;
    }
    if (tag === 'pre') {
      const code = el.querySelector('code');
      md += '\n```typescript\n' + (code?.textContent || el.textContent) + '\n```\n\n';
      return;
    }
    if (tag === 'ul') {
      Array.from(el.children).forEach(li => { if (li.tagName === 'LI') md += '- ' + li.textContent.trim() + '\n'; });
      md += '\n';
      return;
    }
    if (tag === 'ol') {
      Array.from(el.children).forEach((li, i) => { if (li.tagName === 'LI') md += (i+1) + '. ' + li.textContent.trim() + '\n'; });
      md += '\n';
      return;
    }
    if (tag === 'blockquote') { md += '> ' + el.textContent.trim().replace(/\n/g, '\n> ') + '\n\n'; return; }
    if (tag === 'hr') { md += '\n---\n\n'; return; }
    if (tag === 'code' && el.parentElement?.tagName !== 'PRE') { md += '`' + el.textContent + '`'; return; }
    if (el.children && el.children.length > 0) {
      for (const child of el.children) walk(child);
    }
  }
  for (const child of container.children) walk(child);
  return md;
};

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const allContent = [];

  for (const slug of pages) {
    const url = `${BASE_URL}/${slug}`;
    console.log(`Fetching: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(1500);

      const content = await page.evaluate(extractFn);
      const title = await page.title();
      const cleanTitle = title.replace(' - Docs by LangChain', '');

      // Save individual file
      const fileName = slug.replace(/\//g, '-') + '.md';
      const filePath = join(OUT_DIR, fileName);
      const md = `# ${cleanTitle}\n\n> Source: <${url}>\n\n${content}`;
      writeFileSync(filePath, md, 'utf-8');
      console.log(`  ✅ Saved: ${fileName} (${content.length} chars)`);

      allContent.push({ slug, title: cleanTitle, url, content });
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
    }
  }

  // Compile all into one file
  let fullDoc = `# LangGraph JavaScript/TypeScript SDK — Complete Developer Guide\n\n`;
  fullDoc += `> Automatically scraped from [docs.langchain.com](https://docs.langchain.com/oss/javascript/langgraph/overview)\n`;
  fullDoc += `> Date: ${new Date().toISOString().split('T')[0]}\n`;
  fullDoc += `> Total pages: ${allContent.length}\n\n`;
  fullDoc += `---\n\n`;
  fullDoc += `## Table of Contents\n\n`;
  for (const item of allContent) {
    fullDoc += `- [${item.title}](#${item.slug.replace(/\//g, '-').toLowerCase()})\n`;
  }
  fullDoc += `\n---\n\n`;

  for (const item of allContent) {
    fullDoc += `<a id="${item.slug.replace(/\//g, '-').toLowerCase()}"></a>\n\n`;
    fullDoc += `# ${item.title}\n\n`;
    fullDoc += `> Source: <${item.url}>\n\n`;
    fullDoc += item.content;
    fullDoc += `\n---\n\n`;
  }

  const fullPath = join(OUT_DIR, 'langgraph-complete-guide.md');
  writeFileSync(fullPath, fullDoc, 'utf-8');
  console.log(`\n📚 Complete guide saved: ${fullPath}`);
  console.log(`   Total size: ${fullDoc.length} chars`);
  console.log(`   Pages: ${allContent.length}/${pages.length}`);

  await browser.close();
}

main().catch(console.error);
