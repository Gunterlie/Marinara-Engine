// Must be the first import of main.tsx: the demo backend has to exist before any store or API call runs.
import { installDemoRuntime } from "./runtime";

if (import.meta.env.VITE_MARINARA_DEMO === "1") installDemoRuntime();
