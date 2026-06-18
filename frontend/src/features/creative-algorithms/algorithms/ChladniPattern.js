import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "chladni-pattern",
  name: "克拉尼振型",
  nameEN: "Chladni Pattern",
  category: "generator",
  preview: "/creative-algorithms/previews/chladni-pattern.gif",
  tags: ["声学", "振动", "节点线", "数学图案"]
};

export default class ChladniPattern extends BaseCanvasAlgorithm {
  static defaults = {
    modeM: 3,
    modeN: 5,
    threshold: 0.075,
    animate: true,
    speed: 0.35,
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

    const image = this.bctx.createImageData(w, h);
    const phase = P.animate
      ? Math.sin(this.elapsed * P.speed) * 0.65
      : 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = x / (w - 1) * 2 - 1;
        const ny = y / (h - 1) * 2 - 1;

        const value =
          Math.sin(P.modeM * Math.PI * nx + phase) *
          Math.sin(P.modeN * Math.PI * ny) -
          Math.sin(P.modeN * Math.PI * nx) *
          Math.sin(P.modeM * Math.PI * ny - phase);

        const intensity = Math.exp(
          -Math.abs(value) / Math.max(0.001, P.threshold)
        );

        const index = (y * w + x) * 4;
        image.data[index] = 12 + intensity * 220;
        image.data[index + 1] = 20 + intensity * 185;
        image.data[index + 2] = 42 + intensity * 135;
        image.data[index + 3] = 255;
      }
    }

    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
  }
}


