import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { reportWebVitals } from "./lib/webVitals";

createRoot(document.getElementById("root")!).render(<App />);

// Collect Core Web Vitals after the app mounts.
reportWebVitals();
