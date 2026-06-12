export class CortexSidecarTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Cortex sidecar call timed out after ${timeoutMs}ms`);
    this.name = "CortexSidecarTimeoutError";
  }
}

export function isCortexSidecarTimeout(err: unknown): err is CortexSidecarTimeoutError {
  return err instanceof CortexSidecarTimeoutError;
}

export async function withCortexSidecarTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return work;

  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((_resolve, reject) => {
    timer = setTimeout(() => {
      if (settled) return;
      onTimeout();
      reject(new CortexSidecarTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    settled = true;
    if (timer) clearTimeout(timer);
  }
}
