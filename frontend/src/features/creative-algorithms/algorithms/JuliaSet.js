import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "julia-set",
  name: "Julia 集",
  nameEN: "Julia Set",
  category: "generator",
  preview: "/creative-algorithms/previews/julia-set.gif",
  tags: ["分形", "复数", "数学艺术", "缩放"]
};

export default class JuliaSet extends BaseCanvasAlgorithm {
  static defaults = {
    cReal: -0.72,
    cImag: 0.1,
    animateC: true,
    animationRadius: 0.16,
    iterations: 64,
    zoom: 1,
    resolution: 3
  };

  reset() {
    this.buffer = document.createElement("canvas");
    this.bctx = this.buffer.getContext("2d");
  }

  render() {
    const P = this.params;
    const w = Math.ceil(this.width / P.resolution);
    const h = Math.ceil(this.height / P.resolution);

    if (this.buffer.width !== w || this.buffer.height !== h) {
      this.buffer.width = w;
      this.buffer.height = h;
    }

    let cr = P.cReal;
    let ci = P.cImag;

    if (P.animateC) {
      cr += Math.cos(this.elapsed * 0.35) * P.animationRadius;
      ci += Math.sin(this.elapsed * 0.35) * P.animationRadius;
    }

    const image = this.bctx.createImageData(w, h);

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        let x = ((px / w) * 3.2 - 1.6) / P.zoom;
        let y = ((py / h) * 2.0 - 1.0) / P.zoom;
        let iteration = 0;

        while (x * x + y * y <= 4 && iteration < P.iterations) {
          const nextX = x * x - y * y + cr;
          y = 2 * x * y + ci;
          x = nextX;
          iteration++;
        }

        const v = iteration / P.iterations;
        const i = (py * w + px) * 4;
        image.data[i] = 18 + Math.sin(v * Math.PI) * 185;
        image.data[i + 1] = 28 + v * 165;
        image.data[i + 2] = 75 + (1 - v) * 170;
        image.data[i + 3] = 255;
      }
    }

    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
  }
}


