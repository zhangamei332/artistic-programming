import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "wave-function-collapse",
  name: "波函数坍缩",
  nameEN: "Wave Function Collapse",
  category: "generator",
  preview: "/creative-algorithms/previews/wave-function-collapse.gif",
  tags: ["规则生成", "地图", "瓷砖", "约束传播"]
};

const TILES = Array.from({ length: 16 }, (_, id) => ({
  id,
  edges: [
    (id >> 0) & 1,
    (id >> 1) & 1,
    (id >> 2) & 1,
    (id >> 3) & 1
  ]
}));

export default class WaveFunctionCollapse extends BaseCanvasAlgorithm {
  static defaults = {
    tileSize: 24,
    stepsPerSecond: 28,
    lineWidth: 3,
    autoRestart: true,
    restartDelay: 1.2
  };

  reset() {
    this.cols = Math.max(2, Math.floor(this.width / this.params.tileSize));
    this.rows = Math.max(2, Math.floor(this.height / this.params.tileSize));
    this.cells = Array.from(
      { length: this.cols * this.rows },
      () => new Set(TILES.map((tile) => tile.id))
    );
    this.accumulator = 0;
    this.finishedAt = null;
  }

  onResize() {
    if (this.cells) this.reset();
  }

  onParamsChanged(next) {
    if ("tileSize" in next) this.reset();
  }

  neighbors(index) {
    const x = index % this.cols;
    const y = Math.floor(index / this.cols);
    const result = [];

    if (y > 0) result.push([index - this.cols, 0, 2]);
    if (x < this.cols - 1) result.push([index + 1, 1, 3]);
    if (y < this.rows - 1) result.push([index + this.cols, 2, 0]);
    if (x > 0) result.push([index - 1, 3, 1]);

    return result;
  }

  propagate(start) {
    const stack = [start];

    while (stack.length) {
      const index = stack.pop();

      for (const [neighborIndex, ownSide, neighborSide] of this.neighbors(index)) {
        const allowed = new Set();

        for (const neighborTile of this.cells[neighborIndex]) {
          const compatible = [...this.cells[index]].some(
            (ownTile) =>
              TILES[ownTile].edges[ownSide] ===
              TILES[neighborTile].edges[neighborSide]
          );

          if (compatible) allowed.add(neighborTile);
        }

        if (!allowed.size) return false;

        if (allowed.size !== this.cells[neighborIndex].size) {
          this.cells[neighborIndex] = allowed;
          stack.push(neighborIndex);
        }
      }
    }

    return true;
  }

  collapseOne() {
    const candidates = this.cells
      .map((options, index) => ({ options, index }))
      .filter(({ options }) => options.size > 1);

    if (!candidates.length) {
      this.finishedAt = this.elapsed;
      return;
    }

    const entropy = Math.min(...candidates.map(({ options }) => options.size));
    const lowest = candidates.filter(({ options }) => options.size === entropy);
    const selected = lowest[Math.floor(Math.random() * lowest.length)];
    const choices = [...selected.options];
    selected.options.clear();
    selected.options.add(choices[Math.floor(Math.random() * choices.length)]);

    if (!this.propagate(selected.index)) this.reset();
  }

  update(dt) {
    if (
      this.finishedAt !== null &&
      this.params.autoRestart &&
      this.elapsed - this.finishedAt > this.params.restartDelay
    ) {
      this.reset();
      return;
    }

    if (this.finishedAt !== null) return;

    this.accumulator += dt;
    const interval = 1 / this.params.stepsPerSecond;

    while (this.accumulator >= interval) {
      this.accumulator -= interval;
      this.collapseOne();
      if (this.finishedAt !== null) break;
    }
  }

  renderTile(tileId, x, y, size) {
    const edges = TILES[tileId].edges;
    const cx = x + size / 2;
    const cy = y + size / 2;

    this.ctx.strokeStyle = "#79dfff";
    this.ctx.lineWidth = this.params.lineWidth;
    this.ctx.lineCap = "round";

    const points = [
      [cx, y],
      [x + size, cy],
      [cx, y + size],
      [x, cy]
    ];

    for (let side = 0; side < 4; side++) {
      if (!edges[side]) continue;
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy);
      this.ctx.lineTo(...points[side]);
      this.ctx.stroke();
    }

    this.ctx.fillStyle = "#eefaff";
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  render() {
    this.clear();
    const size = this.params.tileSize;

    for (let index = 0; index < this.cells.length; index++) {
      const options = this.cells[index];
      const x = (index % this.cols) * size;
      const y = Math.floor(index / this.cols) * size;

      if (options.size === 1) {
        this.ctx.fillStyle = "#101722";
        this.ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
        this.renderTile([...options][0], x, y, size);
      } else {
        const intensity = 1 - options.size / TILES.length;
        this.ctx.fillStyle = `rgba(75,160,205,${0.12 + intensity * 0.45})`;
        this.ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
      }
    }
  }
}


