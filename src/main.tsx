import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ReproBuildApp } from "../components/reprobuild-app";
import "../app/globals.css";

const page = window.location.pathname.startsWith("/security") ? "security" : "lab";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ReproBuildApp page={page} />
  </StrictMode>,
);
