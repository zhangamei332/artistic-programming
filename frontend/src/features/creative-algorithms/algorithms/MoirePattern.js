import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "moire-pattern",
  name: "莫尔干涉纹",
  nameEN: "Moiré Pattern",
  category: "generator",
  preview: "/creative-algorithms/previews/moire-pattern.gif",
  tags: ["干涉", "视觉错觉", "线纹", "动态"]
};

export default class MoirePattern extends BaseCanvasAlgorithm {
  static defaults = {
    spacing: 7,
    lineWidth: 1,
    motionRadius: 38,
    speed: 0.7,
    pattern: "circles"
  };

  renderPattern(cx, cy, color) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = this.params.lineWidth;

    if (this.params.pattern === "lines") {
      for (
        let x = -this.width;
        x < this.width * 2;
        x += this.params.spacing
      ) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + cx - this.width / 2, 0);
        this.ctx.lineTo(
          x + cx - this.width / 2 + this.height * 0.35,
          this.height
        );
        this.ctx.stroke();
      }
      return;
    }

    const maxRadius = Math.hypot(this.width, this.height);

    for (
      let radius = this.params.spacing;
      radius < maxRadius;
      radius += this.params.spacing
    ) {
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  render() {
    this.clear();

    const motionX =
      Math.sin(this.elapsed * this.params.speed) *
      this.params.motionRadius;

    const motionY =
      Math.cos(this.elapsed * this.params.speed * 0.83) *
      this.params.motionRadius * 0.65;

    this.renderPattern(
      this.width * 0.43,
      this.height * 0.5,
      "rgba(100,210,240,.75)"
    );

    this.renderPattern(
      this.width * 0.57 + motionX,
      this.height * 0.5 + motionY,
      "rgba(245,135,205,.72)"
    );
  }
}


