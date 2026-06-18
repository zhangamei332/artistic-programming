import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "double-pendulum",
  name: "双摆混沌",
  nameEN: "Double Pendulum",
  category: "simulator",
  preview: "/creative-algorithms/previews/double-pendulum.gif",
  tags: ["混沌", "摆动", "轨迹", "物理"]
};

export default class DoublePendulum extends BaseCanvasAlgorithm {
  static defaults = {
    length1: 92,
    length2: 82,
    mass1: 1,
    mass2: 1,
    gravity: 9.81,
    angle1: 1.65,
    angle2: 1.12,
    damping: 0.999,
    timeScale: 1.1,
    trailLength: 520
  };

  reset() {
    this.theta1 = this.params.angle1;
    this.theta2 = this.params.angle2;
    this.omega1 = 0;
    this.omega2 = 0;
    this.trace = [];
  }

  onParamsChanged(next) {
    if (
      "length1" in next ||
      "length2" in next ||
      "mass1" in next ||
      "mass2" in next ||
      "angle1" in next ||
      "angle2" in next
    ) this.reset();
  }

  update(dt) {
    const P = this.params;
    const substeps = 4;
    const step = dt * P.timeScale / substeps;

    for (let substep = 0; substep < substeps; substep++) {
      const difference = this.theta1 - this.theta2;
      const cosine = Math.cos(difference);
      const sine = Math.sin(difference);

      const denominator1 =
        (P.mass1 + P.mass2) * P.length1 -
        P.mass2 * P.length1 * cosine * cosine;

      const alpha1 = (
        P.mass2 * P.length1 *
          this.omega1 * this.omega1 * sine * cosine +
        P.mass2 * P.gravity * Math.sin(this.theta2) * cosine +
        P.mass2 * P.length2 *
          this.omega2 * this.omega2 * sine -
        (P.mass1 + P.mass2) *
          P.gravity * Math.sin(this.theta1)
      ) / denominator1;

      const denominator2 =
        (P.length2 / P.length1) * denominator1;

      const alpha2 = (
        -P.mass2 * P.length2 *
          this.omega2 * this.omega2 * sine * cosine +
        (P.mass1 + P.mass2) * (
          P.gravity * Math.sin(this.theta1) * cosine -
          P.length1 * this.omega1 * this.omega1 * sine -
          P.gravity * Math.sin(this.theta2)
        )
      ) / denominator2;

      this.omega1 =
        (this.omega1 + alpha1 * step) * P.damping;
      this.omega2 =
        (this.omega2 + alpha2 * step) * P.damping;
      this.theta1 += this.omega1 * step;
      this.theta2 += this.omega2 * step;
    }
  }

  render() {
    this.clear();
    const originX = this.width / 2;
    const originY = 24;

    const x1 =
      originX + Math.sin(this.theta1) * this.params.length1;
    const y1 =
      originY + Math.cos(this.theta1) * this.params.length1;

    const x2 =
      x1 + Math.sin(this.theta2) * this.params.length2;
    const y2 =
      y1 + Math.cos(this.theta2) * this.params.length2;

    this.trace.push([x2, y2]);
    if (this.trace.length > this.params.trailLength) {
      this.trace.shift();
    }

    if (this.trace.length > 1) {
      this.ctx.strokeStyle = "#ff83cf";
      this.ctx.lineWidth = 1.2;
      this.ctx.beginPath();
      this.ctx.moveTo(...this.trace[0]);

      for (let index = 1; index < this.trace.length; index++) {
        this.ctx.lineTo(...this.trace[index]);
      }

      this.ctx.stroke();
    }

    this.ctx.strokeStyle = "#8bdcff";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(originX, originY);
    this.ctx.lineTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();

    this.ctx.fillStyle = "#eefaff";
    this.ctx.beginPath();
    this.ctx.arc(x1, y1, 5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = "#ffd45e";
    this.ctx.beginPath();
    this.ctx.arc(x2, y2, 6, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

