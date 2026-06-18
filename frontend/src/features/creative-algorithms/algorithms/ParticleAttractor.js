import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
export const meta = {
  id: "particle-attractor", name: "粒子吸引器", nameEN: "Particle Attractor",
  category: "field", preview: "/creative-algorithms/previews/particle-attractor.gif",
  tags: ["粒子", "吸引力", "交互"]
};
export default class ParticleAttractor extends BaseCanvasAlgorithm {
  static defaults = { count: 500, force: 950, damping: 0.99, maxSpeed: 180, pointer: true };
  reset() {
    if (this._move) this.canvas.removeEventListener("pointermove", this._move);
    this.pointer = { x: this.width / 2, y: this.height / 2, active: false };
    this.particles = Array.from({ length: this.params.count }, () => ({
      x: Math.random() * this.width, y: Math.random() * this.height,
      vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30
    }));
    this._move = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer.x = e.clientX - r.left; this.pointer.y = e.clientY - r.top; this.pointer.active = true;
    };
    this.canvas.addEventListener("pointermove", this._move);
  }
  onParamsChanged(next) { if ("count" in next) this.reset(); }
  update(dt) {
    const target = this.pointer.active && this.params.pointer
      ? this.pointer
      : { x: this.width / 2 + Math.cos(this.elapsed) * this.width * .22, y: this.height / 2 + Math.sin(this.elapsed * 1.3) * this.height * .2 };
    this.target = target;
    for (const p of this.particles) {
      const dx = target.x - p.x, dy = target.y - p.y;
      const d2 = dx * dx + dy * dy + 80;
      const inv = 1 / Math.sqrt(d2);
      const a = Math.min(this.params.force / d2, 260);
      p.vx = (p.vx + dx * inv * a * dt) * this.params.damping;
      p.vy = (p.vy + dy * inv * a * dt) * this.params.damping;
      const s = Math.hypot(p.vx, p.vy);
      if (s > this.params.maxSpeed) { p.vx *= this.params.maxSpeed / s; p.vy *= this.params.maxSpeed / s; }
      p.x = (p.x + p.vx * dt + this.width) % this.width;
      p.y = (p.y + p.vy * dt + this.height) % this.height;
    }
  }
  render() {
    this.clear();
    this.ctx.fillStyle = "rgba(125,215,255,.85)";
    for (const p of this.particles) this.ctx.fillRect(p.x, p.y, 2, 2);
    this.ctx.strokeStyle = "#ffd56a"; this.ctx.lineWidth = 2;
    this.ctx.beginPath(); this.ctx.arc(this.target.x, this.target.y, 8, 0, Math.PI * 2); this.ctx.stroke();
  }
  destroy() { this.canvas.removeEventListener("pointermove", this._move); super.destroy(); }
}


