import React from "react";
import { createRoot } from "react-dom/client";
import { Agentation } from "agentation";

const mountNode = document.createElement("div");
mountNode.id = "agentation-root";
document.body.appendChild(mountNode);

createRoot(mountNode).render(
  React.createElement(Agentation, {
    endpoint: "http://172.30.1.85:4747",
  })
);
