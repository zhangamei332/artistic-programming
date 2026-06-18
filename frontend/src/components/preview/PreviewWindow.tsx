import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import styles from './PreviewWindow.module.css';

function previewCodeSyncId(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) {
    hash = ((hash << 5) - hash + code.charCodeAt(i)) | 0;
  }
  return `${code.length}:${hash}`;
}

interface PreviewWindowProps {
  code: string;
  refreshKey?: number;
  referenceBackgroundUrl?: string;
  referenceActive?: boolean;
  captureRequestId?: number;
  onCapture?: (payload: { imageDataUrl: string | null; runtimeMs: number; error?: string }) => void;
}

/** Bootstrap HTML — infrastructure only. User code is injected via postMessage. */
function bootstrapHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; overflow: hidden; background: #000; font-family: monospace; }
  canvas { display: block; }
  #canvas-container {
    width: 100vw; height: 100vh;
    position: relative; overflow: hidden;
    background: #000 center / cover no-repeat;
  }
  #error {
    display: none; color: #ff4d4f; padding: 14px 46px 14px 20px; font-size: 13px;
    white-space: pre-wrap; position: absolute; top: 0; left: 0; right: 0;
    z-index: 100; background: rgba(0,0,0,0.9); max-height: 50%; overflow-y: auto;
  }
  #copy-error {
    display: none; position: absolute; top: 10px; right: 12px; z-index: 101;
    width: 28px; height: 28px; border: 1px solid rgba(255,255,255,0.24);
    border-radius: 6px; background: rgba(255,255,255,0.1); color: #fff;
    cursor: pointer; font-size: 15px; line-height: 26px;
  }
  #status {
    position: absolute; bottom: 8px; right: 12px; color: #52c41a;
    font-size: 11px; z-index: 50; opacity: 0.7;
  }
</style>
</head>
<body>
  <div id="canvas-container">
    <div id="error"></div>
    <button id="copy-error" type="button" title="复制错误">⧉</button>
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
      var copyErrorBtn = document.getElementById('copy-error');
      var statusEl = document.getElementById('status');

      function showError(msg, type) {
        var fullMsg = (type || 'Error') + ': ' + msg;
        errorEl.textContent = fullMsg;
        errorEl.style.display = 'block';
        copyErrorBtn.style.display = 'block';
        if (statusEl) statusEl.textContent = 'Error';
        window.parent.postMessage({ type: 'preview-error', message: fullMsg }, '*');
      }

      copyErrorBtn.addEventListener('click', function() {
        var text = errorEl.textContent || '';
        window.parent.postMessage({ type: 'preview-copy-error', text: text }, '*');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(function() {});
        }
      });

      var _origSetPointerCapture = Element.prototype.setPointerCapture;
      Element.prototype.setPointerCapture = function(pointerId) {
        try {
          return _origSetPointerCapture.call(this, pointerId);
        } catch (err) {
          if (err && err.name === 'NotFoundError') return undefined;
          throw err;
        }
      };
      var _origReleasePointerCapture = Element.prototype.releasePointerCapture;
      Element.prototype.releasePointerCapture = function(pointerId) {
        try {
          return _origReleasePointerCapture.call(this, pointerId);
        } catch (err) {
          if (err && err.name === 'NotFoundError') return undefined;
          throw err;
        }
      };

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
      var _previewInstanceId = '';
      var _previewSyncId = '';
      var _mediaRequestSeq = 0;
      var _mediaRequests = {};
      var _visionSubscribers = { face: [], gesture: [] };

      window.__previewVision = {
        latest: { face: null, gesture: null },
        subscribe: function(mode, callback) {
          if (!_visionSubscribers[mode] || typeof callback !== 'function') return function() {};
          _visionSubscribers[mode].push(callback);
          if (window.__previewVision.latest[mode]) callback(window.__previewVision.latest[mode]);
          return function() {
            _visionSubscribers[mode] = _visionSubscribers[mode].filter(function(item) { return item !== callback; });
          };
        }
      };

      var _previewMediaDevices = navigator.mediaDevices || {};
      try {
        if (!navigator.mediaDevices) {
          Object.defineProperty(navigator, 'mediaDevices', { value: _previewMediaDevices, configurable: true });
        }
      } catch (_) {}
      _previewMediaDevices.getUserMedia = function(constraints) {
        return new Promise(function(resolve, reject) {
          var requestId = 'media_' + Date.now() + '_' + (++_mediaRequestSeq);
          _mediaRequests[requestId] = { resolve: resolve, reject: reject };
          window.parent.postMessage({
            type: 'preview-get-user-media',
            requestId: requestId,
            constraints: constraints || { video: true, audio: false }
          }, '*');
          setTimeout(function() {
            if (!_mediaRequests[requestId]) return;
            delete _mediaRequests[requestId];
            reject(new Error('摄像头授权超时'));
          }, 15000);
        });
      };

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
        if (typeof ro.takeRecords !== 'function') {
          ro.takeRecords = function() { return []; };
        }
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
          if (t[2] === _previewMessageHandler) return;
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
          if (child.id !== 'error' && child.id !== 'status' && child.id !== 'copy-error') {
            child.remove();
          }
        });

        // 10. clear error display
        errorEl.style.display = 'none';
        copyErrorBtn.style.display = 'none';
        statusEl.textContent = '';
      }

      // 通知父窗口：iframe 已就绪，可以接收代码
      window.parent.postMessage({ type: 'iframe-ready' }, '*');

      var _previewMessageHandler = function(e) {
        if (!e.data) return;
        if (e.data.type === 'preview-meta') {
          _previewInstanceId = e.data.instanceId || '';
          _previewSyncId = e.data.syncId || '';
          return;
        }
        if (e.data.type === 'preview-input') {
          dispatchSyncedInput(e.data.payload || {});
          return;
        }
        if (e.data.type === 'preview-vision-data') {
          var visionMode = e.data.mode;
          var visionPayload = e.data.payload || {};
          if (!_visionSubscribers[visionMode]) return;
          window.__previewVision.latest[visionMode] = visionPayload;
          _visionSubscribers[visionMode].forEach(function(callback) {
            try { callback(visionPayload); } catch(_) {}
          });
          window.dispatchEvent(new CustomEvent('preview-vision-' + visionMode, { detail: visionPayload }));
          return;
        }
        if (e.data.type === 'preview-user-media-result') {
          var pending = _mediaRequests[e.data.requestId];
          if (!pending) return;
          delete _mediaRequests[e.data.requestId];
          if (e.data.stream) pending.resolve(e.data.stream);
          else pending.reject(new Error(e.data.error || '摄像头授权失败'));
          return;
        }
        if (e.data.type === 'cleanup') { cleanup(); return; }
        if (e.data.type === 'capture-preview') {
          var captureRequestId = e.data.requestId;
          requestAnimationFrame(function() {
            requestAnimationFrame(function() {
              var runtimeMs = Math.max(0, performance.now() - (window.__previewStartedAt || performance.now()));
              var imageDataUrl = null;
              var error = '';
              try {
                var canvas = container.querySelector('canvas');
                if (canvas) {
                  var snapshotCanvas = document.createElement('canvas');
                  snapshotCanvas.width = canvas.width;
                  snapshotCanvas.height = canvas.height;
                  var snapshotContext = snapshotCanvas.getContext('2d');
                  if (snapshotContext) snapshotContext.drawImage(canvas, 0, 0);
                  imageDataUrl = snapshotCanvas.toDataURL('image/png');
                }
              } catch (err) {
                error = err && err.message ? err.message : String(err);
              }
              window.parent.postMessage({
                type: 'preview-capture',
                requestId: captureRequestId,
                imageDataUrl: imageDataUrl,
                runtimeMs: runtimeMs,
                error: error
              }, '*');
            });
          });
          return;
        }
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
        window.__previewStartedAt = performance.now();

        var codeText = e.data.code || '';

        // 替换 bare import 为 importmap 对应的完整 URL（防止 importmap 在沙箱中失效）
        // importmap 已在 bootstrap 中定义，但某些浏览器沙箱模式下可能不生效
        // 这里做 fallback：如果 importmap 生效则 bare import 正常解析，否则浏览器会报错
        // 我们不做预替换，因为不同 AI 生成的 import 路径不同

        // use inline module script (no blob URL, more reliable)
        var script = document.createElement('script');
        script.type = 'module';
        script.textContent = codeText;
        _scripts.push(script);

        // 监听 module script 的加载/错误事件
        script.addEventListener('load', function() {
          statusEl.textContent = 'Module loaded';
          window.parent.postMessage({ type: 'preview-loaded' }, '*');
        });
        script.addEventListener('error', function(ev) {
          var msg = ev.message || 'Module script error';
          showError(msg, 'Module');
          window.parent.postMessage({ type: 'preview-error', message: msg }, '*');
        });

        document.body.appendChild(script);

        // 超时检测：如果 3 秒后没有 canvas 出现，只保留内部状态，不显示给用户
        setTimeout(function() {
          var canvas = container.querySelector('canvas');
          if (!canvas && !errorEl.textContent) return;
        }, 3000);
      };
      window.addEventListener('message', _previewMessageHandler);

      function emitInput(payload) {
        if (payload && payload.replayed) return;
        window.parent.postMessage({
          type: 'preview-input',
          sourceId: _previewInstanceId,
          syncId: _previewSyncId,
          payload: payload
        }, '*');
      }

      function dispatchSyncedInput(payload) {
        if (!payload) return;
        var targetX = typeof payload.x === 'number' ? payload.x * container.clientWidth : 0;
        var targetY = typeof payload.y === 'number' ? payload.y * container.clientHeight : 0;
        var base = {
          bubbles: true,
          cancelable: true,
          clientX: targetX,
          clientY: targetY,
          button: payload.button || 0,
          buttons: payload.buttons || 0,
          ctrlKey: !!payload.ctrlKey,
          altKey: !!payload.altKey,
          shiftKey: !!payload.shiftKey,
          metaKey: !!payload.metaKey
        };
        var event;
        if (payload.kind === 'key') {
          event = new KeyboardEvent(payload.type, {
            bubbles: true,
            cancelable: true,
            key: payload.key || '',
            code: payload.code || '',
            ctrlKey: !!payload.ctrlKey,
            altKey: !!payload.altKey,
            shiftKey: !!payload.shiftKey,
            metaKey: !!payload.metaKey
          });
        } else if (payload.kind === 'wheel') {
          event = new WheelEvent('wheel', { ...base, deltaX: payload.deltaX || 0, deltaY: payload.deltaY || 0 });
        } else {
          var Ctor = window.PointerEvent && payload.type.indexOf('pointer') === 0 ? PointerEvent : MouseEvent;
          event = new Ctor(payload.type, base);
        }
        event.__previewSynced = true;
        [window, document, container].forEach(function(target) {
          try { target.dispatchEvent(event); } catch(_) {}
        });
        var canvas = container.querySelector('canvas');
        if (canvas) {
          try { canvas.dispatchEvent(event); } catch(_) {}
        }
      }

      function inputFromPointer(e) {
        if (e.__previewSynced) return null;
        var rect = container.getBoundingClientRect();
        return {
          kind: 'pointer',
          type: e.type,
          x: rect.width ? (e.clientX - rect.left) / rect.width : 0,
          y: rect.height ? (e.clientY - rect.top) / rect.height : 0,
          button: e.button || 0,
          buttons: e.buttons || 0,
          ctrlKey: e.ctrlKey,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
          metaKey: e.metaKey
        };
      }
      ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mousemove', 'mouseup', 'click', 'dblclick'].forEach(function(type) {
        container.addEventListener(type, function(e) {
          var payload = inputFromPointer(e);
          if (payload) emitInput(payload);
        }, true);
      });
      container.addEventListener('wheel', function(e) {
        if (e.__previewSynced) return;
        var payload = inputFromPointer(e);
        if (payload) emitInput({ ...payload, kind: 'wheel', deltaX: e.deltaX, deltaY: e.deltaY });
      }, true);
      ['keydown', 'keyup'].forEach(function(type) {
        window.addEventListener(type, function(e) {
          if (e.__previewSynced) return;
          emitInput({
            kind: 'key',
            type: type,
            key: e.key,
            code: e.code,
            ctrlKey: e.ctrlKey,
            altKey: e.altKey,
            shiftKey: e.shiftKey,
            metaKey: e.metaKey
          });
        }, true);
      });

      // load GSAP asynchronously — non-blocking
      var gsapScript = document.createElement('script');
      gsapScript.src = 'https://unpkg.com/gsap@3.12.5/dist/gsap.min.js';
      gsapScript.onerror = function() {
        statusEl.textContent = 'GSAP CDN unavailable (non-fatal)';
      };
      document.head.appendChild(gsapScript);

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
  body { margin: 0; overflow: hidden; background: #000; font-family: monospace; }
  canvas { display: block; }
  #canvas-container {
    width: 100vw; height: 100vh;
    position: relative; overflow: hidden;
    background: #000;
  }
  #error {
    display: none; color: #ff4d4f; padding: 20px; font-size: 13px;
    white-space: pre-wrap; position: absolute; top: 0; left: 0; right: 0;
    z-index: 100; background: rgba(0,0,0,0.9); max-height: 50%; overflow-y: auto;
  }
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
  captureRequestId,
  onCapture,
}: PreviewWindowProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const sentRef = useRef('');
  const sentKeyRef = useRef(0);
  const mediaStreamsRef = useRef<MediaStream[]>([]);
  const bootstrap = useRef(bootstrapHTML());
  const instanceIdRef = useRef(`preview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const syncId = useMemo(() => previewCodeSyncId(code), [code]);

  const sendMeta = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({
      type: 'preview-meta',
      instanceId: instanceIdRef.current,
      syncId,
    }, '*');
  }, [syncId]);

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
    mediaStreamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    mediaStreamsRef.current = [];
    sentRef.current = c;
    iframeRef.current.contentWindow?.postMessage({ type: 'code', code: c }, '*');
  }, []);

  const sendSyncedInput = useCallback((payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage({
      type: 'preview-input',
      payload: {
        ...payload,
        replayed: true,
      },
    }, '*');
  }, []);

  useEffect(() => {
    if (!referenceActive || !code) return undefined;
    const shouldIgnore = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      return !!element?.closest('input, textarea, select, [contenteditable="true"], [data-preview-code-mode="true"]');
    };
    const normalizedPoint = (event: MouseEvent | WheelEvent) => {
      const rect = iframeRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0.5, y: 0.5 };
      return {
        x: rect.width ? (event.clientX - rect.left) / rect.width : 0.5,
        y: rect.height ? (event.clientY - rect.top) / rect.height : 0.5,
      };
    };
    const handleKey = (event: KeyboardEvent) => {
      if (shouldIgnore(event.target)) return;
      sendSyncedInput({
        kind: 'key',
        type: event.type,
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
      });
    };
    const handleWheel = (event: WheelEvent) => {
      if (shouldIgnore(event.target)) return;
      const point = normalizedPoint(event);
      sendSyncedInput({
        kind: 'wheel',
        type: 'wheel',
        x: point.x,
        y: point.y,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        button: event.button || 0,
        buttons: event.buttons || 0,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
      });
    };
    window.addEventListener('keydown', handleKey, true);
    window.addEventListener('keyup', handleKey, true);
    window.addEventListener('wheel', handleWheel, true);
    return () => {
      window.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('keyup', handleKey, true);
      window.removeEventListener('wheel', handleWheel, true);
    };
  }, [code, referenceActive, sendSyncedInput]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'preview-get-user-media') return;
      const requestId = String(event.data.requestId || '');
      if (!requestId) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'preview-user-media-result',
          requestId,
          error: '浏览器不支持摄像头 API',
        }, '*');
        return;
      }
      void navigator.mediaDevices.getUserMedia(event.data.constraints || { video: true, audio: false })
        .then((stream) => {
          mediaStreamsRef.current.push(stream);
          iframeRef.current?.contentWindow?.postMessage({
            type: 'preview-user-media-result',
            requestId,
            stream,
          }, '*');
        })
        .catch((error: unknown) => {
          iframeRef.current?.contentWindow?.postMessage({
            type: 'preview-user-media-result',
            requestId,
            error: error instanceof Error ? error.message : '摄像头授权失败',
          }, '*');
        });
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => () => {
    mediaStreamsRef.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    mediaStreamsRef.current = [];
  }, []);

  useEffect(() => {
    if (!captureRequestId || !onCapture) return;
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'preview-capture') return;
      if (event.data.requestId !== captureRequestId) return;
      onCapture({
        imageDataUrl: event.data.imageDataUrl || null,
        runtimeMs: Number(event.data.runtimeMs || 0),
        error: event.data.error || undefined,
      });
    };
    window.addEventListener('message', handleMessage);
    iframeRef.current?.contentWindow?.postMessage({ type: 'capture-preview', requestId: captureRequestId }, '*');
    return () => window.removeEventListener('message', handleMessage);
  }, [captureRequestId, onCapture]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'preview-copy-error') return;
      const text = String(event.data.text || '');
      if (!text) return;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => undefined);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // iframe loaded → mark ready, inject initial code
  useEffect(() => {
    if (!referenceActive || !code) return undefined;
    const mode = /@node:faceRecognition=|__previewVision\.subscribe\(['"]face/i.test(code)
      ? 'face'
      : /@node:gesture=|__previewVision\.subscribe\(['"]gesture/i.test(code)
        ? 'gesture'
        : null;
    if (!mode) return undefined;
    window.dispatchEvent(new CustomEvent('interaction-vision-permission-request', { detail: { mode } }));
    return undefined;
  }, [code, referenceActive]);

  useEffect(() => {
    const handleVisionData = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: string; payload?: Record<string, unknown> }>).detail;
      if (!detail?.mode || !detail.payload) return;
      iframeRef.current?.contentWindow?.postMessage({
        type: 'preview-vision-data',
        mode: detail.mode,
        payload: detail.payload,
      }, '*');
    };
    window.addEventListener('preview-vision-data', handleVisionData);
    return () => window.removeEventListener('preview-vision-data', handleVisionData);
  }, []);

  const onLoad = useCallback(() => {
    setReady(true);
    sendMeta();
    sendReferenceBackground();
    if (code && iframeRef.current) {
      sentRef.current = code;
      // 延迟 50ms 发送，确保 iframe 内的 message listener 已就绪
      setTimeout(() => {
        if (iframeRef.current && sentRef.current === code) {
          iframeRef.current.contentWindow?.postMessage({ type: 'code', code }, '*');
        }
      }, 50);
    }
  }, [code, sendMeta, sendReferenceBackground]);

  useEffect(() => {
    if (!ready) return;
    sendMeta();
  }, [ready, sendMeta]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'preview-input') return;
      if (event.data.sourceId === instanceIdRef.current) return;
      if (event.data.syncId !== syncId) return;
      iframeRef.current?.contentWindow?.postMessage({
        type: 'preview-input',
        payload: {
          ...(event.data.payload || {}),
          replayed: true,
        },
      }, '*');
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [syncId]);

  // 监听 iframe 的 ready 信号：iframe 加载完成后会发送 iframe-ready
  // 收到后立即发送代码（比 onLoad 的 50ms 延迟更可靠）
  useEffect(() => {
    if (!code) return;
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'iframe-ready') return;
      if (!iframeRef.current) return;
      sentRef.current = code;
      iframeRef.current.contentWindow?.postMessage({ type: 'code', code }, '*');
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [code]);

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
    // 多次延迟重发：防止 iframe 从 display:none 切换到 display:block 时丢失 postMessage
    // 某些浏览器在 iframe 可见性变化时会重新加载 iframe，导致消息丢失
    const retry1 = setTimeout(() => {
      if (iframeRef.current && sentRef.current === code) {
        iframeRef.current.contentWindow?.postMessage({ type: 'code', code }, '*');
      }
    }, 150);
    const retry2 = setTimeout(() => {
      if (iframeRef.current && sentRef.current === code) {
        iframeRef.current.contentWindow?.postMessage({ type: 'code', code }, '*');
      }
    }, 500);
    return () => { clearTimeout(retry1); clearTimeout(retry2); };
  }, [code, ready, send, refreshKey]);

  // refreshKey bumped alone (same code, force re-inject)
  useEffect(() => {
    if (!ready || !code) return;
    if (refreshKey === sentKeyRef.current) return;
    sentKeyRef.current = refreshKey || 0;
    send(code);
    const retry1 = setTimeout(() => {
      if (iframeRef.current && sentRef.current === code) {
        iframeRef.current.contentWindow?.postMessage({ type: 'code', code }, '*');
      }
    }, 150);
    const retry2 = setTimeout(() => {
      if (iframeRef.current && sentRef.current === code) {
        iframeRef.current.contentWindow?.postMessage({ type: 'code', code }, '*');
      }
    }, 500);
    return () => { clearTimeout(retry1); clearTimeout(retry2); };
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
      {!code && <div className={styles.empty} />}
      <iframe
        ref={iframeRef}
        className={styles.iframe}
        style={{ display: code ? 'block' : 'none' }}
        sandbox="allow-scripts"
        allow="camera; microphone; clipboard-write"
        srcDoc={bootstrap.current}
        title="preview"
        onLoad={onLoad}
      />
    </div>
  );
}
