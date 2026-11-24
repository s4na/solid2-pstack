import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { NotificationSettings } from "./NotificationSettings";

const meta = {
  title: "Settings/Notifications",
  component: NotificationSettings,
} satisfies Meta<typeof NotificationSettings>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Off: Story = { args: { initiallyEnabled: false } };
export const On: Story = { args: { initiallyEnabled: true } };
