import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "slime-mold",
  name: "黏菌网络",
  nameEN: "Slime Mold / Physarum",
  category: "simulator",
  preview: "/creative-algorithms/previews/slime-mold.gif",
  tags: ["黏菌", "网络", "群体", "涌现"]
};

export default class SlimeMold extends BaseCanvasAlgorithm {
  static defaults = {
    count: 5000,
    resolution: 3,
    moveSpeed: 34,
    sensorDistance: 9,
    sensorAngle: 0.55,
    turnSpeed: 2.8,
    deposit: 0.35,
    decay: 0.95,
    diffusion: 0.18
  };

  reset() {
    const r = this.params.resolution;
    this.w = Math.max(32, Math.floor(this.width / r));
    this.h = Math.max(24, Math.floor(this.height / r));
    this.trail = new Float32Array(this.w * this.h);
    this.nextTrail = new Float32Array(this.w * this.h);
    this.agents = new Float32Array(this.params.count * 3);

    for (let i = 0; i < this.params.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * Math.min(this.w, this.h) * 0.12;
      this.agents[i * 3] = this.w / 2 + Math.cos(angle) * radius;
      this.agents[i * 3 + 1] = this.h / 2 + Math.sin(angle) * radius;
      this.agents[i * 3 + 2] = angle;
    }

    this.buffer = document.createElement("canvas");
    this.buffer.width = this.w;
    this.buffer.height = this.h;
    this.bctx = this.buffer.getContext("2d");
  }

  onResize() {
    if (this.agents) this.reset();
  }

  onParamsChanged(next) {
    if ("count" in next || "resolution" in next) this.reset();
  }

  sample(x, y) {
    const ix = ((Math.floor(x) % this.w) + this.w) % this.w;
    const iy = ((Math.floor(y) % this.h) + this.h) % this.h;
    return this.trail[iy * this.w + ix];
  }

  update(dt) {
    const P = this.params;
    const speed = P.moveSpeed / P.resolution;

    for (let i = 0; i < P.count; i++) {
      const o = i * 3;
      let x = this.agents[o];
      let y = this.agents[o + 1];
      let angle = this.agents[o + 2];

      const sense = (offset) => this.sample(
        x + Math.cos(angle + offset) * P.sensorDistance,
        y + Math.sin(angle + offset) * P.sensorDistance
      );

      const center = sense(0);
      const left = sense(-P.sensorAngle);
      const right = sense(P.sensorAngle);

      if (left > center && left > right) angle -= P.turnSpeed * dt;
      else if (right > center && right > left) angle += P.turnSpeed * dt;
      else angle += (Math.random() - 0.5) * P.turnSpeed * 0.35 * dt;

      x = (x + Math.cos(angle) * speed * dt + this.w) % this.w;
      y = (y + Math.sin(angle) * speed * dt + this.h) % this.h;

      this.agents[o] = x;
      this.agents[o + 1] = y;
      this.agents[o + 2] = angle;

      const index = Math.floor(y) * this.w + Math.floor(x);
      this.trail[index] = Math.min(1, this.trail[index] + P.deposit);
    }

    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const left = y * this.w + ((x - 1 + this.w) % this.w);
        const right = y * this.w + ((x + 1) % this.w);
        const up = ((y - 1 + this.h) % this.h) * this.w + x;
        const down = ((y + 1) % this.h) * this.w + x;
        const average = (
          this.trail[i] +
          this.trail[left] +
          this.trail[right] +
          this.trail[up] +
          this.trail[down]
        ) / 5;

        this.nextTrail[i] = (
          this.trail[i] * (1 - P.diffusion) +
          average * P.diffusion
        ) * P.decay;
      }
    }

    [this.trail, this.nextTrail] = [this.nextTrail, this.trail];
  }

  render() {
    const image = this.bctx.createImageData(this.w, this.h);

    for (let i = 0; i < this.trail.length; i++) {
      const v = Math.min(1, this.trail[i]);
      const p = i * 4;
      image.data[p] = 18 + v * 55;
      image.data[p + 1] = 35 + v * 185;
      image.data[p + 2] = 65 + v * 185;
      image.data[p + 3] = 255;
    }

    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
  }
}


