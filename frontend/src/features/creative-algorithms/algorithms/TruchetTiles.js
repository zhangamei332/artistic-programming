import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "truchet-tiles",
  name: "Truchet 随机铺砌",
  nameEN: "Truchet Tiles",
  category: "generator",
  preview: "/creative-algorithms/previews/truchet-tiles.gif",
  tags: ["铺砌", "连续曲线", "图案", "随机"]
};

export default class TruchetTiles extends BaseCanvasAlgorithm {
  static defaults = {
    tileSize: 28,
    lineWidth: 3,
    mutationRate: 4,
    animate: true,
    style: "arcs",
    seedDensity: 0.5
  };

  reset() {
    this.cols = Math.ceil(this.width / this.params.tileSize);
    this.rows = Math.ceil(this.height / this.params.tileSize);
    this.tiles = new Uint8Array(this.cols * this.rows);

    for (let index = 0; index < this.tiles.length; index++) {
      this.tiles[index] =
        Math.random() < this.params.seedDensity ? 1 : 0;
    }

    this.accumulator = 0;
  }

  onResize() {
    if (this.tiles) this.reset();
  }

  onParamsChanged(next) {
    if (
      "tileSize" in next ||
      "seedDensity" in next
    ) this.reset();
  }

  update(dt) {
    if (!this.params.animate) return;
    this.accumulator += dt * this.params.mutationRate;

    while (this.accumulator >= 1) {
      this.accumulator -= 1;
      const index = Math.floor(Math.random() * this.tiles.length);
      this.tiles[index] ^= 1;
    }
  }

  renderTileArcs(x, y, size, state) {
    this.ctx.strokeStyle = state ? "#ff91ce" : "#79ddff";
    this.ctx.lineWidth = this.params.lineWidth;

    if (state === 0) {
      this.ctx.beginPath();
      this.ctx.arc(x, y, size / 2, 0, Math.PI / 2);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(
        x + size,
        y + size,
        size / 2,
        Math.PI,
        Math.PI * 1.5
      );
      this.ctx.stroke();
    } else {
      this.ctx.beginPath();
      this.ctx.arc(
        x + size,
        y,
        size / 2,
        Math.PI / 2,
        Math.PI
      );
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(
        x,
        y + size,
        size / 2,
        Math.PI * 1.5,
        Math.PI * 2
      );
      this.ctx.stroke();
    }
  }

  renderTileDiagonal(x, y, size, state) {
    this.ctx.strokeStyle = state ? "#ff91ce" : "#79ddff";
    this.ctx.lineWidth = this.params.lineWidth;
    this.ctx.beginPath();

    if (state === 0) {
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + size, y + size);
    } else {
      this.ctx.moveTo(x + size, y);
      this.ctx.lineTo(x, y + size);
    }

    this.ctx.stroke();
  }

  render() {
    this.clear();
    const size = this.params.tileSize;

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const state = this.tiles[y * this.cols + x];

        if (this.params.style === "diagonal") {
          this.renderTileDiagonal(x * size, y * size, size, state);
        } else {
          this.renderTileArcs(x * size, y * size, size, state);
        }
      }
    }
  }
}

