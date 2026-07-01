import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/security/login")({
  beforeLoad: () => { throw redirect({ to: "/admin/login" }); },
  component: () => null,
});
