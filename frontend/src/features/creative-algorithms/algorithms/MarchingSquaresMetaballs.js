import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "marching-squares-metaballs",
  name: "Marching Squares 元球",
  nameEN: "Marching Squares Metaballs",
  category: "generator",
  preview: "/creative-algorithms/previews/marching-squares-metaballs.gif",
  tags: ["等值线", "元球", "液体", "隐式曲面"]
};

const CASE_SEGMENTS = {
  1: [["left", "bottom"]],
  2: [["bottom", "right"]],
  3: [["left", "right"]],
  4: [["top", "right"]],
  5: [["top", "left"], ["bottom", "right"]],
  6: [["top", "bottom"]],
  7: [["top", "left"]],
  8: [["top", "left"]],
  9: [["top", "bottom"]],
  10: [["top", "right"], ["left", "bottom"]],
  11: [["top", "right"]],
  12: [["left", "right"]],
  13: [["bottom", "right"]],
  14: [["left", "bottom"]]
};

export default class MarchingSquaresMetaballs extends BaseCanvasAlgorithm {
  static defaults = {
    balls: 5,
    gridSize: 10,
    threshold: 1,
    speed: 0.8,
    radiusMin: 34,
    radiusMax: 62,
    lineWidth: 2,
    fill: true
  };

  reset() {
    this.metaballs = Array.from({ length: this.params.balls }, (_, i) => ({
      baseX: this.width * (0.18 + Math.random() * 0.64),
      baseY: this.height * (0.22 + Math.random() * 0.56),
      radius: this.params.radiusMin +
        Math.random() * (this.params.radiusMax - this.params.radiusMin),
      phase: Math.random() * Math.PI * 2,
      speedX: 0.55 + Math.random() * 0.8,
      speedY: 0.55 + Math.random() * 0.8
    }));
  }

  onResize() {
    if (this.metaballs) this.reset();
  }

  onParamsChanged(next) {
    if (
      "balls" in next ||
      "radiusMin" in next ||
      "radiusMax" in next
    ) this.reset();
  }

  field(x, y) {
    let value = 0;

    for (const ball of this.metaballs) {
      const bx = ball.baseX +
        Math.sin(this.elapsed * this.params.speed * ball.speedX + ball.phase) *
        this.width * 0.12;

      const by = ball.baseY +
        Math.cos(this.elapsed * this.params.speed * ball.speedY + ball.phase) *
        this.height * 0.12;

      const dx = x - bx;
      const dy = y - by;
      value += (ball.radius * ball.radius) / (dx * dx + dy * dy + 20);
    }

    return value;
  }

  edgePoint(edge, x, y, size) {
    if (edge === "top") return [x + size / 2, y];
    if (edge === "right") return [x + size, y + size / 2];
    if (edge === "bottom") return [x + size / 2, y + size];
    return [x, y + size / 2];
  }

  render() {
    this.clear();
    const size = this.params.gridSize;
    this.ctx.strokeStyle = "#82dcff";
    this.ctx.lineWidth = this.params.lineWidth;
    this.ctx.fillStyle = "rgba(55,170,220,.18)";

    for (let y = 0; y < this.height - size; y += size) {
      for (let x = 0; x < this.width - size; x += size) {
        const topLeft = this.field(x, y) >= this.params.threshold;
        const topRight = this.field(x + size, y) >= this.params.threshold;
        const bottomRight = this.field(x + size, y + size) >= this.params.threshold;
        const bottomLeft = this.field(x, y + size) >= this.params.threshold;

        const mask =
          (topLeft ? 8 : 0) |
          (topRight ? 4 : 0) |
          (bottomRight ? 2 : 0) |
          (bottomLeft ? 1 : 0);

        if (this.params.fill && mask === 15) {
          this.ctx.fillRect(x, y, size, size);
        }

        const segments = CASE_SEGMENTS[mask];
        if (!segments) continue;

        for (const [a, b] of segments) {
          const p1 = this.edgePoint(a, x, y, size);
          const p2 = this.edgePoint(b, x, y, size);
          this.ctx.beginPath();
          this.ctx.moveTo(...p1);
          this.ctx.lineTo(...p2);
          this.ctx.stroke();
        }
      }
    }
  }
}


