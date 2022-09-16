import { lazy, ReactNode, Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { useFocusVisible } from "@react-aria/interactions";

import "./App.css";
import "@fontsource/inter/variable.css";

import { HydrogenRootView } from "./views/HydrogenRootView";
import { LoginView } from "./views/login/LoginView";
import { SessionView } from "./views/session/SessionView";
import { WorldView } from "./views/session/world/WorldView";
import { GLTFViewer } from "./views/gltf-viewer/GLTFViewer";
import { AssetPipeline } from "./views/asset-pipeline/AssetPipeline";

function FocusOutlineManager() {
  const { isFocusVisible } = useFocusVisible();
  useEffect(() => {
    document.body.style.setProperty("--focus-outline", isFocusVisible ? "var(--tc-surface) solid 2px" : "none");
  }, [isFocusVisible]);
  return <></>;
}

let storybookRoute: ReactNode = null;

if (import.meta.env.VITE_NETLIFY_DEPLOY_CONTEXT !== "production") {
  const Storybook = lazy(() => import("./storybook/Storybook"));

  storybookRoute = (
    <Route
      path="/storybook"
      element={
        <Suspense fallback="Loading...">
          <Storybook />
        </Suspense>
      }
    />
  );
}

export function App() {
  return (
    <>
      <FocusOutlineManager />
      <Routes>
        <Route element={<HydrogenRootView />}>
          <Route path="/login" element={<LoginView />} />
          <Route element={<SessionView />}>
            <Route path="world/:worldId" element={<WorldView />} />
            <Route path="world/" element={<WorldView />} />
            <Route path="/" element={<WorldView />} />
          </Route>
        </Route>
        <Route path="/viewer" element={<GLTFViewer />} />
        <Route path="/pipeline" element={<AssetPipeline />} />
        {storybookRoute}
      </Routes>
    </>
  );
}
