import { useRef, useState, useEffect, useCallback } from 'react';
import { Empty } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import styles from './PreviewWindow.module.css';

interface PreviewWindowProps {
  code: string;
  refreshKey?: number;
}

/** Bootstrap HTML — infrastructure only. User code is injected via postMessage. */
function bootstrapHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
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
  <\/script>
  <script>
    (function() {
      var errorEl = document.getElementById('error');
      var statusEl = document.getElementById('status');

      function showError(msg, type) {
        errorEl.textContent = (type || 'Error') + ': ' + msg;
        errorEl.style.display = 'block';
        if (statusEl) statusEl.textContent = 'Error';
      }

      window.addEventListener('error', function(e) {
        var msg = (e.message || '') + ' (line ' + (e.lineno || '?') + ')';
        var type = (e.target === window || e.target === document) ? 'Runtime error' : 'Script error';
        showError(msg, type);
      }, true);

      window.addEventListener('unhandledrejection', function(e) {
        showError('Promise error: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)), 'Promise');
      });

      // ---- animation cleanup tracking ----
      var _rafIds = [];
      var _origRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = function(cb) {
        var id = _origRAF.call(window, cb);
        _rafIds.push(id);
        return id;
      };

      var _scripts = [];

      function cleanup() {
        // cancel all tracked animation frames
        _rafIds.forEach(function(id) { cancelAnimationFrame(id); });
        _rafIds = [];

        // kill GSAP animations
        if (typeof gsap !== 'undefined') {
          try { gsap.globalTimeline.clear(); } catch(_) {}
        }

        // remove old module script tags
        _scripts.forEach(function(s) { s.remove(); });
        _scripts = [];

        // remove all canvases (will be recreated by new code)
        var canvases = document.querySelectorAll('canvas');
        canvases.forEach(function(c) { c.remove(); });

        // clear error display
        errorEl.style.display = 'none';
        statusEl.textContent = '';
      }

      window.addEventListener('message', function(e) {
        if (!e.data || e.data.type !== 'code') return;
        cleanup();

        // use inline module script (no blob URL, more reliable)
        var script = document.createElement('script');
        script.type = 'module';
        script.textContent = e.data.code;
        _scripts.push(script);
        document.body.appendChild(script);

        statusEl.textContent = 'Canvas OK';
      });

      // load GSAP asynchronously — non-blocking, won't delay iframe ready
      var gsapScript = document.createElement('script');
      gsapScript.src = 'https://unpkg.com/gsap@3.12.5/dist/gsap.min.js';
      gsapScript.onerror = function() {
        statusEl.textContent = 'GSAP CDN unavailable (non-fatal)';
      };
      document.head.appendChild(gsapScript);

      statusEl.textContent = 'Ready';
    })();
  <\/script>
</body>
</html>`;
}

export function PreviewWindow({ code, refreshKey }: PreviewWindowProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const sentRef = useRef('');
  const sentKeyRef = useRef(0);
  const bootstrap = useRef(bootstrapHTML());

  const send = useCallback((c: string) => {
    if (!iframeRef.current) return;
    sentRef.current = c;
    iframeRef.current.contentWindow?.postMessage({ type: 'code', code: c }, '*');
  }, []);

  // iframe loaded → mark ready, inject initial code
  const onLoad = useCallback(() => {
    setReady(true);
    if (code && iframeRef.current) {
      sentRef.current = code;
      iframeRef.current.contentWindow?.postMessage({ type: 'code', code }, '*');
    }
  }, [code]);

  // code changed → hot-swap via postMessage (iframe stays alive)
  useEffect(() => {
    if (!ready || !code) return;
    if (code === sentRef.current) return;
    sentRef.current = code;
    sentKeyRef.current = refreshKey || 0;
    send(code);
  }, [code, ready, send, refreshKey]);

  // refreshKey bumped alone (same code, force re-inject)
  useEffect(() => {
    if (!ready || !code) return;
    if (refreshKey === sentKeyRef.current) return;
    sentKeyRef.current = refreshKey || 0;
    send(code);
  }, [refreshKey, ready, code, send]);

  // code cleared → cleanup only
  useEffect(() => {
    if (!ready || code) return;
    sentRef.current = '';
    iframeRef.current?.contentWindow?.postMessage({ type: 'cleanup' }, '*');
  }, [code, ready]);

  return (
    <div className={styles.wrapper}>
      {!code && (
        <div className={styles.empty}>
          <Empty
            image={<PlayCircleOutlined style={{ fontSize: 64, color: '#ccc' }} />}
            description="输入描述，AI 将为你生成艺术代码"
          />
        </div>
      )}
      <iframe
        ref={iframeRef}
        className={styles.iframe}
        style={{ display: code ? 'block' : 'none' }}
        sandbox="allow-scripts"
        srcDoc={bootstrap.current}
        title="preview"
        onLoad={onLoad}
      />
    </div>
  );
}
