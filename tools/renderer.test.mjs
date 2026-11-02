import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderWebsite } from '../admin/site-renderer.mjs';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/editor-site.json', import.meta.url), 'utf8'));
const copy = () => structuredClone(fixture);

test('shared renderer emits one page whose navigation links to every section', () => {
  const pages = renderWebsite(copy());
  assert.deepEqual(Object.keys(pages), ['index.html']);
  const html = pages['index.html'];
  for (const [hash, id] of [['#home', 'home'], ['#publications', 'publications'], ['#people', 'people'], ['#join', 'join'], ['#contact', 'contact']]) {
    assert.ok(html.includes(`id="${id}"`), id);
    assert.ok(html.includes(`href="${hash}"`), hash);
  }
  assert.equal(html.match(/<h1\b/g)?.length, 1, 'the merged page keeps a single h1');
  assert.ok(!/href="\.\/(publications|team|join|contact)\.html"/.test(html), 'no links to removed pages');
});

test('rendering leaves the editable data unchanged', () => {
  const data = copy();
  const before = structuredClone(data);
  renderWebsite(data);
  assert.deepEqual(data, before);
});

test('draft photos render from a blob URL without a file on disk', () => {
  const data = copy();
  const upload = 'assets/images/unpublished-portrait.jpg';
  const blob = 'blob:https://malab-tju.github.io/f20ba30b-a880-42d5-a54e-65d5306d5e21';
  data.site.image = upload;
  data.team.teachers[0].photo = upload;
  const visited = [];
  const pages = renderWebsite(data, { imageUrl: path => {
    visited.push(path);
    return path === upload ? blob : undefined;
  } });
  assert.ok(visited.includes(upload));
  assert.equal(pages['index.html'].split('src="' + blob + '"').length - 1, 2, 'portrait and faculty photo use the blob URL');
  assert.ok(!pages['index.html'].includes('src="' + upload + '"'));
});

test('unmapped images keep the published relative paths', () => {
  assert.deepEqual(renderWebsite(copy(), { imageUrl: () => undefined }), renderWebsite(copy()));
  assert.deepEqual(renderWebsite(copy(), { imageUrl: path => path }), renderWebsite(copy()));
});

test('preview image overrides reject executable or invalid URLs', () => {
  for (const imageUrl of [() => 'javascript:alert(1)', () => 'data:image/svg+xml,<svg onload=alert(1)>', () => 'https://example.org/photo\n.jpg', () => 7]) {
    assert.throws(() => renderWebsite(copy(), { imageUrl }), /Preview image URLs/);
  }
  assert.throws(() => renderWebsite(copy(), { imageUrl: 'not a function' }), /imageUrl must be a function/);
});

test('image paths reject traversal and external sources before mapping', () => {
  for (const image of ['../portrait.jpg', 'https://example.org/portrait.jpg', 'assets/../portrait.jpg', 'assets/\\portrait.jpg', 'assets/images/portrait\u0000.jpg']) {
    const data = copy();
    data.site.image = image;
    let called = false;
    assert.throws(() => renderWebsite(data, { imageUrl: () => { called = true; return 'blob:null/test'; } }), /Image paths must be inside assets/);
    assert.equal(called, false);
  }
});

test('user text is escaped and javascript links never enter the page', () => {
  const data = copy();
  data.site.name = '<script>alert("name")</script>';
  data.site.mark = '"><svg onload=alert(1)>';
  data.home.paragraphs[0] = '<img src=x onerror=alert(1)>';
  data.site.links = [{ label: 'Unsafe link', url: 'javascript:alert(1)' }];
  data.publications[0].links = [{ label: 'Paper', url: 'javascript:alert(2)' }];
  const pages = renderWebsite(data);
  for (const html of Object.values(pages)) {
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('href="javascript:'));
    assert.ok(html.includes('&lt;script&gt;alert(&quot;name&quot;)&lt;/script&gt;'));
  }
  assert.ok(pages['index.html'].includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!pages['index.html'].includes('<img src=x'));
});
