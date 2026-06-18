import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "dla-growth",
  name: "扩散限制聚集",
  nameEN: "Diffusion-Limited Aggregation",
  category: "simulator",
  preview: "/creative-algorithms/previews/dla-growth.gif",
  tags: ["生长", "珊瑚", "冰晶", "分形"]
};

export default class DLAGrowth extends BaseCanvasAlgorithm {
  static defaults = {
    walkersPerFrame: 35,
    maxSteps: 650,
    particleSize: 2,
    spawnPadding: 16,
    maxParticles: 4500
  };

  reset() {
    this.cluster = new Set();
    this.points = [];
    this.radius = 4;
    const x = Math.floor(this.width / 2);
    const y = Math.floor(this.height / 2);
    this.addPoint(x, y);
  }

  key(x, y) {
    return `${x},${y}`;
  }

  addPoint(x, y) {
    this.cluster.add(this.key(x, y));
    this.points.push({ x, y });
    this.radius = Math.max(
      this.radius,
      Math.hypot(x - this.width / 2, y - this.height / 2)
    );
  }

  hasNeighbor(x, y) {
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if ((ox || oy) && this.cluster.has(this.key(x + ox, y + oy))) return true;
      }
    }
    return false;
  }

  update() {
    if (this.points.length >= this.params.maxParticles) return;

    for (let n = 0; n < this.params.walkersPerFrame; n++) {
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = Math.min(
        this.radius + this.params.spawnPadding,
        Math.min(this.width, this.height) * 0.48
      );

      let x = Math.floor(this.width / 2 + Math.cos(angle) * spawnRadius);
      let y = Math.floor(this.height / 2 + Math.sin(angle) * spawnRadius);

      for (let step = 0; step < this.params.maxSteps; step++) {
        x += Math.floor(Math.random() * 3) - 1;
        y += Math.floor(Math.random() * 3) - 1;

        if (x < 2 || x >= this.width - 2 || y < 2 || y >= this.height - 2) break;

        if (this.hasNeighbor(x, y)) {
          this.addPoint(x, y);
          break;
        }
      }
    }
  }

  render() {
    this.clear();
    const size = this.params.particleSize;

    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const ratio = i / Math.max(1, this.points.length - 1);
      this.ctx.fillStyle = `hsl(${190 + ratio * 45} 75% ${48 + ratio * 22}%)`;
      this.ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
  }
}


