import { createRoot } from "react-dom/client";
import App from "./App";
import "./globals.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Note: intentionally not wrapped in <StrictMode>. The previous Next.js setup
// ran with `reactStrictMode: false` because the WebGL renderer setup/teardown
// and the one-time URL parameter handling don't tolerate effect double-invocation.
createRoot(rootElement).render(<App />);
