import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "hilbert-curve",
  name: "Hilbert 空间填充曲线",
  nameEN: "Hilbert Curve",
  category: "generator",
  preview: "/creative-algorithms/previews/hilbert-curve.gif",
  tags: ["递归", "空间填充", "路径", "分形"]
};

function rotate(size, x, y, rx, ry) {
  if (ry !== 0) return [x, y];
  if (rx === 1) {
    x = size - 1 - x;
    y = size - 1 - y;
  }
  return [y, x];
}

function indexToPoint(size, index) {
  let x = 0;
  let y = 0;
  let t = index;

  for (let scale = 1; scale < size; scale *= 2) {
    const rx = 1 & Math.floor(t / 2);
    const ry = 1 & (t ^ rx);
    [x, y] = rotate(scale, x, y, rx, ry);
    x += scale * rx;
    y += scale * ry;
    t = Math.floor(t / 4);
  }

  return [x, y];
}

export default class HilbertCurve extends BaseCanvasAlgorithm {
  static defaults = {
    order: 6,
    speed: 0.14,
    lineWidth: 2,
    loop: true,
    margin: 18
  };

  reset() {
    this.progress = 0;
    this.rebuild();
  }

  rebuild() {
    const size = 2 ** this.params.order;
    const count = size * size;
    const scale = Math.min(
      (this.width - this.params.margin * 2) / (size - 1),
      (this.height - this.params.margin * 2) / (size - 1)
    );

    const offsetX = (this.width - scale * (size - 1)) / 2;
    const offsetY = (this.height - scale * (size - 1)) / 2;

    this.points = Array.from({ length: count }, (_, index) => {
      const [x, y] = indexToPoint(size, index);
      return [
        offsetX + x * scale,
        offsetY + y * scale
      ];
    });
  }

  onResize() {
    if (this.points) this.rebuild();
  }

  onParamsChanged(next) {
    if ("order" in next || "margin" in next) {
      this.progress = 0;
      this.rebuild();
    }
  }

  update(dt) {
    this.progress += dt * this.params.speed;

    if (this.params.loop && this.progress > 1.08) {
      this.progress = 0;
    } else {
      this.progress = Math.min(this.progress, 1);
    }
  }

  render() {
    this.clear();
    const count = Math.max(
      2,
      Math.floor(Math.min(1, this.progress) * this.points.length)
    );

    this.ctx.strokeStyle = "#80ddff";
    this.ctx.lineWidth = this.params.lineWidth;
    this.ctx.lineJoin = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(...this.points[0]);

    for (let index = 1; index < count; index++) {
      this.ctx.lineTo(...this.points[index]);
    }

    this.ctx.stroke();

    const head = this.points[count - 1];
    this.ctx.fillStyle = "#ffd45e";
    this.ctx.beginPath();
    this.ctx.arc(head[0], head[1], 3.5, 0, Math.PI * 2);
    this.ctx.fill();
  }
}


