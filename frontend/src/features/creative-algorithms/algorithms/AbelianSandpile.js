import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "abelian-sandpile",
  name: "阿贝尔沙堆",
  nameEN: "Abelian Sandpile",
  category: "simulator",
  preview: "/creative-algorithms/previews/abelian-sandpile.gif",
  tags: ["自组织临界", "沙堆", "分形", "元胞"]
};

const COLORS = [
  [8, 10, 16],
  [60, 92, 145],
  [80, 190, 220],
  [255, 205, 88]
];

export default class AbelianSandpile extends BaseCanvasAlgorithm {
  static defaults = {
    resolution: 3,
    initialGrains: 22000,
    iterationsPerFrame: 90,
    threshold: 4,
    autoRestart: false
  };

  reset() {
    this.w = Math.max(24, Math.floor(this.width / this.params.resolution));
    this.h = Math.max(18, Math.floor(this.height / this.params.resolution));
    this.grid = new Uint32Array(this.w * this.h);
    this.next = new Uint32Array(this.w * this.h);
    this.grid[Math.floor(this.h / 2) * this.w + Math.floor(this.w / 2)] =
      this.params.initialGrains;

    this.buffer = document.createElement("canvas");
    this.buffer.width = this.w;
    this.buffer.height = this.h;
    this.bctx = this.buffer.getContext("2d");
    this.stable = false;
  }

  onResize() {
    if (this.grid) this.reset();
  }

  onParamsChanged(next) {
    if (
      "resolution" in next ||
      "initialGrains" in next ||
      "threshold" in next
    ) this.reset();
  }

  update() {
    if (this.stable) return;

    for (
      let iteration = 0;
      iteration < this.params.iterationsPerFrame;
      iteration++
    ) {
      this.next.fill(0);
      let unstable = false;

      for (let y = 1; y < this.h - 1; y++) {
        for (let x = 1; x < this.w - 1; x++) {
          const index = y * this.w + x;
          const grains = this.grid[index];
          const topple = Math.floor(grains / this.params.threshold);
          const remain = grains % this.params.threshold;
          this.next[index] += remain;

          if (topple > 0) {
            unstable = true;
            this.next[index - 1] += topple;
            this.next[index + 1] += topple;
            this.next[index - this.w] += topple;
            this.next[index + this.w] += topple;
          }
        }
      }

      [this.grid, this.next] = [this.next, this.grid];

      if (!unstable) {
        this.stable = true;
        if (this.params.autoRestart) this.reset();
        break;
      }
    }
  }

  render() {
    const image = this.bctx.createImageData(this.w, this.h);

    for (let index = 0; index < this.grid.length; index++) {
      const color = COLORS[
        Math.min(COLORS.length - 1, this.grid[index] % this.params.threshold)
      ];
      const pixel = index * 4;
      image.data[pixel] = color[0];
      image.data[pixel + 1] = color[1];
      image.data[pixel + 2] = color[2];
      image.data[pixel + 3] = 255;
    }

    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
  }
}


