import { BaseCanvasAlgorithm } from "../core/BaseCanvasAlgorithm.js";

export const meta = {
  id: "delaunay",
  name: "Delaunay 三角剖分",
  nameEN: "Delaunay Triangulation",
  category: "generator",
  preview: "/creative-algorithms/previews/delaunay.gif",
  tags: ["三角网格", "低多边形", "几何", "点集"]
};

function circumcircle(a, b, c) {
  const d = 2 * (
    a.x * (b.y - c.y) +
    b.x * (c.y - a.y) +
    c.x * (a.y - b.y)
  );

  if (Math.abs(d) < 1e-8) return { x: 0, y: 0, r2: Infinity };

  const aa = a.x * a.x + a.y * a.y;
  const bb = b.x * b.x + b.y * b.y;
  const cc = c.x * c.x + c.y * c.y;

  const x = (
    aa * (b.y - c.y) +
    bb * (c.y - a.y) +
    cc * (a.y - b.y)
  ) / d;

  const y = (
    aa * (c.x - b.x) +
    bb * (a.x - c.x) +
    cc * (b.x - a.x)
  ) / d;

  return {
    x,
    y,
    r2: (x - a.x) ** 2 + (y - a.y) ** 2
  };
}

function triangulate(input) {
  if (input.length < 3) return [];

  const points = input.map((p) => ({ ...p }));
  const margin = 10000;
  const superA = { x: -margin, y: -margin };
  const superB = { x: margin * 2, y: -margin };
  const superC = { x: 0, y: margin * 2 };
  points.push(superA, superB, superC);

  const superStart = points.length - 3;
  let triangles = [{
    a: superStart,
    b: superStart + 1,
    c: superStart + 2,
    circle: circumcircle(superA, superB, superC)
  }];

  for (let pi = 0; pi < input.length; pi++) {
    const point = points[pi];
    const bad = triangles.filter((triangle) => {
      const dx = point.x - triangle.circle.x;
      const dy = point.y - triangle.circle.y;
      return dx * dx + dy * dy <= triangle.circle.r2;
    });

    const edgeCount = new Map();
    const addEdge = (u, v) => {
      const key = u < v ? `${u}:${v}` : `${v}:${u}`;
      const edge = edgeCount.get(key);
      if (edge) edge.count++;
      else edgeCount.set(key, { u, v, count: 1 });
    };

    for (const triangle of bad) {
      addEdge(triangle.a, triangle.b);
      addEdge(triangle.b, triangle.c);
      addEdge(triangle.c, triangle.a);
    }

    triangles = triangles.filter((triangle) => !bad.includes(triangle));

    for (const edge of edgeCount.values()) {
      if (edge.count !== 1) continue;
      triangles.push({
        a: edge.u,
        b: edge.v,
        c: pi,
        circle: circumcircle(points[edge.u], points[edge.v], point)
      });
    }
  }

  return triangles
    .filter((triangle) =>
      triangle.a < superStart &&
      triangle.b < superStart &&
      triangle.c < superStart
    )
    .map(({ a, b, c }) => [a, b, c]);
}

export default class DelaunayTriangulation extends BaseCanvasAlgorithm {
  static defaults = {
    points: 38,
    speed: 22,
    showPoints: true,
    lineWidth: 1
  };

  reset() {
    this.points = Array.from({ length: this.params.points }, (_, index) => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * this.params.speed,
      vy: (Math.random() - 0.5) * this.params.speed,
      hue: (index * 137.5) % 360
    }));
  }

  onParamsChanged(next) {
    if ("points" in next) this.reset();
  }

  update(dt) {
    for (const p of this.points) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0 || p.x > this.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.height) p.vy *= -1;
    }

    this.triangles = triangulate(this.points);
  }

  render() {
    this.clear();

    for (const triangle of this.triangles || []) {
      const [a, b, c] = triangle.map((i) => this.points[i]);
      const hue = (a.hue + b.hue + c.hue) / 3;
      this.ctx.fillStyle = `hsl(${hue} 48% 30%)`;
      this.ctx.strokeStyle = "rgba(165,220,245,.65)";
      this.ctx.lineWidth = this.params.lineWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(a.x, a.y);
      this.ctx.lineTo(b.x, b.y);
      this.ctx.lineTo(c.x, c.y);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    }

    if (this.params.showPoints) {
      this.ctx.fillStyle = "#ffffff";
      for (const p of this.points) {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
}


