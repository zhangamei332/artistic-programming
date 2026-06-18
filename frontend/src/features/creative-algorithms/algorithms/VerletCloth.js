import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "verlet-cloth",
  name: "Verlet 布料",
  nameEN: "Verlet Cloth",
  category: "simulator",
  preview: "/creative-algorithms/previews/verlet-cloth.gif",
  tags: ["布料", "物理", "约束", "交互"]
};

export default class VerletCloth extends BaseCanvasAlgorithm {
  static defaults = {
    cols: 26,
    rows: 16,
    gravity: 420,
    damping: 0.992,
    constraintIterations: 5,
    pointerRadius: 65,
    pointerForce: 950
  };

  reset() {
    if (this.onPointerMove) {
      this.canvas.removeEventListener("pointermove", this.onPointerMove);
      this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    }

    this.pointer = { x: 0, y: 0, active: false };
    this.build();

    this.onPointerMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = event.clientX - rect.left;
      this.pointer.y = event.clientY - rect.top;
      this.pointer.active = true;
    };

    this.onPointerLeave = () => {
      this.pointer.active = false;
    };

    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
  }

  build() {
    const { cols, rows } = this.params;
    const marginX = this.width * 0.08;
    const top = 18;
    const usableWidth = this.width - marginX * 2;
    const usableHeight = this.height * 0.72;

    this.points = [];
    this.constraints = [];

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = marginX + x / (cols - 1) * usableWidth;
        const py = top + y / (rows - 1) * usableHeight;
        this.points.push({
          x: px,
          y: py,
          oldX: px,
          oldY: py,
          fixed: y === 0
        });

        const i = y * cols + x;
        if (x > 0) this.constraints.push([i - 1, i]);
        if (y > 0) this.constraints.push([i - cols, i]);
      }
    }

    this.restX = usableWidth / (cols - 1);
    this.restY = usableHeight / (rows - 1);
  }

  onResize() {
    if (this.points) this.build();
  }

  onParamsChanged(next) {
    if ("cols" in next || "rows" in next) this.build();
  }

  update(dt) {
    const P = this.params;

    for (const point of this.points) {
      if (point.fixed) continue;

      const vx = (point.x - point.oldX) * P.damping;
      const vy = (point.y - point.oldY) * P.damping;

      point.oldX = point.x;
      point.oldY = point.y;
      point.x += vx;
      point.y += vy + P.gravity * dt * dt;

      if (this.pointer.active) {
        const dx = point.x - this.pointer.x;
        const dy = point.y - this.pointer.y;
        const distance = Math.hypot(dx, dy) || 1;

        if (distance < P.pointerRadius) {
          const force = (1 - distance / P.pointerRadius) * P.pointerForce * dt * dt;
          point.x += dx / distance * force;
          point.y += dy / distance * force;
        }
      }
    }

    for (let iteration = 0; iteration < P.constraintIterations; iteration++) {
      for (const [aIndex, bIndex] of this.constraints) {
        const a = this.points[aIndex];
        const b = this.points[bIndex];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 1;
        const sameRow = Math.abs(aIndex - bIndex) === 1;
        const rest = sameRow ? this.restX : this.restY;
        const correction = (distance - rest) / distance * 0.5;
        const cx = dx * correction;
        const cy = dy * correction;

        if (!a.fixed) {
          a.x += cx;
          a.y += cy;
        }

        if (!b.fixed) {
          b.x -= cx;
          b.y -= cy;
        }
      }
    }
  }

  render() {
    this.clear();
    const { cols, rows } = this.params;
    this.ctx.strokeStyle = "rgba(100,195,240,.72)";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const p = this.points[i];

        if (x < cols - 1) {
          const q = this.points[i + 1];
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(q.x, q.y);
        }

        if (y < rows - 1) {
          const q = this.points[i + cols];
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(q.x, q.y);
        }
      }
    }

    this.ctx.stroke();
  }

  destroy() {
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    super.destroy();
  }
}


