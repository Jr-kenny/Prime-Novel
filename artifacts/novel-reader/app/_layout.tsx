import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
} from '@expo-google-fonts/inter/400Regular';
import {
  Inter_500Medium,
} from '@expo-google-fonts/inter/500Medium';
import {
  Inter_600SemiBold,
} from '@expo-google-fonts/inter/600SemiBold';
import {
  Inter_700Bold,
} from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import {
  AtkinsonHyperlegible_400Regular,
} from '@expo-google-fonts/atkinson-hyperlegible/400Regular';
import {
  AtkinsonHyperlegible_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible/700Bold';
import {
  Merriweather_400Regular,
} from '@expo-google-fonts/merriweather/400Regular';
import {
  Merriweather_700Bold,
} from '@expo-google-fonts/merriweather/700Bold';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AppProvider } from '@/context/AppContext';
import { CatalogProvider } from '@/context/CatalogContext';
import { ReaderProvider } from '@/context/ReaderContext';
import { useColors } from '@/hooks/useColors';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const colors = useColors();
  const statusBarStyle = colors.background === '#171614' ? 'light' : 'dark';

  return (
    <>
      <StatusBar backgroundColor={colors.background} style={statusBarStyle} />
      <Stack screenOptions={{ headerBackTitle: 'Back' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chapters" options={{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }} />
        <Stack.Screen name="novel" options={{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }} />
        <Stack.Screen name="reader" options={{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }} />
        <Stack.Screen name="downloads" options={{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }} />
        <Stack.Screen name="history" options={{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }} />
        <Stack.Screen name="categories" options={{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }} />
        <Stack.Screen name="rankings" options={{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }} />
        <Stack.Screen name="analytics" options={{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }} />
        <Stack.Screen name="reader-settings" options={{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }} />
        <Stack.Screen name="view-settings" options={{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }} />
        <Stack.Screen name="update-settings" options={{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }} />
        <Stack.Screen name="advanced" options={{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }} />
        <Stack.Screen name="feedback" options={{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }} />
        <Stack.Screen name="share-link" options={{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
    Merriweather_400Regular,
    Merriweather_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <CatalogProvider>
              <ReaderProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </ReaderProvider>
            </CatalogProvider>
          </AppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
