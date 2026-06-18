import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
import { createSimplex2D } from "../utils/noise.js";

export const meta = {
  id: "curl-noise",
  name: "Curl Noise 旋流",
  nameEN: "Curl Noise",
  category: "field",
  preview: "/creative-algorithms/previews/curl-noise.gif",
  tags: ["粒子", "烟雾", "旋流", "向量场"]
};

export default class CurlNoise extends BaseCanvasAlgorithm {
  static defaults = {
    count: 900,
    scale: 0.005,
    speed: 65,
    epsilon: 0.8,
    fade: 0.06,
    seed: 73
  };

  reset() {
    this.noise = createSimplex2D(this.params.seed);
    this.particles = Array.from({ length: this.params.count }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      px: 0,
      py: 0,
      life: Math.random() * 5
    }));
    this.clear();
  }

  onParamsChanged(next) {
    if ("count" in next || "seed" in next) this.reset();
  }

  sample(x, y) {
    return this.noise(
      x * this.params.scale + this.elapsed * 0.04,
      y * this.params.scale
    );
  }

  update(dt) {
    const e = this.params.epsilon;

    for (const p of this.particles) {
      p.px = p.x;
      p.py = p.y;

      const dx = (this.sample(p.x + e, p.y) - this.sample(p.x - e, p.y)) / (2 * e);
      const dy = (this.sample(p.x, p.y + e) - this.sample(p.x, p.y - e)) / (2 * e);

      let vx = dy;
      let vy = -dx;
      const length = Math.hypot(vx, vy) || 1;
      vx /= length;
      vy /= length;

      p.x += vx * this.params.speed * dt;
      p.y += vy * this.params.speed * dt;
      p.life += dt;

      if (
        p.x < 0 || p.x > this.width ||
        p.y < 0 || p.y > this.height ||
        p.life > 8
      ) {
        p.x = Math.random() * this.width;
        p.y = Math.random() * this.height;
        p.px = p.x;
        p.py = p.y;
        p.life = 0;
      }
    }
  }

  render() {
    this.ctx.fillStyle = `rgba(8,10,16,${this.params.fade})`;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.strokeStyle = "rgba(105,215,245,.65)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();

    for (const p of this.particles) {
      this.ctx.moveTo(p.px, p.py);
      this.ctx.lineTo(p.x, p.y);
    }

    this.ctx.stroke();
  }
}


