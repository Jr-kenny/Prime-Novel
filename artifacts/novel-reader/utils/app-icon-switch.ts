import type { AppIconId } from './app-icon';

export type AppIconSwitchResult = {
  applied: boolean;
  error?: string;
};

/**
 * Web and unsupported platforms cannot change the home-screen icon.
 * The in-app preference still persists so the choice is honored where supported.
 */
export async function applyAppIcon(_iconId: AppIconId): Promise<AppIconSwitchResult> {
  return { applied: false, error: 'App icon changes are available in the mobile app.' };
}

export async function readActiveAppIcon(): Promise<AppIconId | null> {
  return null;
}
