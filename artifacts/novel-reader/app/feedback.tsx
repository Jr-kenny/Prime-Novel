import Constants from 'expo-constants';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { SubscreenHeader } from '@/components/SubscreenHeader';
import { useColors } from '@/hooks/useColors';

type FeedbackCategory = 'bug' | 'idea' | 'source' | 'general';

const feedbackRecipient = process.env.EXPO_PUBLIC_FEEDBACK_EMAIL?.trim() || 'dalvidjr2022@gmail.com';
const feedbackCategories: Array<{ label: string; value: FeedbackCategory; icon: 'alert-circle' | 'star' | 'book-open' | 'message-circle' }> = [
  { label: 'Report a problem', value: 'bug', icon: 'alert-circle' },
  { label: 'Suggest an idea', value: 'idea', icon: 'star' },
  { label: 'Source or content', value: 'source', icon: 'book-open' },
  { label: 'General feedback', value: 'general', icon: 'message-circle' },
];

function isValidEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function firstText(values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
}

function androidSystemName() {
  const runtimeConstants = Platform.constants as Record<string, unknown>;
  const runtimeValues = [
    runtimeConstants.Fingerprint,
    runtimeConstants.Brand,
    runtimeConstants.Manufacturer,
    runtimeConstants.Model,
  ].filter(Boolean).join(' ');
  const knownSystems: Array<[RegExp, string]> = [
    [/hyperos/i, 'HyperOS'],
    [/miui/i, 'MIUI'],
    [/one ui/i, 'One UI'],
    [/harmonyos/i, 'HarmonyOS'],
    [/coloros/i, 'ColorOS'],
    [/oxygenos/i, 'OxygenOS'],
    [/funtouch/i, 'Funtouch OS'],
    [/originos/i, 'OriginOS'],
    [/hios/i, 'HiOS'],
    [/realme ui/i, 'realme UI'],
    [/magicos/i, 'MagicOS'],
    [/my ux/i, 'My UX'],
    [/flyme/i, 'Flyme'],
  ];
  return knownSystems.find(([pattern]) => pattern.test(runtimeValues))?.[1];
}

function platformDetails() {
  if (Platform.OS === 'android') {
    const androidVersion = firstText([
      Platform.constants.Release,
      Constants.systemVersion,
    ]) ?? 'unknown';
    const manufacturer = firstText([Platform.constants.Manufacturer]);
    const model = firstText([Platform.constants.Model, Constants.deviceName]);
    const device = model && manufacturer && !model.toLocaleLowerCase().includes(manufacturer.toLocaleLowerCase())
      ? `${manufacturer} ${model}`
      : model || manufacturer;
    return [`Android version ${androidVersion}`, androidSystemName(), device].filter(Boolean).join(' · ');
  }
  if (Platform.OS === 'ios') {
    const iosVersion = firstText([Platform.constants.osVersion, Constants.systemVersion, Platform.Version]) ?? 'unknown';
    const iosSystem = firstText([Platform.constants.systemName]) ?? 'iOS';
    const iosModel = firstText([Constants.model, Constants.deviceName]);
    return [`${iosSystem} version ${iosVersion}`, iosModel].filter(Boolean).join(' · ');
  }
  return `${Platform.OS} version ${String(Platform.Version)}`;
}

export default function FeedbackScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [message, setMessage] = useState('');
  const [replyEmail, setReplyEmail] = useState('');
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();
  const appDetails = useMemo(() => `Prime Novel ${Constants.expoConfig?.version ?? '1.0.0'} · ${platformDetails()}`, []);

  const sendFeedback = async () => {
    const trimmedMessage = message.trim();
    const trimmedEmail = replyEmail.trim();
    if (trimmedMessage.length < 10) {
      setStatus(undefined);
      setError('Please add a little more detail so we can understand your feedback.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setStatus(undefined);
      setError('Please check the reply email address.');
      return;
    }

    const categoryLabel = feedbackCategories.find((item) => item.value === category)?.label ?? 'General feedback';
    const subject = `[Prime Novel] ${categoryLabel}`;
    const body = [
      `Feedback type: ${categoryLabel}`,
      '',
      trimmedMessage,
      '',
      '--- App details ---',
      `App: ${appDetails}`,
      `Reply email: ${trimmedEmail || 'Not provided'}`,
    ].join('\n');
    const mailto = `mailto:${feedbackRecipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      await Linking.openURL(mailto);
      setError(undefined);
      setStatus('Your email app is ready with the feedback filled in.');
    } catch {
      setStatus(undefined);
      setError(`No email app could be opened. Please email ${feedbackRecipient} directly.`);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SubscreenHeader eyebrow="We read every note" title="Feedback & help" />
      <KeyboardAwareScrollViewCompat
        bottomOffset={24}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.intro, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.introIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="message-circle" size={21} color={colors.primary} />
          </View>
          <Text style={[styles.introTitle, { color: colors.foreground }]}>Help shape Prime Novel</Text>
          <Text style={[styles.introCopy, { color: colors.mutedForeground }]}>Tell us what worked, what felt difficult, or what you want to see next. Specific examples help us act faster.</Text>
        </View>

        <Text style={[styles.section, { color: colors.mutedForeground }]}>WHAT IS THIS ABOUT?</Text>
        <View style={styles.categoryGrid}>
          {feedbackCategories.map((item) => {
            const selected = category === item.value;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={item.value}
                onPress={() => { setCategory(item.value); setError(undefined); setStatus(undefined); }}
                style={({ pressed }) => [styles.category, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.76 : 1 }]}
              >
                <Feather name={item.icon} size={16} color={selected ? colors.primaryForeground : colors.primary} />
                <Text style={[styles.categoryText, { color: selected ? colors.primaryForeground : colors.foreground }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.section, styles.messageSection, { color: colors.mutedForeground }]}>YOUR FEEDBACK</Text>
        <TextInput
          accessibilityLabel="Feedback message"
          multiline
          onChangeText={(value) => { setMessage(value); setError(undefined); setStatus(undefined); }}
          placeholder="What happened, or what would make Prime Novel better?"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.messageInput, { backgroundColor: colors.card, borderColor: error ? colors.destructive : colors.border, color: colors.foreground }]}
          textAlignVertical="top"
          value={message}
        />
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>A title, source name, chapter, or short example is useful when reporting a problem.</Text>

        <Text style={[styles.section, styles.emailSection, { color: colors.mutedForeground }]}>REPLY EMAIL <Text style={styles.optional}>OPTIONAL</Text></Text>
        <TextInput
          accessibilityLabel="Reply email address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={(value) => { setReplyEmail(value); setError(undefined); setStatus(undefined); }}
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.emailInput, { backgroundColor: colors.card, borderColor: error && !isValidEmail(replyEmail.trim()) ? colors.destructive : colors.border, color: colors.foreground }]}
          value={replyEmail}
        />

        <View style={[styles.contextRow, { borderColor: colors.border }]}>
          <Feather name="info" size={15} color={colors.mutedForeground} />
          <Text style={[styles.contextText, { color: colors.mutedForeground }]}>We’ll include {appDetails} with your message to help us reproduce issues.</Text>
        </View>

        {error ? <Text style={[styles.feedbackMessage, { color: colors.destructive }]}>{error}</Text> : null}
        {status ? <Text style={[styles.feedbackMessage, { color: colors.primary }]}>{status}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={message.trim().length < 10}
          onPress={() => void sendFeedback()}
          style={({ pressed }) => [styles.sendButton, { backgroundColor: colors.primary, opacity: message.trim().length < 10 ? 0.42 : pressed ? 0.8 : 1 }]}
        >
          <Feather name="send" size={16} color={colors.primaryForeground} />
          <Text style={[styles.sendButtonText, { color: colors.primaryForeground }]}>Send feedback</Text>
        </Pressable>
        <Text style={[styles.recipientHint, { color: colors.mutedForeground }]}>Opens your email app and addresses the Prime Novel team.</Text>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 22 },
  intro: { borderWidth: 1, borderRadius: 18, padding: 18, marginTop: 4 },
  introIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  introTitle: { fontFamily: 'Georgia', fontSize: 22, lineHeight: 27 },
  introCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 8 },
  section: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.4, marginTop: 28, marginBottom: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: { width: '48%', minHeight: 54, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 15 },
  messageSection: { marginTop: 28 },
  messageInput: { minHeight: 156, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 9 },
  emailSection: { marginTop: 24, marginBottom: 10 },
  optional: { fontFamily: 'Inter_400Regular', letterSpacing: 0 },
  emailInput: { height: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 13 },
  contextRow: { marginTop: 16, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  contextText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15 },
  feedbackMessage: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16, marginTop: 14 },
  sendButton: { minHeight: 50, borderRadius: 25, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  sendButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  recipientHint: { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', marginTop: 10 },
});
