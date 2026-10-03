import { NativeModulesProxy, requireNativeModule } from 'expo-modules-core';
import type { AppIconId } from './app-icon';
import { DEFAULT_APP_ICON, normalizeAppIconId } from './app-icon';

export type AppIconSwitchResult = {
  applied: boolean;
  error?: string;
};

type AppIconModule = {
  setAppIcon(iconId: string | null): Promise<boolean>;
  getAppIcon(): Promise<string | null>;
};

function resolveModule(): AppIconModule | null {
  const direct = (NativeModulesProxy as { AppIcon?: AppIconModule }).AppIcon;
  if (direct) return direct;
  try {
    return requireNativeModule<AppIconModule>('AppIcon');
  } catch {
    return null;
  }
}

export async function applyAppIcon(iconId: AppIconId): Promise<AppIconSwitchResult> {
  const module = resolveModule();
  if (!module) {
    return { applied: false, error: 'App icon switching is not available on this build.' };
  }
  try {
    const applied = await module.setAppIcon(iconId === DEFAULT_APP_ICON ? null : iconId);
    return { applied: applied !== false };
  } catch (error) {
    return {
      applied: false,
      error: error instanceof Error ? error.message : 'The app icon could not be changed.',
    };
  }
}

export async function readActiveAppIcon(): Promise<AppIconId | null> {
  const module = resolveModule();
  if (!module) return null;
  try {
    const value = await module.getAppIcon();
    return value ? normalizeAppIconId(value) : DEFAULT_APP_ICON;
  } catch {
    return null;
  }
}
