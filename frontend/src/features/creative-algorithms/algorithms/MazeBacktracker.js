import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "maze-backtracker",
  name: "深度优先迷宫",
  nameEN: "Recursive Backtracker Maze",
  category: "generator",
  preview: "/creative-algorithms/previews/maze-backtracker.gif",
  tags: ["迷宫", "深度优先", "路径", "地图"]
};

const DIRECTIONS = [
  { dx: 0, dy: -1, wall: 0, opposite: 2 },
  { dx: 1, dy: 0, wall: 1, opposite: 3 },
  { dx: 0, dy: 1, wall: 2, opposite: 0 },
  { dx: -1, dy: 0, wall: 3, opposite: 1 }
];

export default class MazeBacktracker extends BaseCanvasAlgorithm {
  static defaults = {
    cellSize: 18,
    stepsPerSecond: 70,
    lineWidth: 1.2,
    autoRestart: true,
    restartDelay: 1.3
  };

  reset() {
    this.cols = Math.max(2, Math.floor(this.width / this.params.cellSize));
    this.rows = Math.max(2, Math.floor(this.height / this.params.cellSize));
    this.cells = Array.from({ length: this.cols * this.rows }, () => ({
      visited: false,
      walls: [true, true, true, true]
    }));

    this.stack = [0];
    this.cells[0].visited = true;
    this.accumulator = 0;
    this.finishedAt = null;
  }

  onResize() {
    if (this.cells) this.reset();
  }

  onParamsChanged(next) {
    if ("cellSize" in next) this.reset();
  }

  step() {
    if (!this.stack.length) {
      this.finishedAt = this.elapsed;
      return;
    }

    const index = this.stack[this.stack.length - 1];
    const x = index % this.cols;
    const y = Math.floor(index / this.cols);

    const choices = DIRECTIONS.filter(({ dx, dy }) => {
      const nx = x + dx;
      const ny = y + dy;
      return (
        nx >= 0 && nx < this.cols &&
        ny >= 0 && ny < this.rows &&
        !this.cells[ny * this.cols + nx].visited
      );
    });

    if (!choices.length) {
      this.stack.pop();
      return;
    }

    const direction = choices[Math.floor(Math.random() * choices.length)];
    const nx = x + direction.dx;
    const ny = y + direction.dy;
    const nextIndex = ny * this.cols + nx;

    this.cells[index].walls[direction.wall] = false;
    this.cells[nextIndex].walls[direction.opposite] = false;
    this.cells[nextIndex].visited = true;
    this.stack.push(nextIndex);
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
      this.step();
    }
  }

  render() {
    this.clear();
    const size = this.params.cellSize;
    this.ctx.lineWidth = this.params.lineWidth;
    this.ctx.strokeStyle = "#83dfff";

    for (let index = 0; index < this.cells.length; index++) {
      const cell = this.cells[index];
      const x = (index % this.cols) * size;
      const y = Math.floor(index / this.cols) * size;

      if (cell.visited) {
        this.ctx.fillStyle = "#101d2a";
        this.ctx.fillRect(x, y, size, size);
      }

      this.ctx.beginPath();
      if (cell.walls[0]) {
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + size, y);
      }
      if (cell.walls[1]) {
        this.ctx.moveTo(x + size, y);
        this.ctx.lineTo(x + size, y + size);
      }
      if (cell.walls[2]) {
        this.ctx.moveTo(x, y + size);
        this.ctx.lineTo(x + size, y + size);
      }
      if (cell.walls[3]) {
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x, y + size);
      }
      this.ctx.stroke();
    }

    if (this.stack.length) {
      const active = this.stack[this.stack.length - 1];
      const x = (active % this.cols) * size + size / 2;
      const y = Math.floor(active / this.cols) * size + size / 2;
      this.ctx.fillStyle = "#ffd45e";
      this.ctx.beginPath();
      this.ctx.arc(x, y, size * 0.22, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}


