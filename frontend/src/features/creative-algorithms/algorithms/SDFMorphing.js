import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "sdf-morphing",
  name: "SDF 形状融合",
  nameEN: "SDF Morphing",
  category: "modifier",
  preview: "/creative-algorithms/previews/sdf-morphing.gif",
  tags: ["SDF", "形态融合", "布尔运算", "Shader"]
};

function circleSDF(x, y, radius) {
  return Math.hypot(x, y) - radius;
}

function boxSDF(x, y, halfWidth, halfHeight) {
  const qx = Math.abs(x) - halfWidth;
  const qy = Math.abs(y) - halfHeight;
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0)
  );
}

function diamondSDF(x, y, radius) {
  return (Math.abs(x) + Math.abs(y)) * 0.7071 - radius;
}

export default class SDFMorphing extends BaseCanvasAlgorithm {
  static defaults = {
    shapeA: "circle",
    shapeB: "box",
    size: 72,
    blend: 0.5,
    animate: true,
    speed: 0.8,
    edgeWidth: 4,
    resolution: 2,
    operation: "morph"
  };

  reset() {
    this.buffer = document.createElement("canvas");
    this.bctx = this.buffer.getContext("2d");
  }

  evaluate(shape, x, y) {
    if (shape === "diamond") {
      return diamondSDF(x, y, this.params.size * 0.82);
    }

    if (shape === "box") {
      return boxSDF(
        x,
        y,
        this.params.size,
        this.params.size * 0.62
      );
    }

    return circleSDF(x, y, this.params.size);
  }

  combine(a, b, blend) {
    if (this.params.operation === "union") return Math.min(a, b);
    if (this.params.operation === "intersection") return Math.max(a, b);
    if (this.params.operation === "subtract") return Math.max(a, -b);
    return a * (1 - blend) + b * blend;
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
    const blend = P.animate
      ? (Math.sin(this.elapsed * P.speed) + 1) / 2
      : P.blend;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x * P.resolution - this.width / 2;
        const py = y * P.resolution - this.height / 2;
        const a = this.evaluate(P.shapeA, px + 22, py);
        const b = this.evaluate(P.shapeB, px - 22, py);
        const distance = this.combine(a, b, blend);
        const edge = Math.exp(
          -Math.abs(distance) / Math.max(0.1, P.edgeWidth)
        );

        const index = (y * w + x) * 4;
        const inside = distance < 0;
        image.data[index] = inside ? 30 : 8;
        image.data[index + 1] = inside ? 125 : 10;
        image.data[index + 2] = inside ? 180 : 16;

        image.data[index] = Math.max(
          image.data[index],
          edge * 255
        );

        image.data[index + 1] = Math.max(
          image.data[index + 1],
          edge * 210
        );

        image.data[index + 2] = Math.max(
          image.data[index + 2],
          edge * 135
        );

        image.data[index + 3] = 255;
      }
    }

    this.bctx.putImageData(image, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.buffer, 0, 0, this.width, this.height);
  }
}

