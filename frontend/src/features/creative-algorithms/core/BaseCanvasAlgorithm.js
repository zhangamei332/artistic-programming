export class BaseCanvasAlgorithm {
  constructor(canvas, params = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError("canvas must be an HTMLCanvasElement");
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.params = { ...this.constructor.defaults, ...params };
    this.running = false;
    this.rafId = 0;
    this.lastTime = 0;
    this.elapsed = 0;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.reset();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.width = rect.width;
      this.height = rect.height;
      this.onResize?.();
    }
  }

  setParams(next = {}) {
    Object.assign(this.params, next);
    this.onParamsChanged?.(next);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const tick = (now) => {
      if (!this.running) return;
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      this.elapsed += dt;
      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  destroy() {
    this.stop();
    this.resizeObserver.disconnect();
  }

  clear(color = "#080a10") {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  reset() {}
  update() {}
  render() {}
}
