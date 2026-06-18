import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "space-colonization-tree",
  name: "空间殖民树",
  nameEN: "Space Colonization Tree",
  category: "simulator",
  preview: "/creative-algorithms/previews/space-colonization-tree.gif",
  tags: ["树木", "血管", "道路", "有机生长"]
};

export default class SpaceColonizationTree extends BaseCanvasAlgorithm {
  static defaults = {
    attractors: 420,
    influenceRadius: 58,
    killRadius: 9,
    stepLength: 5,
    growthStepsPerSecond: 26,
    canopyWidth: 0.72,
    canopyHeight: 0.58,
    branchWidth: 1.7
  };

  reset() {
    this.nodes = [{
      x: this.width / 2,
      y: this.height - 8,
      parent: -1
    }];

    this.attractors = Array.from(
      { length: this.params.attractors },
      () => ({
        x: this.width / 2 +
          (Math.random() - 0.5) *
          this.width *
          this.params.canopyWidth,

        y: 10 +
          Math.random() *
          this.height *
          this.params.canopyHeight
      })
    );

    this.accumulator = 0;
    this.finished = false;
  }

  onResize() {
    if (this.nodes) this.reset();
  }

  onParamsChanged(next) {
    if (
      "attractors" in next ||
      "canopyWidth" in next ||
      "canopyHeight" in next
    ) this.reset();
  }

  growOneStep() {
    if (!this.attractors.length) {
      this.finished = true;
      return;
    }

    const directions = this.nodes.map(() => ({ x: 0, y: 0, count: 0 }));
    const remaining = [];

    for (const attractor of this.attractors) {
      let nearestIndex = -1;
      let nearestDistance = Infinity;

      for (let index = 0; index < this.nodes.length; index++) {
        const node = this.nodes[index];
        const distance = Math.hypot(
          attractor.x - node.x,
          attractor.y - node.y
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      }

      if (nearestDistance < this.params.killRadius) continue;
      remaining.push(attractor);

      if (nearestDistance <= this.params.influenceRadius) {
        const node = this.nodes[nearestIndex];
        const dx = attractor.x - node.x;
        const dy = attractor.y - node.y;
        const length = Math.hypot(dx, dy) || 1;
        directions[nearestIndex].x += dx / length;
        directions[nearestIndex].y += dy / length;
        directions[nearestIndex].count++;
      }
    }

    this.attractors = remaining;
    const additions = [];

    for (let index = 0; index < directions.length; index++) {
      const direction = directions[index];
      if (!direction.count) continue;

      let dx = direction.x / direction.count;
      let dy = direction.y / direction.count;
      const length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;

      additions.push({
        x: this.nodes[index].x + dx * this.params.stepLength,
        y: this.nodes[index].y + dy * this.params.stepLength,
        parent: index
      });
    }

    if (!additions.length) {
      const trunk = this.nodes[this.nodes.length - 1];
      additions.push({
        x: trunk.x,
        y: trunk.y - this.params.stepLength,
        parent: this.nodes.length - 1
      });
    }

    this.nodes.push(...additions);
  }

  update(dt) {
    if (this.finished) return;
    this.accumulator += dt;
    const interval = 1 / this.params.growthStepsPerSecond;

    while (this.accumulator >= interval) {
      this.accumulator -= interval;
      this.growOneStep();
    }
  }

  render() {
    this.clear();
    this.ctx.strokeStyle = "#6ed08f";
    this.ctx.lineWidth = this.params.branchWidth;
    this.ctx.lineCap = "round";

    for (let index = 1; index < this.nodes.length; index++) {
      const node = this.nodes[index];
      const parent = this.nodes[node.parent];
      this.ctx.beginPath();
      this.ctx.moveTo(parent.x, parent.y);
      this.ctx.lineTo(node.x, node.y);
      this.ctx.stroke();
    }

    this.ctx.fillStyle = "rgba(110,145,165,.45)";
    for (let index = 0; index < this.attractors.length; index += 5) {
      const attractor = this.attractors[index];
      this.ctx.fillRect(attractor.x, attractor.y, 1.5, 1.5);
    }
  }
}

