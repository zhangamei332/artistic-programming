import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";
export const meta = {
  id: "spring-grid", name: "弹簧网格", nameEN: "Spring Grid",
  category: "simulator", preview: "/creative-algorithms/previews/spring-grid.gif",
  tags: ["弹簧", "变形", "交互", "网格"]
};
export default class SpringGrid extends BaseCanvasAlgorithm {
  static defaults = { cols: 24, rows: 15, stiffness: 52, damping: 0.88, pointerForce: 7000, radius: 100 };
  reset() {
    if (this._move) this.canvas.removeEventListener("pointermove", this._move);
    if (this._leave) this.canvas.removeEventListener("pointerleave", this._leave);
    this.pointer = { x: this.width / 2, y: this.height / 2, active: false };
    this.build();
    this._move = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.pointer.x = e.clientX - r.left; this.pointer.y = e.clientY - r.top; this.pointer.active = true;
    };
    this._leave = () => this.pointer.active = false;
    this.canvas.addEventListener("pointermove", this._move);
    this.canvas.addEventListener("pointerleave", this._leave);
  }
  build() {
    this.points = [];
    for (let y = 0; y < this.params.rows; y++) for (let x = 0; x < this.params.cols; x++) {
      const bx = x / (this.params.cols - 1) * this.width, by = y / (this.params.rows - 1) * this.height;
      this.points.push({ x: bx, y: by, bx, by, vx: 0, vy: 0 });
    }
  }
  onResize() { if (this.points) this.build(); }
  update(dt) {
    const P = this.params;
    const target = this.pointer.active ? this.pointer : {
      x: this.width / 2 + Math.cos(this.elapsed) * this.width * .22,
      y: this.height / 2 + Math.sin(this.elapsed * 1.2) * this.height * .18
    };
    for (const p of this.points) {
      let fx = (p.bx - p.x) * P.stiffness, fy = (p.by - p.y) * P.stiffness;
      const dx = p.x - target.x, dy = p.y - target.y, d = Math.hypot(dx, dy) + .001;
      if (d < P.radius) { const f = (1 - d / P.radius) * P.pointerForce / d; fx += dx * f; fy += dy * f; }
      p.vx = (p.vx + fx * dt) * P.damping; p.vy = (p.vy + fy * dt) * P.damping;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  render() {
    this.clear(); const { cols, rows } = this.params;
    this.ctx.strokeStyle = "rgba(100,190,245,.55)"; this.ctx.lineWidth = 1; this.ctx.beginPath();
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x, p = this.points[i];
      if (x < cols - 1) { const q = this.points[i + 1]; this.ctx.moveTo(p.x,p.y); this.ctx.lineTo(q.x,q.y); }
      if (y < rows - 1) { const q = this.points[i + cols]; this.ctx.moveTo(p.x,p.y); this.ctx.lineTo(q.x,q.y); }
    }
    this.ctx.stroke();
    this.ctx.fillStyle = "#e7f7ff";
    for (const p of this.points) { this.ctx.beginPath(); this.ctx.arc(p.x,p.y,1.5,0,Math.PI*2); this.ctx.fill(); }
  }
  destroy() {
    this.canvas.removeEventListener("pointermove", this._move);
    this.canvas.removeEventListener("pointerleave", this._leave);
    super.destroy();
  }
}


