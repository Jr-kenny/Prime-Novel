import { requireNativeModule } from 'expo';

export type AppIconModuleApi = {
  setAppIcon(iconId: string | null): Promise<boolean>;
  getAppIcon(): Promise<string | null>;
};

export default requireNativeModule<AppIconModuleApi>('AppIcon');
