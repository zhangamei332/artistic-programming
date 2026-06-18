import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "forest-fire",
  name: "森林火灾模型",
  nameEN: "Forest Fire Cellular Automaton",
  category: "simulator",
  preview: "/creative-algorithms/previews/forest-fire.gif",
  tags: ["生态", "传播", "元胞自动机", "火焰"]
};

export default class ForestFire extends BaseCanvasAlgorithm {
  static defaults = {
    cellSize: 4,
    initialDensity: 0.62,
    growthProbability: 0.012,
    lightningProbability: 0.00055,
    stepsPerSecond: 18,
    neighborhood: "von-neumann"
  };

  reset() {
    this.cols = Math.max(8, Math.floor(this.width / this.params.cellSize));
    this.rows = Math.max(8, Math.floor(this.height / this.params.cellSize));
    this.grid = new Uint8Array(this.cols * this.rows);
    this.next = new Uint8Array(this.grid.length);

    for (let index = 0; index < this.grid.length; index++) {
      this.grid[index] =
        Math.random() < this.params.initialDensity ? 1 : 0;
    }

    this.grid[
      Math.floor(this.rows / 2) * this.cols +
      Math.floor(this.cols / 2)
    ] = 2;

    this.accumulator = 0;
  }

  onResize() {
    if (this.grid) this.reset();
  }

  onParamsChanged(next) {
    if ("cellSize" in next || "initialDensity" in next) this.reset();
  }

  isBurningNeighbor(x, y) {
    const offsets = this.params.neighborhood === "moore"
      ? [
          [-1,-1],[0,-1],[1,-1],
          [-1,0],        [1,0],
          [-1,1], [0,1], [1,1]
        ]
      : [[0,-1],[1,0],[0,1],[-1,0]];

    for (const [dx, dy] of offsets) {
      const nx = (x + dx + this.cols) % this.cols;
      const ny = (y + dy + this.rows) % this.rows;

      if (this.grid[ny * this.cols + nx] === 2) return true;
    }

    return false;
  }

  step() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const index = y * this.cols + x;
        const state = this.grid[index];

        if (state === 2) {
          this.next[index] = 0;
        } else if (state === 1) {
          const ignite =
            this.isBurningNeighbor(x, y) ||
            Math.random() < this.params.lightningProbability;

          this.next[index] = ignite ? 2 : 1;
        } else {
          this.next[index] =
            Math.random() < this.params.growthProbability ? 1 : 0;
        }
      }
    }

    [this.grid, this.next] = [this.next, this.grid];
  }

  update(dt) {
    this.accumulator += dt;
    const interval = 1 / this.params.stepsPerSecond;

    while (this.accumulator >= interval) {
      this.accumulator -= interval;
      this.step();
    }
  }

  render() {
    this.clear();
    const size = this.params.cellSize;

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const state = this.grid[y * this.cols + x];

        if (state === 0) continue;
        this.ctx.fillStyle = state === 1 ? "#399c68" : "#ff6947";
        this.ctx.fillRect(x * size, y * size, size, size);
      }
    }
  }
}


