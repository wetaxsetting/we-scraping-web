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
