import { describe, expect, test } from "bun:test";

import {
  CortexSidecarTimeoutError,
  isCortexSidecarTimeout,
  withCortexSidecarTimeout,
} from "./sidecar-timeout";

describe("withCortexSidecarTimeout", () => {
  test("rejects with a sidecar timeout without cancelling the original work", async () => {
    let timedOut = false;
    let settled = false;
    const work = new Promise<string>((resolve) => {
      setTimeout(() => {
        settled = true;
        resolve("late");
      }, 20);
    });

    await expect(
      withCortexSidecarTimeout(work, 1, () => {
        timedOut = true;
      }),
    ).rejects.toBeInstanceOf(CortexSidecarTimeoutError);

    expect(timedOut).toBe(true);
    expect(settled).toBe(false);
    expect(isCortexSidecarTimeout(new CortexSidecarTimeoutError(1))).toBe(true);
    expect(await work).toBe("late");
    expect(settled).toBe(true);
  });
});
