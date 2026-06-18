import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "elementary-cellular-automata",
  name: "一维元胞自动机",
  nameEN: "Elementary Cellular Automata",
  category: "simulator",
  preview: "/creative-algorithms/previews/elementary-cellular-automata.gif",
  tags: ["Rule 30", "Rule 90", "Rule 110", "像素"]
};

export default class ElementaryCellularAutomata extends BaseCanvasAlgorithm {
  static defaults = {
    rule: 110,
    cellSize: 3,
    rowsPerSecond: 28,
    randomSeed: false,
    autoRestart: true,
    restartDelay: 1
  };

  reset() {
    this.cols = Math.max(8, Math.floor(this.width / this.params.cellSize));
    this.rows = Math.max(8, Math.floor(this.height / this.params.cellSize));
    this.current = new Uint8Array(this.cols);

    if (this.params.randomSeed) {
      for (let index = 0; index < this.cols; index++) {
        this.current[index] = Math.random() > 0.5 ? 1 : 0;
      }
    } else {
      this.current[Math.floor(this.cols / 2)] = 1;
    }

    this.history = [];
    this.accumulator = 0;
    this.finishedAt = null;
  }

  onResize() {
    if (this.current) this.reset();
  }

  onParamsChanged(next) {
    if (
      "rule" in next ||
      "cellSize" in next ||
      "randomSeed" in next
    ) this.reset();
  }

  step() {
    this.history.push(this.current);

    if (this.history.length >= this.rows) {
      this.finishedAt = this.elapsed;
      return;
    }

    const next = new Uint8Array(this.cols);

    for (let index = 0; index < this.cols; index++) {
      const left = this.current[(index - 1 + this.cols) % this.cols];
      const center = this.current[index];
      const right = this.current[(index + 1) % this.cols];
      const pattern = (left << 2) | (center << 1) | right;
      next[index] = (this.params.rule >> pattern) & 1;
    }

    this.current = next;
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
    const interval = 1 / this.params.rowsPerSecond;

    while (this.accumulator >= interval) {
      this.accumulator -= interval;
      this.step();
    }
  }

  render() {
    this.clear();
    this.ctx.fillStyle = "#78e6bd";
    const size = this.params.cellSize;

    for (let y = 0; y < this.history.length; y++) {
      const row = this.history[y];

      for (let x = 0; x < row.length; x++) {
        if (row[x]) {
          this.ctx.fillRect(x * size, y * size, size, size);
        }
      }
    }
  }
}


