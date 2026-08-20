import * as FileSystem from 'expo-file-system/legacy';

type BackupEnvelope<T> = {
  savedAt: number;
  data: T;
};

const backupDirectory = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}prime-novel/backups/`
  : undefined;

async function readSlot<T>(path: string): Promise<BackupEnvelope<T> | undefined> {
  try {
    const value = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(value) as Partial<BackupEnvelope<T>>;
    if (!Number.isFinite(parsed.savedAt) || parsed.data === undefined) return undefined;
    return parsed as BackupEnvelope<T>;
  } catch {
    return undefined;
  }
}

export async function readPersistentBackup<T>(name: string): Promise<T | undefined> {
  if (!backupDirectory) return undefined;
  const [first, second] = await Promise.all([
    readSlot<T>(`${backupDirectory}${name}.a.json`),
    readSlot<T>(`${backupDirectory}${name}.b.json`),
  ]);
  if (!first) return second?.data;
  if (!second) return first.data;
  return (first.savedAt >= second.savedAt ? first : second).data;
}

export async function writePersistentBackup<T>(name: string, data: T): Promise<void> {
  if (!backupDirectory) return;
  await FileSystem.makeDirectoryAsync(backupDirectory, { intermediates: true });
  const firstPath = `${backupDirectory}${name}.a.json`;
  const secondPath = `${backupDirectory}${name}.b.json`;
  const [first, second] = await Promise.all([
    readSlot<T>(firstPath),
    readSlot<T>(secondPath),
  ]);
  const target = !first ? firstPath : !second ? secondPath : first.savedAt <= second.savedAt ? firstPath : secondPath;
  await FileSystem.writeAsStringAsync(target, JSON.stringify({ savedAt: Date.now(), data }));
}
