import "@testing-library/jest-dom/vitest";

// jsdom does not implement ResizeObserver; several shared components
// (EllipsisTooltip, …) construct one in a mount effect. Minimal no-op
// stub so those components render under the test environment.
if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
        ResizeObserverStub;
}

// Node ≥ 22 ships its own global `localStorage`, which is `undefined` unless
// Node runs with `--localstorage-file`, and it shadows jsdom's implementation
// (`window.localStorage` → undefined). Install a minimal in-memory Storage so
// code that persists the session / locale can be exercised under test.
if (typeof window !== "undefined" && !window.localStorage) {
    class MemoryStorage implements Storage {
        private map = new Map<string, string>();
        get length() { return this.map.size; }
        clear() { this.map.clear(); }
        getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
        key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
        removeItem(k: string) { this.map.delete(k); }
        setItem(k: string, v: string) { this.map.set(k, String(v)); }
    }
    Object.defineProperty(window, "localStorage", { value: new MemoryStorage(), configurable: true });
}
