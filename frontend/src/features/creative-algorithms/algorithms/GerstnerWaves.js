import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "gerstner-waves",
  name: "Gerstner 海浪",
  nameEN: "Gerstner Waves",
  category: "generator",
  preview: "/creative-algorithms/previews/gerstner-waves.gif",
  tags: ["海浪", "波面", "周期运动", "Three.js 纹理"]
};

export default class GerstnerWaves extends BaseCanvasAlgorithm {
  static defaults = {
    rows: 14,
    amplitude1: 9,
    wavelength1: 165,
    speed1: 1.1,
    amplitude2: 4,
    wavelength2: 76,
    speed2: -0.75,
    lineWidth: 1.7,
    horizontalStep: 4
  };

  wave(x, phase, amplitude, wavelength) {
    return amplitude * Math.sin(
      Math.PI * 2 * x / wavelength + phase
    );
  }

  render() {
    this.clear();
    const P = this.params;
    const spacing = this.height / (P.rows + 1);

    for (let row = 0; row < P.rows; row++) {
      const baseY = spacing * (row + 1);
      const phaseOffset = row * 0.27;
      this.ctx.strokeStyle =
        `hsla(${195 + row * 2} 75% ${55 + row * 1.1}% / .78)`;

      this.ctx.lineWidth = P.lineWidth;
      this.ctx.beginPath();

      for (
        let x = 0;
        x <= this.width + P.horizontalStep;
        x += P.horizontalStep
      ) {
        const y =
          baseY +
          this.wave(
            x,
            this.elapsed * P.speed1 + phaseOffset,
            P.amplitude1,
            P.wavelength1
          ) +
          this.wave(
            x,
            this.elapsed * P.speed2 - phaseOffset * 0.6,
            P.amplitude2,
            P.wavelength2
          );

        if (x === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }

      this.ctx.stroke();
    }
  }
}

