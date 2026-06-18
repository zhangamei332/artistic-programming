import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "floyd-steinberg-dithering",
  name: "Floyd–Steinberg 抖动",
  nameEN: "Floyd–Steinberg Dithering",
  category: "modifier",
  preview: "/creative-algorithms/previews/floyd-steinberg-dithering.gif",
  tags: ["图像", "抖动", "像素", "误差扩散"]
};

export default class FloydSteinbergDithering extends BaseCanvasAlgorithm {
  static defaults = {
    resolution: 2,
    levels: 2,
    animateLevels: true,
    animationSpeed: 0.6,
    colorMode: "grayscale"
  };

  reset() {
    this.source = document.createElement("canvas");
    this.sourceCtx = this.source.getContext("2d", {
      willReadFrequently: true
    });

    this.buffer = document.createElement("canvas");
    this.bctx = this.buffer.getContext("2d", {
      willReadFrequently: true
    });

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
    this.sourceCtx.drawImage(
      image,
      0,
      0,
      this.source.width,
      this.source.height
    );
  }

  createFallbackSource() {
    const r = this.params.resolution;
    const w = Math.max(1, Math.floor(this.width / r));
    const h = Math.max(1, Math.floor(this.height / r));
    this.source.width = w;
    this.source.height = h;

    const gradient = this.sourceCtx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#4e267a");
    gradient.addColorStop(0.5, "#18bad4");
    gradient.addColorStop(1, "#f2c44c");
    this.sourceCtx.fillStyle = gradient;
    this.sourceCtx.fillRect(0, 0, w, h);

    this.sourceCtx.fillStyle = "#f5d14f";
    this.sourceCtx.beginPath();
    this.sourceCtx.arc(w * 0.31, h * 0.49, h * 0.28, 0, Math.PI * 2);
    this.sourceCtx.fill();

    this.sourceCtx.fillStyle = "#32cae8";
    this.sourceCtx.fillRect(
      w * 0.59,
      h * 0.22,
      w * 0.27,
      h * 0.58
    );
  }

  quantize(value, levels) {
    return Math.round(value / 255 * (levels - 1)) *
      255 / (levels - 1);
  }

  diffuse(channel, w, h, levels) {
    for (let y = 0; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const index = y * w + x;
        const oldValue = channel[index];
        const newValue = this.quantize(oldValue, levels);
        const error = oldValue - newValue;
        channel[index] = newValue;
        channel[index + 1] += error * 7 / 16;
        channel[index + w - 1] += error * 3 / 16;
        channel[index + w] += error * 5 / 16;
        channel[index + w + 1] += error * 1 / 16;
      }
    }
  }

  render() {
    const w = this.source.width;
    const h = this.source.height;
    this.buffer.width = w;
    this.buffer.height = h;
    this.bctx.drawImage(this.source, 0, 0);

    const image = this.bctx.getImageData(0, 0, w, h);
    const pixels = image.data;
    const levels = this.params.animateLevels
      ? Math.max(
          2,
          Math.round(
            this.params.levels +
            (Math.sin(this.elapsed * this.params.animationSpeed) + 1) * 1.5
          )
        )
      : this.params.levels;

    if (this.params.colorMode === "rgb") {
      for (let channelIndex = 0; channelIndex < 3; channelIndex++) {
        const channel = new Float32Array(w * h);

        for (let index = 0; index < channel.length; index++) {
          channel[index] = pixels[index * 4 + channelIndex];
        }

        this.diffuse(channel, w, h, levels);

        for (let index = 0; index < channel.length; index++) {
          pixels[index * 4 + channelIndex] =
            Math.max(0, Math.min(255, channel[index]));
        }
      }
    } else {
      const gray = new Float32Array(w * h);

      for (let index = 0; index < gray.length; index++) {
        const pixel = index * 4;
        gray[index] =
          pixels[pixel] * 0.2126 +
          pixels[pixel + 1] * 0.7152 +
          pixels[pixel + 2] * 0.0722;
      }

      this.diffuse(gray, w, h, levels);

      for (let index = 0; index < gray.length; index++) {
        const value = Math.max(0, Math.min(255, gray[index]));
        const pixel = index * 4;
        pixels[pixel] = value;
        pixels[pixel + 1] = value;
        pixels[pixel + 2] = value;
      }
    }

    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
  }
}

