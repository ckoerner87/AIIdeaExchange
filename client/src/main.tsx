import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import "./index.css";

// Lazy load the main App component
const App = lazy(() => import("./App"));

const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
  </div>
);

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<LoadingSpinner />}>
    <App />
  </Suspense>
);
