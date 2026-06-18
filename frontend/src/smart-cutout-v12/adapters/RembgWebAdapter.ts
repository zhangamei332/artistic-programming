import type {
  CutoutModel,
  CutoutProgress,
} from "../model/types.js";

export interface BackgroundRemovalRequest {
  input: Blob | File | ArrayBuffer | HTMLImageElement | HTMLCanvasElement;
  model: CutoutModel;
  modelBaseUrl: string;
  preferWebNN: boolean;
  preferWebGPU: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: CutoutProgress) => void;
}

export interface BackgroundRemovalEngine {
  removeBackground(
    request: BackgroundRemovalRequest,
  ): Promise<Blob>;
  clearModelCache(): Promise<void>;
  dispose(): Promise<void>;
}

type RembgModule = {
  remove: (
    input: BackgroundRemovalRequest["input"],
    options?: Record<string, unknown>,
  ) => Promise<Blob>;
  newSession?: (
    model: string,
    config?: Record<string, unknown>,
    execution?: Record<string, unknown>,
  ) => unknown;
  rembgConfig?: {
    setBaseUrl?(url: string): void;
    setCustomModelPath?(
      model: string,
      path: string,
    ): void;
  };
  clearModelCache?: () => Promise<void>;
  disposeAllSessions?: () => Promise<void> | void;
};

export class RembgWebAdapter
  implements BackgroundRemovalEngine {
  private modulePromise?: Promise<RembgModule>;
  private sessions =
    new Map<string, unknown>();

  public async removeBackground(
    request: BackgroundRemovalRequest,
  ): Promise<Blob> {
    throwIfAborted(
      request.signal,
    );

    request.onProgress?.({
      stage: "loading-model",
      progress: 0.05,
      message:
        `Loading ${request.model}`,
    });

    const module =
      await this.loadModule();

    if (
      request.modelBaseUrl &&
      module.rembgConfig
        ?.setBaseUrl
    ) {
      module.rembgConfig.setBaseUrl(
        request.modelBaseUrl,
      );
    }

    const session =
      this.getOrCreateSession(
        module,
        request,
      );

    throwIfAborted(
      request.signal,
    );

    request.onProgress?.({
      stage: "inference",
      progress: 0.2,
      message:
        "Removing background",
    });

    const result =
      await module.remove(
        request.input,
        {
          session,
          signal:
            request.signal,
          onProgress: (
            key: string,
            current: number,
            total: number,
          ) => {
            const ratio =
              total > 0
                ? current / total
                : 0;

            request.onProgress?.({
              stage: "inference",
              progress:
                0.2 +
                ratio * 0.7,
              message:
                `${key}: ${current}/${total}`,
            });
          },
        },
      );

    throwIfAborted(
      request.signal,
    );

    request.onProgress?.({
      stage: "inference",
      progress: 0.95,
      message:
        "Background removed",
    });

    return result;
  }

  public async clearModelCache(): Promise<void> {
    const module =
      await this.loadModule();

    this.sessions.clear();

    await module.clearModelCache?.();
  }

  public async dispose(): Promise<void> {
    if (!this.modulePromise) {
      return;
    }

    const module =
      await this.modulePromise;

    this.sessions.clear();

    await module.disposeAllSessions?.();
  }

  private loadModule(): Promise<RembgModule> {
    this.modulePromise ??=
      import("@bunnio/rembg-web")
        .then(
          (module) =>
            module as unknown as
              RembgModule,
        );

    return this.modulePromise;
  }

  private getOrCreateSession(
    module: RembgModule,
    request: BackgroundRemovalRequest,
  ): unknown {
    if (!module.newSession) {
      return undefined;
    }

    const providerKey =
      [
        request.model,
        request.preferWebNN
          ? "webnn"
          : "no-webnn",
        request.preferWebGPU
          ? "webgpu"
          : "no-webgpu",
      ].join(":");

    const existing =
      this.sessions.get(
        providerKey,
      );

    if (existing) {
      return existing;
    }

    const session =
      module.newSession(
        request.model,
        undefined,
        {
          preferWebNN:
            request.preferWebNN,
          // Default V12 config keeps this false because
          // current model compatibility must be verified.
          preferWebGPU:
            request.preferWebGPU,
        },
      );

    this.sessions.set(
      providerKey,
      session,
    );

    return session;
  }
}

function throwIfAborted(
  signal: AbortSignal | undefined,
): void {
  if (signal?.aborted) {
    throw new DOMException(
      "Background removal was aborted.",
      "AbortError",
    );
  }
}
