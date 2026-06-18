import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "pixel-sorting",
  name: "像素排序",
  nameEN: "Pixel Sorting",
  category: "modifier",
  preview: "/creative-algorithms/previews/pixel-sorting.gif",
  tags: ["图像", "故障艺术", "排序", "视频"]
};

export default class PixelSorting extends BaseCanvasAlgorithm {
  static defaults = {
    resolution: 2,
    threshold: 125,
    thresholdRange: 70,
    animationSpeed: 0.8,
    direction: "horizontal",
    descending: false
  };

  reset() {
    this.source = document.createElement("canvas");
    this.sourceCtx = this.source.getContext("2d");
    this.buffer = document.createElement("canvas");
    this.bctx = this.buffer.getContext("2d");
    this.createFallbackSource();
  }

  onResize() {
    if (this.source) this.createFallbackSource();
  }

  onParamsChanged(next) {
    if ("resolution" in next) this.createFallbackSource();
  }

  setSourceImage(image) {
    const r = this.params.resolution;
    this.source.width = Math.max(1, Math.floor(this.width / r));
    this.source.height = Math.max(1, Math.floor(this.height / r));
    this.sourceCtx.drawImage(image, 0, 0, this.source.width, this.source.height);
  }

  createFallbackSource() {
    const r = this.params.resolution;
    const w = Math.max(1, Math.floor(this.width / r));
    const h = Math.max(1, Math.floor(this.height / r));
    this.source.width = w;
    this.source.height = h;

    const gradient = this.sourceCtx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#49247a");
    gradient.addColorStop(0.5, "#19b8d2");
    gradient.addColorStop(1, "#f2c34b");
    this.sourceCtx.fillStyle = gradient;
    this.sourceCtx.fillRect(0, 0, w, h);

    this.sourceCtx.fillStyle = "#f6d552";
    this.sourceCtx.beginPath();
    this.sourceCtx.arc(w * 0.32, h * 0.48, h * 0.28, 0, Math.PI * 2);
    this.sourceCtx.fill();

    this.sourceCtx.fillStyle = "#38d0ec";
    this.sourceCtx.fillRect(w * 0.58, h * 0.22, w * 0.28, h * 0.58);
  }

  luminance(data, index) {
    return data[index] * 0.2126 +
      data[index + 1] * 0.7152 +
      data[index + 2] * 0.0722;
  }

  sortSegment(pixels, indices, descending) {
    indices.sort((a, b) => {
      const la = this.luminance(pixels, a);
      const lb = this.luminance(pixels, b);
      return descending ? lb - la : la - lb;
    });

    return indices.map((index) => [
      pixels[index],
      pixels[index + 1],
      pixels[index + 2],
      pixels[index + 3]
    ]);
  }

  render() {
    const w = this.source.width;
    const h = this.source.height;
    this.buffer.width = w;
    this.buffer.height = h;
    this.bctx.drawImage(this.source, 0, 0);

    const image = this.bctx.getImageData(0, 0, w, h);
    const pixels = image.data;
    const threshold = this.params.threshold +
      Math.sin(this.elapsed * this.params.animationSpeed) *
      this.params.thresholdRange;

    const horizontal = this.params.direction === "horizontal";
    const outer = horizontal ? h : w;
    const inner = horizontal ? w : h;

    for (let a = 0; a < outer; a++) {
      let b = 0;

      while (b < inner) {
        const indexOf = (position) => horizontal
          ? (a * w + position) * 4
          : (position * w + a) * 4;

        if (this.luminance(pixels, indexOf(b)) <= threshold) {
          b++;
          continue;
        }

        const start = b;
        while (
          b < inner &&
          this.luminance(pixels, indexOf(b)) > threshold
        ) b++;

        const indices = [];
        for (let position = start; position < b; position++) {
          indices.push(indexOf(position));
        }

        const sorted = this.sortSegment(
          pixels,
          indices,
          this.params.descending
        );

        for (let position = start; position < b; position++) {
          const target = indexOf(position);
          const color = sorted[position - start];
          pixels[target] = color[0];
          pixels[target + 1] = color[1];
          pixels[target + 2] = color[2];
          pixels[target + 3] = color[3];
        }
      }
    }

    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
  }
}


