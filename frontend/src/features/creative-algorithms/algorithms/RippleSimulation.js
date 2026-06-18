import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "ripple-simulation",
  name: "二维水波",
  nameEN: "Ripple Simulation",
  category: "simulator",
  preview: "/creative-algorithms/previews/ripple-simulation.gif",
  tags: ["水波", "波动方程", "点击交互", "扰动"]
};

export default class RippleSimulation extends BaseCanvasAlgorithm {
  static defaults = {
    resolution: 3,
    damping: 0.985,
    disturbance: 255,
    autoDrops: true,
    dropInterval: 0.8,
    dropRadius: 2
  };

  reset() {
    this.w = Math.max(24, Math.floor(this.width / this.params.resolution));
    this.h = Math.max(18, Math.floor(this.height / this.params.resolution));
    this.previous = new Float32Array(this.w * this.h);
    this.current = new Float32Array(this.w * this.h);
    this.next = new Float32Array(this.w * this.h);
    this.lastDrop = 0;

    this.buffer = document.createElement("canvas");
    this.buffer.width = this.w;
    this.buffer.height = this.h;
    this.bctx = this.buffer.getContext("2d");

    this.onPointerDown = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = Math.floor(
        (event.clientX - rect.left) / rect.width * this.w
      );
      const y = Math.floor(
        (event.clientY - rect.top) / rect.height * this.h
      );
      this.disturb(x, y);
    };

    this.canvas.addEventListener("pointerdown", this.onPointerDown);
  }

  onResize() {
    if (this.current) {
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.reset();
    }
  }

  onParamsChanged(next) {
    if ("resolution" in next) {
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.reset();
    }
  }

  disturb(cx, cy) {
    const radius = this.params.dropRadius;

    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        const px = cx + x;
        const py = cy + y;

        if (
          px > 0 && px < this.w - 1 &&
          py > 0 && py < this.h - 1
        ) {
          this.current[py * this.w + px] =
            this.params.disturbance;
        }
      }
    }
  }

  update() {
    if (
      this.params.autoDrops &&
      this.elapsed - this.lastDrop > this.params.dropInterval
    ) {
      this.lastDrop = this.elapsed;
      this.disturb(
        3 + Math.floor(Math.random() * (this.w - 6)),
        3 + Math.floor(Math.random() * (this.h - 6))
      );
    }

    for (let y = 1; y < this.h - 1; y++) {
      for (let x = 1; x < this.w - 1; x++) {
        const index = y * this.w + x;
        this.next[index] = (
          (
            this.previous[index - 1] +
            this.previous[index + 1] +
            this.previous[index - this.w] +
            this.previous[index + this.w]
          ) / 2 -
          this.current[index]
        ) * this.params.damping;
      }
    }

    [this.previous, this.current, this.next] = [
      this.current,
      this.next,
      this.previous
    ];
  }

  render() {
    const image = this.bctx.createImageData(this.w, this.h);

    for (let index = 0; index < this.current.length; index++) {
      const value = Math.max(
        -255,
        Math.min(255, this.current[index])
      );

      const pixel = index * 4;
      image.data[pixel] = 20 + Math.max(0, value + 80) * 0.55;
      image.data[pixel + 1] = 35 + Math.max(0, value + 100) * 0.72;
      image.data[pixel + 2] = 80 + Math.max(0, value + 160) * 0.55;
      image.data[pixel + 3] = 255;
    }

    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
  }

  destroy() {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    super.destroy();
  }
}

