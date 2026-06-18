import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "steering-behaviors",
  name: "转向行为组合",
  nameEN: "Steering Behaviors",
  category: "simulator",
  preview: "/creative-algorithms/previews/steering-behaviors.gif",
  tags: ["Seek", "Arrive", "Avoid", "Agent"]
};

export default class SteeringBehaviors extends BaseCanvasAlgorithm {
  static defaults = {
    count: 90,
    maxSpeed: 115,
    maxForce: 120,
    arriveRadius: 90,
    obstacleRadius: 42,
    avoidStrength: 2.2,
    autoTarget: true
  };

  reset() {
    this.agents = Array.from({ length: this.params.count }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 25,
      vy: (Math.random() - 0.5) * 25
    }));

    this.target = {
      x: this.width * 0.75,
      y: this.height * 0.5,
      pointerActive: false
    };

    this.obstacle = {
      x: this.width * 0.5,
      y: this.height * 0.52
    };

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

  onParamsChanged(next) {
    if ("count" in next) {
      this.canvas.removeEventListener("pointermove", this.onPointerMove);
      this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
      this.reset();
    }
  }

  limit(x, y, maximum) {
    const length = Math.hypot(x, y) || 1;
    if (length <= maximum) return [x, y];
    return [x / length * maximum, y / length * maximum];
  }

  update(dt) {
    if (this.params.autoTarget && !this.target.pointerActive) {
      this.target.x =
        this.width / 2 +
        Math.cos(this.elapsed * 0.8) * this.width * 0.28;
      this.target.y =
        this.height / 2 +
        Math.sin(this.elapsed * 1.05) * this.height * 0.28;
    }

    for (const agent of this.agents) {
      let dx = this.target.x - agent.x;
      let dy = this.target.y - agent.y;
      const distance = Math.hypot(dx, dy) || 1;
      const targetSpeed = distance < this.params.arriveRadius
        ? this.params.maxSpeed * distance / this.params.arriveRadius
        : this.params.maxSpeed;

      let desiredX = dx / distance * targetSpeed;
      let desiredY = dy / distance * targetSpeed;

      const avoidX = agent.x - this.obstacle.x;
      const avoidY = agent.y - this.obstacle.y;
      const avoidDistance = Math.hypot(avoidX, avoidY) || 1;
      const avoidRange = this.params.obstacleRadius * 1.8;

      if (avoidDistance < avoidRange) {
        const strength =
          (1 - avoidDistance / avoidRange) *
          this.params.maxSpeed *
          this.params.avoidStrength;

        desiredX += avoidX / avoidDistance * strength;
        desiredY += avoidY / avoidDistance * strength;
      }

      let forceX = desiredX - agent.vx;
      let forceY = desiredY - agent.vy;
      [forceX, forceY] = this.limit(
        forceX,
        forceY,
        this.params.maxForce
      );

      agent.vx += forceX * dt;
      agent.vy += forceY * dt;
      [agent.vx, agent.vy] = this.limit(
        agent.vx,
        agent.vy,
        this.params.maxSpeed
      );

      agent.x = (agent.x + agent.vx * dt + this.width) % this.width;
      agent.y = (agent.y + agent.vy * dt + this.height) % this.height;
    }
  }

  render() {
    this.clear();

    this.ctx.strokeStyle = "#ff806c";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(
      this.obstacle.x,
      this.obstacle.y,
      this.params.obstacleRadius,
      0,
      Math.PI * 2
    );
    this.ctx.stroke();

    this.ctx.strokeStyle = "#ffd45e";
    this.ctx.beginPath();
    this.ctx.arc(
      this.target.x,
      this.target.y,
      7,
      0,
      Math.PI * 2
    );
    this.ctx.stroke();

    this.ctx.fillStyle = "#7cddff";

    for (const agent of this.agents) {
      const angle = Math.atan2(agent.vy, agent.vx);
      this.ctx.beginPath();
      this.ctx.moveTo(
        agent.x + Math.cos(angle) * 5,
        agent.y + Math.sin(angle) * 5
      );
      this.ctx.lineTo(
        agent.x + Math.cos(angle + 2.5) * 4,
        agent.y + Math.sin(angle + 2.5) * 4
      );
      this.ctx.lineTo(
        agent.x + Math.cos(angle - 2.5) * 4,
        agent.y + Math.sin(angle - 2.5) * 4
      );
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  destroy() {
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    super.destroy();
  }
}

