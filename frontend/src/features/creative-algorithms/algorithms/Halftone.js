import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "halftone",
  name: "半色调网点",
  nameEN: "Halftone",
  category: "modifier",
  preview: "/creative-algorithms/previews/halftone.gif",
  tags: ["印刷", "网点", "图像", "海报"]
};

export default class Halftone extends BaseCanvasAlgorithm {
  static defaults = {
    cellSize: 10,
    animateCellSize: true,
    animationRange: 4,
    animationSpeed: 0.8,
    dotScale: 1,
    invert: false,
    background: "#f5f5f0",
    foreground: "#0a0c12"
  };

  reset() {
    this.source = document.createElement("canvas");
    this.sourceCtx = this.source.getContext("2d", {
      willReadFrequently: true
    });

    this.createFallbackSource();
  }

  onResize() {
    if (this.source) this.createFallbackSource();
  }

  setSourceImage(image) {
    this.source.width = Math.max(1, Math.floor(this.width));
    this.source.height = Math.max(1, Math.floor(this.height));
    this.sourceCtx.drawImage(
      image,
      0,
      0,
      this.source.width,
      this.source.height
    );
  }

  createFallbackSource() {
    const w = Math.max(1, Math.floor(this.width));
    const h = Math.max(1, Math.floor(this.height));
    this.source.width = w;
    this.source.height = h;

    const gradient = this.sourceCtx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#4d257b");
    gradient.addColorStop(0.5, "#1ab6d2");
    gradient.addColorStop(1, "#f0c54d");
    this.sourceCtx.fillStyle = gradient;
    this.sourceCtx.fillRect(0, 0, w, h);

    this.sourceCtx.fillStyle = "#f5d24d";
    this.sourceCtx.beginPath();
    this.sourceCtx.arc(w * 0.31, h * 0.49, h * 0.28, 0, Math.PI * 2);
    this.sourceCtx.fill();

    this.sourceCtx.fillStyle = "#32cce9";
    this.sourceCtx.fillRect(
      w * 0.59,
      h * 0.22,
      w * 0.27,
      h * 0.58
    );
  }

  render() {
    this.ctx.fillStyle = this.params.background;
    this.ctx.fillRect(0, 0, this.width, this.height);

    const cellSize = Math.max(
      3,
      this.params.cellSize +
      (
        this.params.animateCellSize
          ? Math.sin(this.elapsed * this.params.animationSpeed) *
            this.params.animationRange
          : 0
      )
    );

    const image = this.sourceCtx.getImageData(
      0,
      0,
      this.source.width,
      this.source.height
    );

    this.ctx.fillStyle = this.params.foreground;

    for (let y = 0; y < this.height; y += cellSize) {
      for (let x = 0; x < this.width; x += cellSize) {
        const sampleX = Math.min(
          this.source.width - 1,
          Math.floor(x + cellSize / 2)
        );

        const sampleY = Math.min(
          this.source.height - 1,
          Math.floor(y + cellSize / 2)
        );

        const pixel = (sampleY * this.source.width + sampleX) * 4;
        let luminance = (
          image.data[pixel] * 0.2126 +
          image.data[pixel + 1] * 0.7152 +
          image.data[pixel + 2] * 0.0722
        ) / 255;

        if (this.params.invert) luminance = 1 - luminance;
        const radius =
          (1 - luminance) *
          cellSize *
          0.55 *
          this.params.dotScale;

        this.ctx.beginPath();
        this.ctx.arc(
          x + cellSize / 2,
          y + cellSize / 2,
          Math.max(0, radius),
          0,
          Math.PI * 2
        );
        this.ctx.fill();
      }
    }
  }
}

