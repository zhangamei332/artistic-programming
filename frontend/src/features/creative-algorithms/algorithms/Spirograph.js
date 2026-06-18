import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "spirograph",
  name: "万花尺曲线",
  nameEN: "Spirograph",
  category: "generator",
  preview: "/creative-algorithms/previews/spirograph.gif",
  tags: ["摆线", "齿轮", "曲线", "数学艺术"]
};

export default class Spirograph extends BaseCanvasAlgorithm {
  static defaults = {
    outerRadius: 78,
    innerRadius: 31,
    penDistance: 58,
    speed: 1.2,
    lineWidth: 1.7,
    fade: 0.025
  };

  reset() {
    this.time = 0;
    this.previous = null;
    this.clear();
  }

  update(dt) {
    this.time += dt * this.params.speed;
  }

  render() {
    this.ctx.fillStyle = `rgba(8,10,16,${this.params.fade})`;
    this.ctx.fillRect(0, 0, this.width, this.height);

    const R = this.params.outerRadius;
    const r = Math.max(1, this.params.innerRadius);
    const d = this.params.penDistance;
    const t = this.time;
    const x = this.width / 2 +
      (R - r) * Math.cos(t) +
      d * Math.cos((R - r) / r * t);

    const y = this.height / 2 +
      (R - r) * Math.sin(t) -
      d * Math.sin((R - r) / r * t);

    if (this.previous) {
      this.ctx.strokeStyle = "#7bdfff";
      this.ctx.lineWidth = this.params.lineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(...this.previous);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
    }

    this.previous = [x, y];
    this.ctx.fillStyle = "#ffd45e";
    this.ctx.beginPath();
    this.ctx.arc(x, y, 3, 0, Math.PI * 2);
    this.ctx.fill();
  }
}


