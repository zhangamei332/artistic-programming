import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "mandelbrot-set",
  name: "曼德博集合",
  nameEN: "Mandelbrot Set",
  category: "generator",
  preview: "/creative-algorithms/previews/mandelbrot-set.gif",
  tags: ["分形", "复数", "数学艺术", "无限缩放"]
};

export default class MandelbrotSet extends BaseCanvasAlgorithm {
  static defaults = {
    centerX: -0.7435,
    centerY: 0.1314,
    zoom: 1.4,
    autoZoom: true,
    zoomSpeed: 0.08,
    iterations: 72,
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

    const zoom = P.zoom * (
      P.autoZoom ? 1 + (Math.sin(this.elapsed * P.zoomSpeed) * 0.5 + 0.5) * 2.2 : 1
    );

    const image = this.bctx.createImageData(w, h);

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const cx = P.centerX + ((px / w) * 3.4 - 1.7) / zoom;
        const cy = P.centerY + ((py / h) * 2.0 - 1.0) / zoom;
        let x = 0;
        let y = 0;
        let iteration = 0;

        while (x * x + y * y <= 4 && iteration < P.iterations) {
          const nextX = x * x - y * y + cx;
          y = 2 * x * y + cy;
          x = nextX;
          iteration++;
        }

        const i = (py * w + px) * 4;

        if (iteration === P.iterations) {
          image.data[i] = 5;
          image.data[i + 1] = 7;
          image.data[i + 2] = 12;
        } else {
          const v = iteration / P.iterations;
          image.data[i] = 15 + v * 100;
          image.data[i + 1] = 25 + Math.sqrt(v) * 180;
          image.data[i + 2] = 70 + (1 - v) * 175;
        }

        image.data[i + 3] = 255;
      }
    }

    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
  }
}


