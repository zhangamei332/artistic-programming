import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
export const meta = {
  id: "random-walk", name: "随机游走", nameEN: "Random Walk",
  category: "generator", preview: "/creative-algorithms/previews/random-walk.gif",
  tags: ["路径", "随机", "线条"]
};
export default class RandomWalk extends BaseCanvasAlgorithm {
  static defaults = { walkers: 10, step: 5, fade: 0.04, lineWidth: 1.5 };
  reset() {
    this.points = Array.from({ length: this.params.walkers }, () => ({
      x: this.width / 2, y: this.height / 2,
      hue: 185 + Math.random() * 80
    }));
    this.clear();
  }
  onParamsChanged(next) { if ("walkers" in next) this.reset(); }
  update() {
    for (const p of this.points) {
      const a = Math.random() * Math.PI * 2;
      p.px = p.x; p.py = p.y;
      p.x = (p.x + Math.cos(a) * this.params.step + this.width) % this.width;
      p.y = (p.y + Math.sin(a) * this.params.step + this.height) % this.height;
    }
  }
  render() {
    this.ctx.fillStyle = `rgba(8,10,16,${this.params.fade})`;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.lineWidth = this.params.lineWidth;
    for (const p of this.points) {
      this.ctx.strokeStyle = `hsl(${p.hue} 85% 68%)`;
      this.ctx.beginPath(); this.ctx.moveTo(p.px, p.py); this.ctx.lineTo(p.x, p.y); this.ctx.stroke();
    }
  }
}


