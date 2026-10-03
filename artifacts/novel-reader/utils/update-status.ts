export type UpdateCheckState =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'error';

export type UpdateStatusInput = {
  state: UpdateCheckState;
  currentVersion: string;
  availableVersion?: string;
  errorMessage?: string;
};

export function updateStatusCopy(result: UpdateStatusInput): string {
  switch (result.state) {
    case 'checking':
      return 'Checking for updates...';
    case 'up-to-date':
      return `You're up to date (${result.currentVersion}).`;
    case 'available':
      return `Update available — Version ${result.availableVersion ?? 'unknown'}.`;
    case 'error':
      return result.errorMessage ?? 'Unable to check for updates.';
    default:
      return `Currently installed: ${result.currentVersion}.`;
  }
}
