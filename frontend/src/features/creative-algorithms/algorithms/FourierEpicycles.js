import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "fourier-epicycles",
  name: "傅里叶旋转圆绘图",
  nameEN: "Fourier Epicycles",
  category: "generator",
  preview: "/creative-algorithms/previews/fourier-epicycles.gif",
  tags: ["傅里叶", "旋转圆", "路径重建", "数学艺术"]
};

function heartSignal(samples) {
  return Array.from({ length: samples }, (_, index) => {
    const t = index / samples * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);

    return { re: x, im: -y };
  });
}

function dft(signal) {
  const count = signal.length;
  const coefficients = [];

  for (let frequency = 0; frequency < count; frequency++) {
    let real = 0;
    let imaginary = 0;

    for (let index = 0; index < count; index++) {
      const angle = Math.PI * 2 * frequency * index / count;
      real += signal[index].re * Math.cos(angle) +
        signal[index].im * Math.sin(angle);
      imaginary += signal[index].im * Math.cos(angle) -
        signal[index].re * Math.sin(angle);
    }

    real /= count;
    imaginary /= count;

    coefficients.push({
      frequency,
      real,
      imaginary,
      amplitude: Math.hypot(real, imaginary),
      phase: Math.atan2(imaginary, real)
    });
  }

  return coefficients.sort((a, b) => b.amplitude - a.amplitude);
}

export default class FourierEpicycles extends BaseCanvasAlgorithm {
  static defaults = {
    harmonics: 22,
    samples: 96,
    speed: 0.45,
    scale: 4.2,
    traceLength: 900,
    circleOpacity: 0.24
  };

  reset() {
    this.time = 0;
    this.trace = [];
    this.coefficients = dft(heartSignal(this.params.samples));
  }

  onParamsChanged(next) {
    if ("samples" in next) this.reset();
  }

  update(dt) {
    this.time = (
      this.time +
      dt * this.params.speed * Math.PI * 2
    ) % (Math.PI * 2);
  }

  render() {
    this.clear();
    let x = this.width * 0.36;
    let y = this.height * 0.52;
    const count = Math.min(
      this.params.harmonics,
      this.coefficients.length
    );

    for (let index = 0; index < count; index++) {
      const coefficient = this.coefficients[index];
      const previousX = x;
      const previousY = y;
      const radius = coefficient.amplitude * this.params.scale;
      const angle =
        coefficient.frequency * this.time +
        coefficient.phase;

      x += Math.cos(angle) * radius;
      y += Math.sin(angle) * radius;

      this.ctx.strokeStyle =
        `rgba(95,150,185,${this.params.circleOpacity})`;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(previousX, previousY, radius, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.strokeStyle = "rgba(175,225,245,.65)";
      this.ctx.beginPath();
      this.ctx.moveTo(previousX, previousY);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
    }

    this.trace.unshift([x, y]);
    if (this.trace.length > this.params.traceLength) this.trace.pop();

    if (this.trace.length > 1) {
      this.ctx.strokeStyle = "#ff94d4";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(...this.trace[0]);

      for (let index = 1; index < this.trace.length; index++) {
        this.ctx.lineTo(...this.trace[index]);
      }

      this.ctx.stroke();
    }

    this.ctx.fillStyle = "#ffffff";
    this.ctx.beginPath();
    this.ctx.arc(x, y, 3, 0, Math.PI * 2);
    this.ctx.fill();
  }
}


