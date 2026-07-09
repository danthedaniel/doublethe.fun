import { createRoot } from "react-dom/client";
import App from "./App";
import "./globals.css";

// Note: intentionally not wrapped in <StrictMode>. The previous Next.js setup
// ran with `reactStrictMode: false` because the WebGL renderer setup/teardown
// and the one-time URL parameter handling don't tolerate effect double-invocation.
createRoot(document.getElementById("root")!).render(<App />);
