import type { Preview } from "storybook-solidjs-vite";
import "../src/reset.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    a11y: { test: "error" },
  },
};

export default preview;
