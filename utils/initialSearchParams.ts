// The app reads its initial state from the URL query string on load, then
// clears the URL. This captures the query string once, when the module is first
// imported (before any component clears it), so every consumer sees the same
// values regardless of import order.
export const initialSearchParams = new URLSearchParams(window.location.search);
