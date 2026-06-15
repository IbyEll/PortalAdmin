/**
 * Opzione shell per child_process.spawn su Windows.
 * Con shell:true, path tipo C:\Program Files\nodejs\node.exe vengono troncati a C:\Program.
 *
 * @param {string} cmd
 */
export function spawnShellOption(cmd) {
  if (process.platform !== "win32") {
    return false;
  }

  const lower = cmd.toLowerCase().replace(/\\/g, "/");

  if (lower.endsWith("/node.exe") || lower.endsWith("/node")) {
    return false;
  }

  return lower.endsWith(".cmd") || lower.endsWith(".bat");
}
