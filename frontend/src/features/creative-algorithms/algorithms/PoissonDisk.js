import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "poisson-disk",
  name: "泊松圆盘采样",
  nameEN: "Poisson Disk Sampling",
  category: "generator",
  preview: "/creative-algorithms/previews/poisson-disk.gif",
  tags: ["采样", "点阵", "均匀随机", "排布"]
};

export default class PoissonDisk extends BaseCanvasAlgorithm {
  static defaults = {
    radius: 18,
    candidates: 30,
    pointsPerFrame: 5,
    pointSize: 2.5
  };

  reset() {
    this.cell = this.params.radius / Math.sqrt(2);
    this.gridWidth = Math.ceil(this.width / this.cell);
    this.gridHeight = Math.ceil(this.height / this.cell);
    this.grid = new Array(this.gridWidth * this.gridHeight).fill(null);
    this.points = [];
    this.active = [];

    const first = {
      x: Math.random() * this.width,
      y: Math.random() * this.height
    };

    this.insert(first);
  }

  onResize() {
    if (this.points) this.reset();
  }

  onParamsChanged(next) {
    if ("radius" in next || "candidates" in next) this.reset();
  }

  insert(point) {
    this.points.push(point);
    this.active.push(point);
    const gx = Math.floor(point.x / this.cell);
    const gy = Math.floor(point.y / this.cell);
    this.grid[gy * this.gridWidth + gx] = point;
  }

  valid(point) {
    if (
      point.x < 0 || point.x >= this.width ||
      point.y < 0 || point.y >= this.height
    ) return false;

    const gx = Math.floor(point.x / this.cell);
    const gy = Math.floor(point.y / this.cell);

    for (let y = Math.max(0, gy - 2); y <= Math.min(this.gridHeight - 1, gy + 2); y++) {
      for (let x = Math.max(0, gx - 2); x <= Math.min(this.gridWidth - 1, gx + 2); x++) {
        const other = this.grid[y * this.gridWidth + x];
        if (
          other &&
          Math.hypot(point.x - other.x, point.y - other.y) < this.params.radius
        ) return false;
      }
    }

    return true;
  }

  update() {
    for (let added = 0; added < this.params.pointsPerFrame && this.active.length; added++) {
      const activeIndex = Math.floor(Math.random() * this.active.length);
      const origin = this.active[activeIndex];
      let found = false;

      for (let i = 0; i < this.params.candidates; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = this.params.radius * (1 + Math.random());
        const point = {
          x: origin.x + Math.cos(angle) * distance,
          y: origin.y + Math.sin(angle) * distance
        };

        if (this.valid(point)) {
          this.insert(point);
          found = true;
          break;
        }
      }

      if (!found) this.active.splice(activeIndex, 1);
    }
  }

  render() {
    this.clear();
    this.ctx.fillStyle = "#80dcff";

    for (const point of this.points) {
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, this.params.pointSize, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}


