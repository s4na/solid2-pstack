import type { StorybookConfig } from "storybook-solidjs-vite";

const config: StorybookConfig = {
  framework: "storybook-solidjs-vite",
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y"],
};

export default config;
