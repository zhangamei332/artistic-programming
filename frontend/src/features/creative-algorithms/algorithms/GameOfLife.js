import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
export const meta = {
  id: "game-of-life", name: "康威生命游戏", nameEN: "Conway's Game of Life",
  category: "simulator", preview: "/creative-algorithms/previews/game-of-life.gif",
  tags: ["元胞自动机", "涌现", "像素"]
};
export default class GameOfLife extends BaseCanvasAlgorithm {
  static defaults = { cellSize: 6, density: 0.24, stepsPerSecond: 14 };
  reset() {
    this.acc = 0;
    this.cols = Math.max(2, Math.floor(this.width / this.params.cellSize));
    this.rows = Math.max(2, Math.floor(this.height / this.params.cellSize));
    this.grid = new Uint8Array(this.cols * this.rows);
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = Math.random() < this.params.density ? 1 : 0;
  }
  onResize() { if (this.grid) this.reset(); }
  update(dt) {
    this.acc += dt;
    if (this.acc < 1 / this.params.stepsPerSecond) return;
    this.acc = 0;
    const next = new Uint8Array(this.grid.length);
    const idx = (x, y) => ((y + this.rows) % this.rows) * this.cols + ((x + this.cols) % this.cols);
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      let n = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (ox || oy) n += this.grid[idx(x + ox, y + oy)];
      const i = idx(x, y); next[i] = n === 3 || (this.grid[i] && n === 2) ? 1 : 0;
    }
    this.grid = next;
  }
  render() {
    this.clear();
    this.ctx.fillStyle = "#83edc0";
    const s = this.params.cellSize;
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      if (this.grid[y * this.cols + x]) this.ctx.fillRect(x * s, y * s, s - 1, s - 1);
    }
  }
}


