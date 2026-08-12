import { Image, Platform, Pressable, StyleSheet } from 'react-native';

export function WebLandingButton({ color }: { color: string }) {
  if (Platform.OS !== 'web') return null;

  const openLandingPage = () => {
    if (typeof window !== 'undefined') window.location.assign('/');
  };

  return (
    <Pressable
      accessibilityLabel="Open Prime Novel landing page"
      accessibilityRole="link"
      hitSlop={8}
      onPress={openLandingPage}
      style={({ pressed }) => [styles.button, { borderColor: color, opacity: pressed ? 0.62 : 1 }]}
      testID="web-landing-button"
    >
      <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, overflow: 'hidden' },
  logo: { width: '100%', height: '100%' },
});
