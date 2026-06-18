import type {
  H264Profile,
  VideoEncoderCapability,
} from "../model/types.js";

export function recommendAvcLevel(
  width: number,
  height: number,
  frameRate: number,
): string {
  const pixelsPerSecond =
    width *
    height *
    frameRate;

  if (
    pixelsPerSecond <=
    1280 * 720 * 30
  ) {
    return "3.1";
  }

  if (
    pixelsPerSecond <=
    1920 * 1080 * 30
  ) {
    return "4.0";
  }

  if (
    pixelsPerSecond <=
    1920 * 1080 * 60
  ) {
    return "4.2";
  }

  if (
    pixelsPerSecond <=
    3840 * 2160 * 30
  ) {
    return "5.1";
  }

  return "5.2";
}

export function profileLabel(
  profile: H264Profile,
): "Baseline" | "Main" | "High" {
  switch (profile) {
    case "baseline":
      return "Baseline";
    case "main":
      return "Main";
    case "high":
      return "High";
  }
}

export function buildFallbackCodecString(
  profile: H264Profile,
  level: string,
): string {
  const profileHex:
    Record<H264Profile, string> = {
    baseline: "42E0",
    main: "4D00",
    high: "6400",
  };

  const levelMap:
    Record<string, string> = {
    "3.1": "1F",
    "4.0": "28",
    "4.1": "29",
    "4.2": "2A",
    "5.0": "32",
    "5.1": "33",
    "5.2": "34",
  };

  return `avc1.${profileHex[profile]}${
    levelMap[level] ??
    "2A"
  }`;
}

export async function checkH264Capability(
  config: VideoEncoderConfig,
): Promise<VideoEncoderCapability> {
  if (
    typeof VideoEncoder ===
    "undefined"
  ) {
    return {
      supported: false,
      codec: config.codec,
      reason:
        "VideoEncoder is unavailable.",
    };
  }

  try {
    const result =
      await VideoEncoder
        .isConfigSupported(
          config,
        );

    const supported =
      result.supported === true;

    return {
      supported,
      codec:
        result.config?.codec ??
        config.codec,
      reason:
        supported
          ? undefined
          : "The browser rejected the H.264 configuration.",
    };
  } catch (error) {
    return {
      supported: false,
      codec: config.codec,
      reason:
        error instanceof Error
          ? error.message
          : "H.264 capability check failed.",
    };
  }
}
