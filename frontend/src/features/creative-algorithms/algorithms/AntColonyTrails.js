import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "ant-colony-trails",
  name: "蚁群信息素轨迹",
  nameEN: "Ant Colony Trails",
  category: "simulator",
  preview: "/creative-algorithms/previews/ant-colony-trails.gif",
  tags: ["蚁群", "信息素", "路径", "群体智能"]
};

export default class AntColonyTrails extends BaseCanvasAlgorithm {
  static defaults = {
    count: 1800,
    resolution: 2,
    speed: 42,
    sensorDistance: 9,
    sensorAngle: 0.55,
    turnSpeed: 2.5,
    deposit: 0.28,
    decay: 0.972,
    foodSources: 4
  };

  reset() {
    const r = this.params.resolution;
    this.w = Math.max(32, Math.floor(this.width / r));
    this.h = Math.max(24, Math.floor(this.height / r));
    this.trail = new Float32Array(this.w * this.h);
    this.nextTrail = new Float32Array(this.w * this.h);
    this.ants = new Float32Array(this.params.count * 3);

    for (let index = 0; index < this.params.count; index++) {
      this.ants[index * 3] = Math.random() * this.w;
      this.ants[index * 3 + 1] = Math.random() * this.h;
      this.ants[index * 3 + 2] = Math.random() * Math.PI * 2;
    }

    this.food = Array.from(
      { length: this.params.foodSources },
      (_, index) => {
        const angle = index / this.params.foodSources * Math.PI * 2;
        return {
          x: this.w / 2 + Math.cos(angle) * this.w * 0.32,
          y: this.h / 2 + Math.sin(angle) * this.h * 0.3
        };
      }
    );

    this.buffer = document.createElement("canvas");
    this.buffer.width = this.w;
    this.buffer.height = this.h;
    this.bctx = this.buffer.getContext("2d");
  }

  onResize() {
    if (this.ants) this.reset();
  }

  onParamsChanged(next) {
    if (
      "count" in next ||
      "resolution" in next ||
      "foodSources" in next
    ) this.reset();
  }

  sample(x, y) {
    const ix = ((Math.floor(x) % this.w) + this.w) % this.w;
    const iy = ((Math.floor(y) % this.h) + this.h) % this.h;
    return this.trail[iy * this.w + ix];
  }

  foodBias(x, y) {
    let nearest = Infinity;

    for (const source of this.food) {
      nearest = Math.min(nearest, Math.hypot(x - source.x, y - source.y));
    }

    return Math.max(0, 12 - nearest) * 0.02;
  }

  update(dt) {
    const P = this.params;
    const scaledSpeed = P.speed / P.resolution;

    for (let index = 0; index < P.count; index++) {
      const offset = index * 3;
      let x = this.ants[offset];
      let y = this.ants[offset + 1];
      let angle = this.ants[offset + 2];

      const sense = (angleOffset) => {
        const sx = x + Math.cos(angle + angleOffset) * P.sensorDistance;
        const sy = y + Math.sin(angle + angleOffset) * P.sensorDistance;
        return this.sample(sx, sy) + this.foodBias(sx, sy);
      };

      const left = sense(-P.sensorAngle);
      const center = sense(0);
      const right = sense(P.sensorAngle);

      if (left > center && left > right) {
        angle -= P.turnSpeed * dt;
      } else if (right > center && right > left) {
        angle += P.turnSpeed * dt;
      } else {
        angle += (Math.random() - 0.5) * P.turnSpeed * 0.25 * dt;
      }

      x = (x + Math.cos(angle) * scaledSpeed * dt + this.w) % this.w;
      y = (y + Math.sin(angle) * scaledSpeed * dt + this.h) % this.h;

      this.ants[offset] = x;
      this.ants[offset + 1] = y;
      this.ants[offset + 2] = angle;

      const trailIndex = Math.floor(y) * this.w + Math.floor(x);
      this.trail[trailIndex] = Math.min(
        1,
        this.trail[trailIndex] + P.deposit
      );
    }

    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const index = y * this.w + x;
        const left = y * this.w + ((x - 1 + this.w) % this.w);
        const right = y * this.w + ((x + 1) % this.w);
        const up = ((y - 1 + this.h) % this.h) * this.w + x;
        const down = ((y + 1) % this.h) * this.w + x;

        this.nextTrail[index] = (
          this.trail[index] * 0.52 +
          this.trail[left] * 0.12 +
          this.trail[right] * 0.12 +
          this.trail[up] * 0.12 +
          this.trail[down] * 0.12
        ) * P.decay;
      }
    }

    [this.trail, this.nextTrail] = [this.nextTrail, this.trail];
  }

  render() {
    const image = this.bctx.createImageData(this.w, this.h);

    for (let index = 0; index < this.trail.length; index++) {
      const value = Math.min(1, this.trail[index]);
      const pixel = index * 4;
      image.data[pixel] = 10 + value * 55;
      image.data[pixel + 1] = 18 + value * 145;
      image.data[pixel + 2] = 35 + value * 210;
      image.data[pixel + 3] = 255;
    }

    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);

    this.ctx.fillStyle = "#ffd45e";
    for (const source of this.food) {
      this.ctx.beginPath();
      this.ctx.arc(
        source.x / this.w * this.width,
        source.y / this.h * this.height,
        5,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    }
  }
}

