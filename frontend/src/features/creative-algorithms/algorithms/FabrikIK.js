import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "fabrik-ik",
  name: "FABRIK 反向运动学",
  nameEN: "FABRIK Inverse Kinematics",
  category: "simulator",
  preview: "/creative-algorithms/previews/fabrik-ik.gif",
  tags: ["骨骼", "机械臂", "触手", "反向运动学"]
};

export default class FabrikIK extends BaseCanvasAlgorithm {
  static defaults = {
    segments: 9,
    segmentLength: 28,
    iterations: 12,
    tolerance: 0.5,
    autoTarget: true,
    targetSpeed: 0.8,
    lineWidth: 5
  };

  reset() {
    this.base = {
      x: this.width * 0.22,
      y: this.height * 0.72
    };

    this.target = {
      x: this.width * 0.72,
      y: this.height * 0.48,
      pointerActive: false
    };

    this.joints = Array.from(
      { length: this.params.segments + 1 },
      (_, index) => ({
        x: this.base.x + index * this.params.segmentLength,
        y: this.base.y
      })
    );

    this.onPointerMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.target.x = event.clientX - rect.left;
      this.target.y = event.clientY - rect.top;
      this.target.pointerActive = true;
    };

    this.onPointerLeave = () => {
      this.target.pointerActive = false;
    };

    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
  }

  onResize() {
    if (this.joints) {
      this.base.x = this.width * 0.22;
      this.base.y = this.height * 0.72;
    }
  }

  onParamsChanged(next) {
    if ("segments" in next || "segmentLength" in next) {
      this.canvas.removeEventListener("pointermove", this.onPointerMove);
      this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
      this.reset();
    }
  }

  normalize(dx, dy) {
    const length = Math.hypot(dx, dy) || 1;
    return [dx / length, dy / length];
  }

  solve(targetX, targetY) {
    const totalLength =
      this.params.segments * this.params.segmentLength;

    const distanceToTarget = Math.hypot(
      targetX - this.base.x,
      targetY - this.base.y
    );

    if (distanceToTarget >= totalLength) {
      const [nx, ny] = this.normalize(
        targetX - this.base.x,
        targetY - this.base.y
      );

      this.joints[0].x = this.base.x;
      this.joints[0].y = this.base.y;

      for (let index = 1; index < this.joints.length; index++) {
        this.joints[index].x =
          this.joints[index - 1].x +
          nx * this.params.segmentLength;

        this.joints[index].y =
          this.joints[index - 1].y +
          ny * this.params.segmentLength;
      }

      return;
    }

    for (
      let iteration = 0;
      iteration < this.params.iterations;
      iteration++
    ) {
      const end = this.joints[this.joints.length - 1];
      end.x = targetX;
      end.y = targetY;

      for (let index = this.joints.length - 2; index >= 0; index--) {
        const current = this.joints[index];
        const next = this.joints[index + 1];
        const [nx, ny] = this.normalize(
          current.x - next.x,
          current.y - next.y
        );

        current.x = next.x + nx * this.params.segmentLength;
        current.y = next.y + ny * this.params.segmentLength;
      }

      this.joints[0].x = this.base.x;
      this.joints[0].y = this.base.y;

      for (let index = 1; index < this.joints.length; index++) {
        const previous = this.joints[index - 1];
        const current = this.joints[index];
        const [nx, ny] = this.normalize(
          current.x - previous.x,
          current.y - previous.y
        );

        current.x = previous.x + nx * this.params.segmentLength;
        current.y = previous.y + ny * this.params.segmentLength;
      }

      const solvedEnd = this.joints[this.joints.length - 1];
      if (
        Math.hypot(
          solvedEnd.x - targetX,
          solvedEnd.y - targetY
        ) < this.params.tolerance
      ) break;
    }
  }

  update() {
    if (
      this.params.autoTarget &&
      !this.target.pointerActive
    ) {
      this.target.x =
        this.width * 0.68 +
        Math.cos(this.elapsed * this.params.targetSpeed) *
        this.width * 0.2;

      this.target.y =
        this.height * 0.48 +
        Math.sin(this.elapsed * this.params.targetSpeed * 1.28) *
        this.height * 0.28;
    }

    this.solve(this.target.x, this.target.y);
  }

  render() {
    this.clear();
    this.ctx.strokeStyle = "#7ddfff";
    this.ctx.lineWidth = this.params.lineWidth;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(this.joints[0].x, this.joints[0].y);

    for (let index = 1; index < this.joints.length; index++) {
      this.ctx.lineTo(
        this.joints[index].x,
        this.joints[index].y
      );
    }

    this.ctx.stroke();

    this.ctx.fillStyle = "#effaff";
    for (const joint of this.joints) {
      this.ctx.beginPath();
      this.ctx.arc(joint.x, joint.y, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.strokeStyle = "#ffd45e";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(
      this.target.x,
      this.target.y,
      8,
      0,
      Math.PI * 2
    );
    this.ctx.stroke();
  }

  destroy() {
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    super.destroy();
  }
}


