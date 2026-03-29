/**
 * Standard IPC wrapper for Tauri v2.
 * Uses dynamic imports to ensure `@tauri-apps/api` is only accessed 
 * after the environment is fully initialized, preventing "invoke is undefined" errors.
 */
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke<T>(cmd, args)
}
