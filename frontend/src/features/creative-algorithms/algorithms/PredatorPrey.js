import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "predator-prey",
  name: "捕食者与猎物",
  nameEN: "Predator–Prey",
  category: "simulator",
  preview: "/creative-algorithms/previews/predator-prey.gif",
  tags: ["追逐", "逃避", "生态", "群体行为"]
};

export default class PredatorPrey extends BaseCanvasAlgorithm {
  static defaults = {
    preyCount: 120,
    predatorCount: 8,
    preySpeed: 82,
    predatorSpeed: 105,
    fleeRadius: 95,
    cohesion: 0.06,
    wander: 15
  };

  reset() {
    this.prey = Array.from({ length: this.params.preyCount }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 30,
      vy: (Math.random() - 0.5) * 30
    }));

    this.predators = Array.from(
      { length: this.params.predatorCount },
      () => ({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30
      })
    );
  }

  onParamsChanged(next) {
    if ("preyCount" in next || "predatorCount" in next) this.reset();
  }

  wrapDelta(dx, size) {
    if (dx > size / 2) return dx - size;
    if (dx < -size / 2) return dx + size;
    return dx;
  }

  limit(entity, speed) {
    const magnitude = Math.hypot(entity.vx, entity.vy) || 1;

    if (magnitude > speed) {
      entity.vx = entity.vx / magnitude * speed;
      entity.vy = entity.vy / magnitude * speed;
    }
  }

  update(dt) {
    const center = this.prey.reduce(
      (sum, prey) => ({
        x: sum.x + prey.x,
        y: sum.y + prey.y
      }),
      { x: 0, y: 0 }
    );

    center.x /= this.prey.length;
    center.y /= this.prey.length;

    for (const prey of this.prey) {
      let fleeX = 0;
      let fleeY = 0;

      for (const predator of this.predators) {
        const dx = this.wrapDelta(prey.x - predator.x, this.width);
        const dy = this.wrapDelta(prey.y - predator.y, this.height);
        const distance = Math.hypot(dx, dy) || 1;

        if (distance < this.params.fleeRadius) {
          fleeX += dx / (distance * distance);
          fleeY += dy / (distance * distance);
        }
      }

      prey.vx += (
        fleeX * 5400 +
        (center.x - prey.x) * this.params.cohesion +
        (Math.random() - 0.5) * this.params.wander
      ) * dt;

      prey.vy += (
        fleeY * 5400 +
        (center.y - prey.y) * this.params.cohesion +
        (Math.random() - 0.5) * this.params.wander
      ) * dt;

      this.limit(prey, this.params.preySpeed);
      prey.x = (prey.x + prey.vx * dt + this.width) % this.width;
      prey.y = (prey.y + prey.vy * dt + this.height) % this.height;
    }

    for (const predator of this.predators) {
      let target = this.prey[0];
      let nearest = Infinity;

      for (const prey of this.prey) {
        const dx = this.wrapDelta(prey.x - predator.x, this.width);
        const dy = this.wrapDelta(prey.y - predator.y, this.height);
        const distance = dx * dx + dy * dy;

        if (distance < nearest) {
          nearest = distance;
          target = prey;
        }
      }

      const dx = this.wrapDelta(target.x - predator.x, this.width);
      const dy = this.wrapDelta(target.y - predator.y, this.height);
      const length = Math.hypot(dx, dy) || 1;
      predator.vx += dx / length * 80 * dt;
      predator.vy += dy / length * 80 * dt;
      this.limit(predator, this.params.predatorSpeed);
      predator.x =
        (predator.x + predator.vx * dt + this.width) % this.width;
      predator.y =
        (predator.y + predator.vy * dt + this.height) % this.height;
    }
  }

  render() {
    this.clear();
    this.ctx.fillStyle = "#78ddff";

    for (const prey of this.prey) {
      this.ctx.beginPath();
      this.ctx.arc(prey.x, prey.y, 2.2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.fillStyle = "#ff6372";

    for (const predator of this.predators) {
      const angle = Math.atan2(predator.vy, predator.vx);
      this.ctx.beginPath();
      this.ctx.moveTo(
        predator.x + Math.cos(angle) * 7,
        predator.y + Math.sin(angle) * 7
      );
      this.ctx.lineTo(
        predator.x + Math.cos(angle + 2.5) * 5,
        predator.y + Math.sin(angle + 2.5) * 5
      );
      this.ctx.lineTo(
        predator.x + Math.cos(angle - 2.5) * 5,
        predator.y + Math.sin(angle - 2.5) * 5
      );
      this.ctx.closePath();
      this.ctx.fill();
    }
  }
}

