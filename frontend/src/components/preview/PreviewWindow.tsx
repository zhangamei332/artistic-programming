import { useMemo } from 'react';
import { Empty } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import styles from './PreviewWindow.module.css';

interface PreviewWindowProps {
  code: string;
  refreshKey?: number;
}

export function PreviewWindow({ code, refreshKey }: PreviewWindowProps) {
  const html = useMemo(() => {
    if (!code) return '';
    return generatePreviewHTML(code);
  }, [code]);

  if (!code) {
    return (
      <div className={styles.empty}>
        <Empty
          image={<PlayCircleOutlined style={{ fontSize: 64, color: '#ccc' }} />}
          description="输入描述，AI 将为你生成艺术代码"
        />
      </div>
    );
  }

  return (
    <iframe
      key={refreshKey}
      className={styles.iframe}
      sandbox="allow-scripts"
      srcDoc={html}
      title="preview"
    />
  );
}

function isFullHTML(code: string): boolean {
  return /<!DOCTYPE\s+html/i.test(code) || /<html[\s>]/i.test(code);
}

function escapeForScriptTag(code: string): string {
  return code.replace(/<\/script/gi, '<\\/script');
}

/** Clean markdown artifacts that AI sometimes leaves in code */
function cleanMarkdownArtifacts(code: string): string {
  let c = code;
  // Strip markdown code block markers if present
  c = c.replace(/^```[\w#]*\s*\n?/gm, '');
  c = c.replace(/\n?```\s*$/gm, '');
  // Strip common AI preamble/suffix text lines
  c = c.replace(/^(Here('s| is)|以下是|这是|输出|代码)[^\n]*\n/gi, '');
  c = c.replace(/\n(希望|Enjoy|Let me know|如果有)[^\n]*$/gi, '');
  return c.trim();
}

function generatePreviewHTML(code: string): string {
  if (isFullHTML(code)) {
    return escapeForScriptTag(code);
  }

  const cleaned = cleanMarkdownArtifacts(code);
  const c = escapeForScriptTag(cleaned);

  return `<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; overflow: hidden; background: #1a1a2e; font-family: monospace; }
  canvas { display: block; }
  #error {
    display: none; color: #ff4d4f; padding: 20px; font-size: 13px;
    white-space: pre-wrap; position: absolute; top: 0; left: 0; right: 0;
    z-index: 100; background: rgba(0,0,0,0.9); max-height: 50%; overflow-y: auto;
  }
  #status {
    position: absolute; bottom: 8px; right: 12px; color: #52c41a;
    font-size: 11px; z-index: 50; opacity: 0.7;
  }
</style>
</head>
<body>
  <div id="error"></div>
  <div id="status"></div>
  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
    }
  }
  </script>
  <script src="https://unpkg.com/p5@1.9.0/lib/p5.min.js"></script>
  <script>
    var errorEl = document.getElementById('error');
    function showError(msg) {
      errorEl.textContent = 'Runtime error: ' + msg;
      errorEl.style.display = 'block';
    }
    window.addEventListener('error', function(e) {
      if (e.target !== window && e.target !== document) return;
      showError((e.message || '') + ' (line ' + (e.lineno || '?') + ')');
    }, true);
    window.addEventListener('unhandledrejection', function(e) {
      showError('Promise error: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
    });
    // Mark canvas as rendered
    var checkTimer = setInterval(function() {
      var canvas = document.querySelector('canvas');
      if (canvas) {
        document.getElementById('status').textContent = 'Canvas OK';
        clearInterval(checkTimer);
      }
    }, 500);
    setTimeout(function() {
      clearInterval(checkTimer);
      if (!document.querySelector('canvas') && !errorEl.style.display) {
        document.getElementById('status').textContent = 'No canvas detected — check code';
      }
    }, 3000);
  </script>
  <script type="module">
${c}
  </script>
</body>
</html>`;
}
