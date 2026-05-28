import { useRef, useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { Empty } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import styles from './PreviewWindow.module.css';

interface PreviewWindowProps {
  code: string;
  refreshKey?: number;
  referenceBackgroundUrl?: string;
  referenceActive?: boolean;
}

/** Bootstrap HTML — infrastructure only. User code is injected via postMessage. */
function bootstrapHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; overflow: hidden; background: #1a1a2e; font-family: monospace; }
  canvas { display: block; }
  #canvas-container {
    width: 100vw; height: 100vh;
    position: relative; overflow: hidden;
    background: #1a1a2e center / cover no-repeat;
  }
  #error {
    display: none; color: #ff4d4f; padding: 20px; font-size: 13px;
    white-space: pre-wrap; position: absolute; top: 0; left: 0; right: 0;
    z-index: 100; background: rgba(0,0,0,0.9); max-height: 50%; overflow-y: auto;
  }
  #status {
    position: absolute; bottom: 8px; right: 12px; color: #52c41a;
    font-size: 11px; z-index: 50; opacity: 0.7;
  }
  /* lil-gui panel stays inside container */
  .lil-gui { position: absolute !important; z-index: 10; }
</style>
</head>
<body>
  <div id="canvas-container">
    <div id="error"></div>
    <div id="status"></div>
  </div>
  <link rel="modulepreload" href="https://unpkg.com/three@0.160.0/build/three.module.js">
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
      var container = document.getElementById('canvas-container');
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

      // track intervals and timeouts for cleanup
      var _intervals = [];
      var _origSI = window.setInterval;
      var _origST = window.setTimeout;
      window.setInterval = function(fn, ms) {
        var id = _origSI.call(window, fn, ms);
        _intervals.push(id);
        return id;
      };
      window.setTimeout = function(fn, ms) {
        var id = _origST.call(window, fn, ms);
        _intervals.push(id);
        return id;
      };

      var _scripts = [];
      var _observers = [];   // ResizeObserver / MutationObserver
      var _listeners = [];   // [target, type, handler]

      // wrap addEventListener so we can remove them all on cleanup
      var _origAEL = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, handler, opts) {
        _listeners.push([this, type, handler]);
        return _origAEL.call(this, type, handler, opts);
      };

      // expose ResizeObserver tracking
      var _OrigResizeObserver = window.ResizeObserver;
      window.ResizeObserver = function(cb) {
        var ro = new _OrigResizeObserver(cb);
        _observers.push(ro);
        return ro;
      };

      // expose dispose registry — user code can register cleanup
      window.__disposeCallbacks = [];

      function cleanup() {
        // 1. call registered dispose functions first
        window.__disposeCallbacks.forEach(function(fn) { try { fn(); } catch(_) {} });
        window.__disposeCallbacks = [];

        // 2. cancel all tracked animation frames
        _rafIds.forEach(function(id) { cancelAnimationFrame(id); });
        _rafIds = [];

        // 3. clear all intervals & timeouts
        _intervals.forEach(function(id) { clearInterval(id); clearTimeout(id); });
        _intervals = [];

        // 4. disconnect all observers
        _observers.forEach(function(o) { try { o.disconnect(); } catch(_) {} });
        _observers = [];

        // 5. remove all tracked event listeners
        _listeners.forEach(function(t) {
          try { t[0].removeEventListener(t[1], t[2]); } catch(_) {}
        });
        _listeners = [];

        // 6. kill GSAP animations
        if (typeof gsap !== 'undefined') {
          try { gsap.globalTimeline.clear(); } catch(_) {}
        }

        // 7. remove old module script tags
        _scripts.forEach(function(s) { s.remove(); });
        _scripts = [];

        // 8. dispose WebGL resources & remove canvases
        var canvases = container.querySelectorAll('canvas');
        canvases.forEach(function(c) {
          // try to lose WebGL context
          var gl = c.getContext('webgl') || c.getContext('webgl2');
          if (gl && gl.getExtension('WEBGL_lose_context')) {
            gl.getExtension('WEBGL_lose_context').loseContext();
          }
          c.remove();
        });

        // 9. remove remaining DOM children inside container (except error/status)
        var children = Array.from(container.children);
        children.forEach(function(child) {
          if (child.id !== 'error' && child.id !== 'status') {
            child.remove();
          }
        });

        // 10. clear error display
        errorEl.style.display = 'none';
        statusEl.textContent = '';
      }

      window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'cleanup') { cleanup(); return; }
        if (e.data.type === 'reference-background') {
          var enabled = !!e.data.enabled;
          var url = e.data.url || '';
          container.style.backgroundImage = enabled && url ? 'url("' + url + '")' : '';
          document.body.style.backgroundImage = enabled && url ? 'url("' + url + '")' : '';
          document.body.style.backgroundSize = 'cover';
          document.body.style.backgroundPosition = 'center';
          return;
        }
        if (e.data.type !== 'code') return;

        cleanup();

        // use inline module script (no blob URL, more reliable)
        var script = document.createElement('script');
        script.type = 'module';
        script.textContent = e.data.code;
        _scripts.push(script);
        document.body.appendChild(script);

        statusEl.textContent = 'Canvas OK';
      });

      // load GSAP asynchronously — non-blocking
      var gsapScript = document.createElement('script');
      gsapScript.src = 'https://unpkg.com/gsap@3.12.5/dist/gsap.min.js';
      gsapScript.onerror = function() {
        statusEl.textContent = 'GSAP CDN unavailable (non-fatal)';
      };
      document.head.appendChild(gsapScript);

      // load lil-gui asynchronously — non-blocking
      var guiScript = document.createElement('script');
      guiScript.src = 'https://unpkg.com/lil-gui@0.19.2/dist/lil-gui.umd.min.js';
      guiScript.onerror = function() {
        statusEl.textContent = 'lil-gui CDN unavailable (non-fatal)';
      };
      document.head.appendChild(guiScript);

      // load p5.js asynchronously — non-blocking
      var p5Script = document.createElement('script');
      p5Script.src = 'https://unpkg.com/p5@1.11.1/lib/p5.min.js';
      p5Script.onerror = function() {
        statusEl.textContent = 'p5.js CDN unavailable (non-fatal)';
      };
      document.head.appendChild(p5Script);

      statusEl.textContent = 'Ready';
    })();
  <\/script>
</body>
</html>`;
}

/** Generate a standalone HTML file for VSCode Live Server / direct browser preview */
export function exportStandaloneHTML(jsCode: string): string {
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
  #canvas-container {
    width: 100vw; height: 100vh;
    position: relative; overflow: hidden;
  }
  #error {
    display: none; color: #ff4d4f; padding: 20px; font-size: 13px;
    white-space: pre-wrap; position: absolute; top: 0; left: 0; right: 0;
    z-index: 100; background: rgba(0,0,0,0.9); max-height: 50%; overflow-y: auto;
  }
  .lil-gui { position: absolute !important; z-index: 10; }
</style>
</head>
<body>
  <div id="canvas-container">
    <div id="error"></div>
  </div>
  <link rel="modulepreload" href="https://unpkg.com/three@0.160.0/build/three.module.js">
  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
    }
  }
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

export function PreviewWindow({
  code,
  refreshKey,
  referenceBackgroundUrl,
  referenceActive = false,
}: PreviewWindowProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const sentRef = useRef('');
  const sentKeyRef = useRef(0);
  const bootstrap = useRef(bootstrapHTML());

  const sendReferenceBackground = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'reference-background',
        enabled: referenceActive,
        url: referenceBackgroundUrl || '',
      },
      '*',
    );
  }, [referenceActive, referenceBackgroundUrl]);

  const send = useCallback((c: string) => {
    if (!iframeRef.current) return;
    sentRef.current = c;
    iframeRef.current.contentWindow?.postMessage({ type: 'code', code: c }, '*');
  }, []);

  // iframe loaded → mark ready, inject initial code
  const onLoad = useCallback(() => {
    setReady(true);
    sendReferenceBackground();
    if (code && iframeRef.current) {
      sentRef.current = code;
      iframeRef.current.contentWindow?.postMessage({ type: 'code', code }, '*');
    }
  }, [code, sendReferenceBackground]);

  useEffect(() => {
    if (!ready) return;
    sendReferenceBackground();
  }, [ready, sendReferenceBackground]);

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
    <div
      className={`${styles.wrapper} ${referenceActive ? styles.referenceActive : ''}`}
      style={{
        '--preview-reference-bg': referenceBackgroundUrl
          ? `url("${referenceBackgroundUrl}")`
          : undefined,
      } as CSSProperties}
    >
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
