import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/status")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/app", replace: true });
  },
  component: () => null,
});
