import { afterEach, describe, expect, test } from "bun:test";

import { cleanupStreamReader, fetchWithPreflightAbort } from "./stream-utils";

describe("fetchWithPreflightAbort", () => {
  test("aborts the provider request before response headers arrive", async () => {
    const originalFetch = globalThis.fetch;
    let fetchSignal: AbortSignal | undefined;

    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      fetchSignal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        fetchSignal?.addEventListener("abort", () => reject(fetchSignal?.reason), {
          once: true,
        });
      });
    }) as typeof fetch;

    try {
      const controller = new AbortController();
      const pending = fetchWithPreflightAbort(
        "https://provider.test/stream",
        {},
        controller.signal,
      );

      controller.abort(new DOMException("Stopped", "AbortError"));

      await expect(pending).rejects.toThrow("Stopped");
      expect(fetchSignal?.aborted).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("does not forward later aborts after response headers arrive", async () => {
    const originalFetch = globalThis.fetch;
    let fetchSignal: AbortSignal | undefined;

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      fetchSignal = init?.signal as AbortSignal | undefined;
      return new Response("ok");
    }) as typeof fetch;

    try {
      const controller = new AbortController();
      const response = await fetchWithPreflightAbort(
        "https://provider.test/stream",
        {},
        controller.signal,
      );

      controller.abort(new DOMException("Stopped", "AbortError"));

      expect(fetchSignal?.aborted).toBe(false);
      expect(await response.text()).toBe("ok");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("cleanupStreamReader", () => {
  test("releases instead of canceling after an abort", () => {
    const controller = new AbortController();
    let canceled = false;
    let released = false;
    const reader = {
      cancel() {
        canceled = true;
        return Promise.resolve();
      },
      releaseLock() {
        released = true;
      },
    } as unknown as ReadableStreamDefaultReader<Uint8Array>;

    controller.abort(new DOMException("Stopped", "AbortError"));
    cleanupStreamReader(reader, controller.signal);

    expect(canceled).toBe(false);
    expect(released).toBe(true);
  });

  test("cancels active readers on non-abort cleanup", () => {
    let canceled = false;
    let released = false;
    const reader = {
      cancel() {
        canceled = true;
        return Promise.resolve();
      },
      releaseLock() {
        released = true;
      },
    } as unknown as ReadableStreamDefaultReader<Uint8Array>;

    cleanupStreamReader(reader, undefined);

    expect(canceled).toBe(true);
    expect(released).toBe(false);
  });
});
