const VERIFICATION_SCRIPT = `
<script>
(function() {
  var hasError = false;
  var VERIFY_TIMEOUT = 1500;

  function sendError(msg) {
    if (hasError) return;
    hasError = true;
    parent.postMessage({ type: 'preview:error', message: String(msg) }, '*');
  }

  window.addEventListener('error', function(e) {
    if (hasError) return;
    var msg = e.message || 'Unknown error';
    if (e.lineno) msg += ' (line ' + e.lineno + ')';
    sendError(msg);
  }, true);

  window.addEventListener('unhandledrejection', function(e) {
    sendError(e.reason && e.reason.message ? e.reason.message : String(e.reason));
  });

  // dispose registry for cleanup (same as preview iframe)
  window.__disposeCallbacks = [];

  parent.postMessage({ type: 'preview:loaded' }, '*');

  setTimeout(function() {
    if (!hasError) {
      parent.postMessage({ type: 'preview:success' }, '*');
    }
  }, VERIFY_TIMEOUT);
})();
</script>`;

function isFullHTML(code: string): boolean {
  return /<!DOCTYPE\s+html/i.test(code) || /<html[\s>]/i.test(code);
}

function escapeForScriptTag(code: string): string {
  return code.replace(/<\/script/gi, '<\\/script');
}

function cleanMarkdownArtifacts(code: string): string {
  let c = code;
  c = c.replace(/^```[\w#]*\s*\n?/gm, '');
  c = c.replace(/\n?```\s*$/gm, '');
  c = c.replace(/^(Here('s| is)|以下是|这是|输出|代码)[^\n]*\n/gi, '');
  c = c.replace(/\n(希望|Enjoy|Let me know|如果有)[^\n]*$/gi, '');
  return c.trim();
}

export function generateVerificationHTML(code: string): string {
  const cleaned = cleanMarkdownArtifacts(code);

  if (isFullHTML(cleaned)) {
    const escaped = escapeForScriptTag(cleaned);
    return escaped.replace('</head>', VERIFICATION_SCRIPT + '\n</head>');
  }

  const escapedCode = escapeForScriptTag(cleaned);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; overflow: hidden; background: #1a1a2e; }
  canvas { display: block; }
  #canvas-container {
    width: 100vw; height: 100vh;
    position: relative; overflow: hidden;
  }
  .lil-gui { position: absolute !important; z-index: 10; }
</style>
<link rel="modulepreload" href="https://unpkg.com/three@0.160.0/build/three.module.js">
${VERIFICATION_SCRIPT}
</head>
<body>
  <div id="canvas-container"></div>
  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
    }
  }
  </script>
  <script src="https://unpkg.com/gsap@3.12.5/dist/gsap.min.js"></script>
  <script src="https://unpkg.com/lil-gui@0.19.2/dist/lil-gui.umd.min.js"></script>
  <script src="https://unpkg.com/p5@1.11.1/lib/p5.min.js"></script>
  <script type="module">
${escapedCode}
  </script>
</body>
</html>`;
}
