import '@testing-library/jest-dom';

// jsdom doesn't implement matchMedia — several components (e.g. the
// responsive-dialog hook used by ShareBubbleDialog) call it unconditionally
// on mount, which throws "matchMedia is not a function" in every test that
// renders them, regardless of what the test itself is checking.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}
