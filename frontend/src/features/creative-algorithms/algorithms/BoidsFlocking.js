import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
export const meta = {
  id: "boids-flocking", name: "鱼群涌现", nameEN: "Boids Flocking",
  category: "simulator", preview: "/creative-algorithms/previews/boids-flocking.gif",
  tags: ["鱼群", "涌现", "群体智能"]
};
export default class BoidsFlocking extends BaseCanvasAlgorithm {
  static defaults = {
    count: 160, perception: 55, separationRadius: 22,
    separation: 1.5, alignment: 1.0, cohesion: 0.85,
    maxSpeed: 90, maxForce: 45
  };
  reset() {
    this.boids = Array.from({ length: this.params.count }, () => {
      const a = Math.random() * Math.PI * 2;
      return { x: Math.random() * this.width, y: Math.random() * this.height, vx: Math.cos(a) * 55, vy: Math.sin(a) * 55 };
    });
  }
  onParamsChanged(next) { if ("count" in next) this.reset(); }
  update(dt) {
    const P = this.params, next = [];
    for (let i = 0; i < this.boids.length; i++) {
      const b = this.boids[i];
      let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0, ns = 0;
      for (let j = 0; j < this.boids.length; j++) {
        if (i === j) continue;
        const o = this.boids[j];
        let dx = o.x - b.x, dy = o.y - b.y;
        if (dx > this.width / 2) dx -= this.width; if (dx < -this.width / 2) dx += this.width;
        if (dy > this.height / 2) dy -= this.height; if (dy < -this.height / 2) dy += this.height;
        const d = Math.hypot(dx, dy);
        if (d < P.perception) { ax += o.vx; ay += o.vy; cx += dx; cy += dy; n++; }
        if (d > 0 && d < P.separationRadius) { sx -= dx / (d * d); sy -= dy / (d * d); ns++; }
      }
      let fx = 0, fy = 0;
      if (n) {
        ax = ax / n - b.vx; ay = ay / n - b.vy;
        cx /= n; cy /= n;
        fx += ax * P.alignment + cx * .02 * P.cohesion;
        fy += ay * P.alignment + cy * .02 * P.cohesion;
      }
      if (ns) { fx += sx * 700 * P.separation; fy += sy * 700 * P.separation; }
      const fm = Math.hypot(fx, fy);
      if (fm > P.maxForce) { fx *= P.maxForce / fm; fy *= P.maxForce / fm; }
      let vx = b.vx + fx * dt, vy = b.vy + fy * dt;
      const sp = Math.hypot(vx, vy);
      if (sp > P.maxSpeed) { vx *= P.maxSpeed / sp; vy *= P.maxSpeed / sp; }
      next.push({ x: (b.x + vx * dt + this.width) % this.width, y: (b.y + vy * dt + this.height) % this.height, vx, vy });
    }
    this.boids = next;
  }
  render() {
    this.clear();
    this.ctx.fillStyle = "#80ddff";
    for (const b of this.boids) {
      const a = Math.atan2(b.vy, b.vx);
      this.ctx.beginPath();
      this.ctx.moveTo(b.x + Math.cos(a) * 5, b.y + Math.sin(a) * 5);
      this.ctx.lineTo(b.x + Math.cos(a + 2.5) * 4, b.y + Math.sin(a + 2.5) * 4);
      this.ctx.lineTo(b.x + Math.cos(a - 2.5) * 4, b.y + Math.sin(a - 2.5) * 4);
      this.ctx.closePath(); this.ctx.fill();
    }
  }
}


