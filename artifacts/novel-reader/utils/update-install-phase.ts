export type UpdateInstallPhase =
  | 'idle'
  | 'preparing'
  | 'downloading'
  | 'ready-to-install'
  | 'installing'
  | 'installed'
  | 'error';

export function updateInstallPhaseCopy(phase: UpdateInstallPhase): string {
  switch (phase) {
    case 'preparing':
      return 'Preparing the update package...';
    case 'downloading':
      return 'Downloading the update...';
    case 'ready-to-install':
      return 'Update downloaded. Approve the install prompt to finish.';
    case 'installing':
      return 'Opening the system installer...';
    case 'installed':
      return 'The installer finished. Open the updated app when you are ready.';
    case 'error':
      return 'The update could not be installed.';
    default:
      return 'Ready to download and install.';
  }
}
