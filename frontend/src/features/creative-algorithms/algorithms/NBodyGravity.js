import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "n-body-gravity",
  name: "N 体引力",
  nameEN: "N-body Gravity",
  category: "simulator",
  preview: "/creative-algorithms/previews/n-body-gravity.gif",
  tags: ["引力", "轨道", "星系", "粒子"]
};

export default class NBodyGravity extends BaseCanvasAlgorithm {
  static defaults = {
    count: 90,
    gravity: 48,
    softening: 32,
    damping: 0.999,
    maxSpeed: 150,
    centralMass: 24,
    trails: 0.08
  };

  reset() {
    this.bodies = Array.from({ length: this.params.count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) *
        Math.min(this.width, this.height) * 0.38;
      const x = this.width / 2 + Math.cos(angle) * radius;
      const y = this.height / 2 + Math.sin(angle) * radius;
      const orbitSpeed = 20 + Math.sqrt(
        this.params.centralMass * this.params.gravity /
        Math.max(20, radius)
      ) * 6;

      return {
        x,
        y,
        vx: -Math.sin(angle) * orbitSpeed,
        vy: Math.cos(angle) * orbitSpeed,
        mass: 0.5 + Math.random() * 2.5
      };
    });

    this.clear();
  }

  onParamsChanged(next) {
    if ("count" in next || "centralMass" in next) this.reset();
  }

  update(dt) {
    const accelerations = this.bodies.map(() => ({ x: 0, y: 0 }));
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      let dx = centerX - body.x;
      let dy = centerY - body.y;
      let distanceSquared =
        dx * dx + dy * dy + this.params.softening;

      let inverseDistance = 1 / Math.sqrt(distanceSquared);
      let acceleration =
        this.params.gravity *
        this.params.centralMass /
        distanceSquared;

      accelerations[i].x += dx * inverseDistance * acceleration;
      accelerations[i].y += dy * inverseDistance * acceleration;

      for (let j = i + 1; j < this.bodies.length; j++) {
        const other = this.bodies[j];
        dx = other.x - body.x;
        dy = other.y - body.y;
        distanceSquared =
          dx * dx + dy * dy + this.params.softening;
        inverseDistance = 1 / Math.sqrt(distanceSquared);
        const baseForce = this.params.gravity / distanceSquared;

        accelerations[i].x +=
          dx * inverseDistance * baseForce * other.mass;
        accelerations[i].y +=
          dy * inverseDistance * baseForce * other.mass;

        accelerations[j].x -=
          dx * inverseDistance * baseForce * body.mass;
        accelerations[j].y -=
          dy * inverseDistance * baseForce * body.mass;
      }
    }

    for (let i = 0; i < this.bodies.length; i++) {
      const body = this.bodies[i];
      body.vx =
        (body.vx + accelerations[i].x * dt) *
        this.params.damping;

      body.vy =
        (body.vy + accelerations[i].y * dt) *
        this.params.damping;

      const speed = Math.hypot(body.vx, body.vy) || 1;

      if (speed > this.params.maxSpeed) {
        body.vx = body.vx / speed * this.params.maxSpeed;
        body.vy = body.vy / speed * this.params.maxSpeed;
      }

      body.x += body.vx * dt;
      body.y += body.vy * dt;
    }
  }

  render() {
    this.ctx.fillStyle = `rgba(8,10,16,${this.params.trails})`;
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.fillStyle = "#ffd45e";
    this.ctx.beginPath();
    this.ctx.arc(
      this.width / 2,
      this.height / 2,
      5 + Math.sqrt(this.params.centralMass),
      0,
      Math.PI * 2
    );
    this.ctx.fill();

    for (const body of this.bodies) {
      this.ctx.fillStyle = "#82d2ff";
      this.ctx.beginPath();
      this.ctx.arc(
        body.x,
        body.y,
        1.5 + body.mass,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    }
  }
}

