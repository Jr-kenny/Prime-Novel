import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function ShareLinkScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addShareLink, settings, sharedLinks } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);

  const saveLink = () => {
    if (!addShareLink(url)) {
      setStatus('Enter a valid share link');
      return;
    }
    setUrl('');
    setStatus('Share link saved');
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const nextPermission = await requestPermission();
      if (!nextPermission.granted) {
        setStatus('Camera permission is needed to scan a QR code');
        return;
      }
    }
    setScanLocked(false);
    setScannerOpen(true);
  };

  const handleScan = ({ data }: { data: string }) => {
    if (scanLocked) return;
    setScanLocked(true);
    if (!/^https?:\/\/[^\s]+$/i.test(data.trim())) {
      setStatus('That QR code is not a Prime Novel link');
      setScannerOpen(false);
      return;
    }
    if (settings.autoBookmarkFromShare) {
      addShareLink(data);
      setStatus('Novel link saved');
      setUrl('');
    } else {
      setUrl(data);
      setStatus('Novel link ready to save');
    }
    setScannerOpen(false);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubscreenHeader title="Add share link" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 48 }} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={setUrl}
          placeholder="https://..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderBottomColor: colors.border, color: colors.foreground }]}
          value={url}
        />
        <Pressable accessibilityRole="button" disabled={!url.trim()} onPress={saveLink} style={({ pressed }) => [styles.button, { backgroundColor: colors.foreground, opacity: !url.trim() ? 0.35 : pressed ? 0.72 : 1 }]}>
          <Text style={[styles.buttonText, { color: colors.background }]}>Save link</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void openScanner()} style={({ pressed }) => [styles.scanButton, { borderColor: colors.border, opacity: pressed ? 0.68 : 1 }]}>
          <Feather name="camera" size={15} color={colors.foreground} />
          <Text style={[styles.scanText, { color: colors.foreground }]}>Scan QR code</Text>
        </Pressable>
        {status ? <Text style={[styles.status, { color: colors.primary }]}>{status}</Text> : null}
        {sharedLinks.length > 0 ? (
          <View style={styles.saved}>
            <Text style={[styles.section, { color: colors.foreground }]}>Saved links</Text>
            {sharedLinks.map((link) => (
              <View key={link} style={[styles.linkRow, { borderBottomColor: colors.border }]}>
                <Feather name="link" size={15} color={colors.primary} />
                <Text selectable style={[styles.link, { color: colors.mutedForeground }]} numberOfLines={1}>{link}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <Modal animationType="slide" onRequestClose={() => setScannerOpen(false)} visible={scannerOpen}>
        <View style={styles.scannerScreen}>
          <CameraView
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanLocked ? undefined : handleScan}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.scannerOverlay}>
            <Pressable accessibilityLabel="Close QR scanner" accessibilityRole="button" onPress={() => setScannerOpen(false)} style={styles.closeScanner}>
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
            <View style={styles.scanFrame} />
            <Text style={styles.scannerHint}>Place the novel QR code inside the frame.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  input: { height: 44, borderBottomWidth: StyleSheet.hairlineWidth, fontFamily: 'Inter_400Regular', fontSize: 13 },
  button: { height: 42, borderRadius: 21, marginTop: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  scanButton: { minHeight: 42, borderWidth: StyleSheet.hairlineWidth, borderRadius: 21, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  scanText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  status: { marginTop: 12, fontFamily: 'Inter_500Medium', fontSize: 11 },
  saved: { marginTop: 32 },
  section: { fontFamily: 'Georgia', fontSize: 19, marginBottom: 10 },
  linkRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  link: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11 },
  scannerScreen: { flex: 1, backgroundColor: '#000' },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  closeScanner: { position: 'absolute', top: 64, right: 22, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 230, height: 230, borderWidth: 2, borderColor: '#fff', borderRadius: 18 },
  scannerHint: { color: '#fff', fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 22 },
});
