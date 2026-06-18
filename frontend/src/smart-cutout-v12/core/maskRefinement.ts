import type {
  AlphaMask,
  AlphaRefinement,
} from "../model/types.js";

export function refineAlphaMask(
  source: AlphaMask,
  options: AlphaRefinement,
): AlphaMask {
  let data =
    new Uint8ClampedArray(
      source.data,
    );

  if (
    options.threshold > 0
  ) {
    data = applyThreshold(
      data,
      options.threshold,
    );
  }

  if (
    options.dilateRadius > 0
  ) {
    data = morphMask(
      data,
      source.width,
      source.height,
      Math.round(
        options.dilateRadius,
      ),
      "dilate",
    );
  }

  if (
    options.erodeRadius > 0
  ) {
    data = morphMask(
      data,
      source.width,
      source.height,
      Math.round(
        options.erodeRadius,
      ),
      "erode",
    );
  }

  if (
    options.featherRadius > 0
  ) {
    data = boxBlurMask(
      data,
      source.width,
      source.height,
      Math.round(
        options.featherRadius,
      ),
    );
  }

  if (
    options.removeSmallRegions > 0
  ) {
    data = removeSmallRegions(
      data,
      source.width,
      source.height,
      Math.round(
        options.removeSmallRegions,
      ),
    );
  }

  if (options.invert) {
    for (
      let index = 0;
      index < data.length;
      index += 1
    ) {
      data[index] =
        255 - data[index];
    }
  }

  return {
    width: source.width,
    height: source.height,
    data,
  };
}

export function applyThreshold(
  data: Uint8ClampedArray,
  threshold01: number,
): Uint8ClampedArray {
  const threshold =
    Math.max(
      0,
      Math.min(
        1,
        threshold01,
      ),
    ) * 255;

  const output =
    new Uint8ClampedArray(
      data.length,
    );

  for (
    let index = 0;
    index < data.length;
    index += 1
  ) {
    output[index] =
      data[index] >= threshold
        ? 255
        : 0;
  }

  return output;
}

export function morphMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  mode: "dilate" | "erode",
): Uint8ClampedArray {
  if (radius <= 0) {
    return new Uint8ClampedArray(data);
  }

  const horizontal =
    new Uint8ClampedArray(
      data.length,
    );

  const output =
    new Uint8ClampedArray(
      data.length,
    );

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    for (
      let x = 0;
      x < width;
      x += 1
    ) {
      let value =
        mode === "dilate"
          ? 0
          : 255;

      for (
        let offset = -radius;
        offset <= radius;
        offset += 1
      ) {
        const sampleX =
          Math.max(
            0,
            Math.min(
              width - 1,
              x + offset,
            ),
          );

        const sample =
          data[
            y * width +
            sampleX
          ];

        value =
          mode === "dilate"
            ? Math.max(
                value,
                sample,
              )
            : Math.min(
                value,
                sample,
              );
      }

      horizontal[
        y * width + x
      ] = value;
    }
  }

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    for (
      let x = 0;
      x < width;
      x += 1
    ) {
      let value =
        mode === "dilate"
          ? 0
          : 255;

      for (
        let offset = -radius;
        offset <= radius;
        offset += 1
      ) {
        const sampleY =
          Math.max(
            0,
            Math.min(
              height - 1,
              y + offset,
            ),
          );

        const sample =
          horizontal[
            sampleY * width +
            x
          ];

        value =
          mode === "dilate"
            ? Math.max(
                value,
                sample,
              )
            : Math.min(
                value,
                sample,
              );
      }

      output[
        y * width + x
      ] = value;
    }
  }

  return output;
}

export function boxBlurMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  if (radius <= 0) {
    return new Uint8ClampedArray(data);
  }

  const horizontal =
    new Float32Array(
      data.length,
    );

  const output =
    new Uint8ClampedArray(
      data.length,
    );

  const size =
    radius * 2 + 1;

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    let sum = 0;

    for (
      let offset = -radius;
      offset <= radius;
      offset += 1
    ) {
      const x =
        Math.max(
          0,
          Math.min(
            width - 1,
            offset,
          ),
        );

      sum +=
        data[
          y * width + x
        ];
    }

    for (
      let x = 0;
      x < width;
      x += 1
    ) {
      horizontal[
        y * width + x
      ] = sum / size;

      const removeX =
        Math.max(
          0,
          x - radius,
        );

      const addX =
        Math.min(
          width - 1,
          x + radius + 1,
        );

      sum -=
        data[
          y * width +
          removeX
        ];

      sum +=
        data[
          y * width +
          addX
        ];
    }
  }

  for (
    let x = 0;
    x < width;
    x += 1
  ) {
    let sum = 0;

    for (
      let offset = -radius;
      offset <= radius;
      offset += 1
    ) {
      const y =
        Math.max(
          0,
          Math.min(
            height - 1,
            offset,
          ),
        );

      sum +=
        horizontal[
          y * width + x
        ];
    }

    for (
      let y = 0;
      y < height;
      y += 1
    ) {
      output[
        y * width + x
      ] = Math.round(
        sum / size,
      );

      const removeY =
        Math.max(
          0,
          y - radius,
        );

      const addY =
        Math.min(
          height - 1,
          y + radius + 1,
        );

      sum -=
        horizontal[
          removeY * width +
          x
        ];

      sum +=
        horizontal[
          addY * width +
          x
        ];
    }
  }

  return output;
}

export function removeSmallRegions(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  minimumPixels: number,
): Uint8ClampedArray {
  if (minimumPixels <= 0) {
    return new Uint8ClampedArray(data);
  }

  const output =
    new Uint8ClampedArray(data);

  const visited =
    new Uint8Array(data.length);

  const queue =
    new Int32Array(data.length);

  for (
    let start = 0;
    start < data.length;
    start += 1
  ) {
    if (
      visited[start] ||
      data[start] === 0
    ) {
      continue;
    }

    let head = 0;
    let tail = 0;

    queue[tail++] = start;
    visited[start] = 1;

    const region: number[] = [];

    while (head < tail) {
      const index =
        queue[head++];

      region.push(index);

      const x =
        index % width;

      const y =
        Math.floor(
          index / width,
        );

      const neighbors = [
        x > 0
          ? index - 1
          : -1,
        x < width - 1
          ? index + 1
          : -1,
        y > 0
          ? index - width
          : -1,
        y < height - 1
          ? index + width
          : -1,
      ];

      for (
        const neighbor of
        neighbors
      ) {
        if (
          neighbor < 0 ||
          visited[neighbor] ||
          data[neighbor] === 0
        ) {
          continue;
        }

        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }

    if (
      region.length <
      minimumPixels
    ) {
      for (
        const index of
        region
      ) {
        output[index] = 0;
      }
    }
  }

  return output;
}

export function maskBounds(
  mask: AlphaMask,
  threshold = 8,
): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;

  for (
    let y = 0;
    y < mask.height;
    y += 1
  ) {
    for (
      let x = 0;
      x < mask.width;
      x += 1
    ) {
      if (
        mask.data[
          y * mask.width + x
        ] < threshold
      ) {
        continue;
      }

      minX = Math.min(
        minX,
        x,
      );

      minY = Math.min(
        minY,
        y,
      );

      maxX = Math.max(
        maxX,
        x,
      );

      maxY = Math.max(
        maxY,
        y,
      );
    }
  }

  if (maxX < minX) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width:
      maxX - minX + 1,
    height:
      maxY - minY + 1,
  };
}
