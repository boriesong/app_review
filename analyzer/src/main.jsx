import React from "react";
import { createRoot } from "react-dom/client";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import App from "./ui/App.jsx";

createRoot(document.getElementById("root")).render(<App />);
