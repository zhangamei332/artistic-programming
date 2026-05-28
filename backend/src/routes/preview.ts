import { Router, Request, Response } from 'express';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

export const previewRouter = Router();

const saveSchema = z.object({
  code: z.string().min(1).max(100000),
});

function buildHTML(jsCode: string): string {
  const escaped = jsCode.replace(/<\/script/gi, '<\\/script');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; overflow: hidden; background: #1a1a2e; font-family: monospace; }
  canvas { display: block; }
  #canvas-container { width: 100vw; height: 100vh; position: relative; overflow: hidden; }
  #error { display: none; color: #ff4d4f; padding: 20px; font-size: 13px; white-space: pre-wrap; position: absolute; top: 0; left: 0; right: 0; z-index: 100; background: rgba(0,0,0,0.9); max-height: 50%; overflow-y: auto; }
  .lil-gui { position: absolute !important; z-index: 10; }
</style>
</head>
<body>
  <div id="canvas-container"><div id="error"></div></div>
  <script type="importmap">
  { "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js", "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/" } }
  <\\/script>
  <script src="https://unpkg.com/gsap@3.12.5/dist/gsap.min.js"><\\/script>
  <script src="https://unpkg.com/lil-gui@0.19.2/dist/lil-gui.umd.min.js"><\\/script>
  <script src="https://unpkg.com/p5@1.11.1/lib/p5.min.js"><\\/script>
  <script>
    window.addEventListener('error', function(e) {
      var el = document.getElementById('error');
      if (el) { el.textContent = e.message + ' (line ' + e.lineno + ')'; el.style.display = 'block'; }
    }, true);
    window.__disposeCallbacks = [];
  <\\/script>
  <script type="module">
${escaped}
  <\\/script>
</body>
</html>`;
}

previewRouter.post('/save', (req: Request, res: Response) => {
  try {
    const body = saveSchema.parse(req.body);
    const html = buildHTML(body.code);

    const dir = join(process.cwd(), '..', '.live-preview');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const filePath = join(dir, 'index.html');
    writeFileSync(filePath, html, 'utf-8');

    res.json({ success: true, path: '.live-preview/index.html' });
  } catch (err) {
    res.status(400).json({ success: false, error: String(err) });
  }
});
