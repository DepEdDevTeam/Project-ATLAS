export default function config(phase) {
  // Keep development and production artifacts apart when validating a build.
  return { distDir: phase === "phase-development-server" ? ".next-dev" : ".next" };
}
