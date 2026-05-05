// ChatGPT-exact chat screen
import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Image, Alert,
  Keyboard, InteractionManager, StatusBar, Share, Clipboard,
  ScrollView, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Radius } from '../theme';
import { getCurrentUser, getSettings } from '../utils/storage';
import {
  getMessages, addMessage as addMsgToConv, clearMessages, updateConversationTitle, createConversation,
} from '../utils/conversations';
import { sendChatMessage } from '../utils/api';
import { getFollowUpSuggestions, WELCOME_PROMPTS } from '../utils/suggestions';
import { trackMessage, trackSession } from '../utils/stats';

const { width: SW } = Dimensions.get('window');

// ── Typewriter ───────────────────────────────────────────
function useTypewriter(text, enabled, speed = 12) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const ref = useRef(0);
  const timer = useRef(null);
  useEffect(() => {
    if (!enabled || !text) { setDisplayed(text || ''); setDone(true); return; }
    setDisplayed(''); setDone(false); ref.current = 0;
    function tick() {
      if (ref.current < text.length) {
        setDisplayed(text.slice(0, ++ref.current));
        timer.current = setTimeout(tick, speed);
      } else setDone(true);
    }
    timer.current = setTimeout(tick, speed);
    return () => clearTimeout(timer.current);
  }, [text, enabled]);
  return { displayed, done };
}

// ── Content renderer: code blocks, bold ─────────────────
function ContentRenderer({ text, style }) {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return (
    <View>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const inner = part.slice(3, -3).replace(/^[a-z]*\n/, '');
          return (
            <View key={i} style={styles.codeBlock}>
              <View style={styles.codeHeader}>
                <Text style={styles.codeLang}>code</Text>
                <TouchableOpacity onPress={() => Clipboard.setString(inner)}>
                  <Text style={styles.codeCopy}>Copy code</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={styles.codeText}>{inner.trim()}</Text>
              </ScrollView>
            </View>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <Text key={i} style={styles.inlineCode}>{part.slice(1, -1)}</Text>;
        }
        // Bold
        const bolds = part.split(/(\*\*[^*]+\*\*)/g);
        return (
          <Text key={i} style={style}>
            {bolds.map((b, bi) =>
              b.startsWith('**') && b.endsWith('**')
                ? <Text key={bi} style={[style, { fontWeight: '700', color: Colors.text }]}>{b.slice(2, -2)}</Text>
                : <Text key={bi}>{b}</Text>
            )}
          </Text>
        );
      })}
    </View>
  );
}

// ── Message row — ChatGPT exact layout ──────────────────
const MessageRow = memo(({ message, isLatestBot, onLongPress }) => {
  const isUser = message.role === 'user';
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(8)).current;
  const { displayed, done } = useTypewriter(message.content, !isUser && isLatestBot, 12);
  const shown = (!isUser && isLatestBot) ? displayed : message.content;

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  if (isUser) {
    return (
      <Animated.View style={[styles.userRow, { opacity, transform: [{ translateY: slideY }] }]}>
        <TouchableOpacity
          onLongPress={() => onLongPress(message)}
          activeOpacity={0.85}
          style={styles.userBubble}
        >
          {message.image && <Image source={{ uri: message.image }} style={styles.msgImage} />}
          <Text style={styles.userText}>{message.content}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.aiRow, { opacity, transform: [{ translateY: slideY }] }]}>
      <View style={styles.aiAvatarWrap}>
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>R</Text>
        </View>
      </View>
      <TouchableOpacity
        onLongPress={() => onLongPress(message)}
        activeOpacity={0.85}
        style={styles.aiContent}
      >
        <ContentRenderer text={shown} style={styles.aiText} />
        {!done && isLatestBot && <Text style={styles.cursor}>▌</Text>}
        {done && (
          <View style={styles.aiActions}>
            <TouchableOpacity onPress={() => Clipboard.setString(message.content)} style={styles.aiActionBtn}>
              <Text style={styles.aiActionIcon}>📋</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Share.share({ message: message.content })} style={styles.aiActionBtn}>
              <Text style={styles.aiActionIcon}>🔗</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

// ── Thinking row ─────────────────────────────────────────
function ThinkingRow() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 150),
      Animated.timing(d, { toValue: -5, duration: 250, useNativeDriver: true }),
      Animated.timing(d, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.delay(450 - i * 150),
    ])));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={styles.aiRow}>
      <View style={styles.aiAvatarWrap}>
        <View style={styles.aiAvatar}><Text style={styles.aiAvatarText}>R</Text></View>
      </View>
      <View style={styles.aiContent}>
        <View style={{ flexDirection: 'row', gap: 4, paddingVertical: 6 }}>
          {dots.map((d, i) => (
            <Animated.View key={i} style={[styles.thinkDot, { transform: [{ translateY: d }] }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Welcome screen (empty chat) ──────────────────────────
function WelcomeView({ onSelect, userName }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.ScrollView style={{ opacity: fade }} contentContainerStyle={styles.welcomeWrap} showsVerticalScrollIndicator={false}>
      <View style={styles.welcomeLogoWrap}>
        <View style={styles.welcomeLogo}><Text style={styles.welcomeLogoText}>R</Text></View>
      </View>
      <Text style={styles.welcomeTitle}>How can I help you{userName ? ', ' + userName : ''}?</Text>
      <View style={styles.promptGrid}>
        {WELCOME_PROMPTS.map((p, i) => (
          <TouchableOpacity key={i} style={styles.promptCard} onPress={() => onSelect(p.subtitle)} activeOpacity={0.75}>
            <Text style={styles.promptEmoji}>{p.emoji}</Text>
            <Text style={styles.promptTitle}>{p.title}</Text>
            <Text style={styles.promptSub}>{p.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.ScrollView>
  );
}

// ── Suggestion chips ─────────────────────────────────────
function SuggestionChips({ aiReply, onSelect }) {
  const chips = getFollowUpSuggestions(aiReply);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
      {chips.map((c, i) => (
        <TouchableOpacity key={i} style={styles.chip} onPress={() => onSelect(c)} activeOpacity={0.8}>
          <Text style={styles.chipText}>{c}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function ChatScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const convId = route?.params?.convId;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [user, setUser] = useState(null);
  const [latestBotId, setLatestBotId] = useState(null);
  const [lastReply, setLastReply] = useState('');
  const [isEmpty, setIsEmpty] = useState(true);
  const [showFab, setShowFab] = useState(false);
  const fabOpacity = useRef(new Animated.Value(0)).current;
  const listRef = useRef(null);
  const sendScale = useRef(new Animated.Value(1)).current;
  const currentConvId = useRef(convId);

  useEffect(() => {
    (async () => {
      const cu = await getCurrentUser();
      setUser(cu);
      if (convId) {
        currentConvId.current = convId;
        const msgs = await getMessages(convId);
        if (msgs.length) { setMessages(msgs); setIsEmpty(false); }
        else setIsEmpty(true);
      }
    })();
  }, [convId]);

  useEffect(() => {
    Animated.timing(fabOpacity, { toValue: showFab ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [showFab]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  async function getOrCreateConvId() {
    if (currentConvId.current) return currentConvId.current;
    const conv = await createConversation('New Chat');
    currentConvId.current = conv.id;
    return conv.id;
  }

  async function pickImage() {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) { Alert.alert('Permission needed', 'Allow photo access to attach images.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.72, base64: true });
    if (!r.canceled && r.assets[0]) setImage({ uri: r.assets[0].uri, base64: r.assets[0].base64 });
  }

  function handleLongPress(msg) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('', '', [
      { text: '📋 Copy text', onPress: () => Clipboard.setString(msg.content) },
      { text: '🔗 Share', onPress: () => Share.share({ message: msg.content }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const doSend = useCallback(async (override) => {
    const text = (override ?? input).trim();
    if (!text && !image) return;
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.82, duration: 70, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
    if (!override) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setIsEmpty(false);

    const cid = await getOrCreateConvId();

    const userMsg = { id: `u_${Date.now()}`, role: 'user', content: text, image: image?.uri, ts: Date.now() };
    const snap = [...messages, userMsg];
    setMessages(snap);
    setInput(''); setImage(null); setLoading(true); setLastReply('');

    await addMsgToConv(cid, 'user', text, image?.uri);
    await trackMessage();

    const history = snap.filter(m => m.role === 'user' || m.role === 'assistant').slice(-20).map(m => ({ role: m.role, content: m.content }));

    try {
      const sys = 'You are Rebel Gpt, an advanced AI assistant created by Rebel bhaiya (Ujjwal Tiwari). You are helpful, rebellious, and expert in coding, science, math, and general knowledge. You were built by Rebel Bhaiya on a private advanced AI infrastructure. Never call yourself any other AI or model name like GPT, Gemini, Copilot, Claude etc. Always identify yourself as Rebel Gpt only.';
      const reply = await sendChatMessage(text, history.slice(0, -1), sys, image?.base64);
      const botMsg = { id: `b_${Date.now()}`, role: 'assistant', content: reply, ts: Date.now() };
      setMessages(p => [...p, botMsg]);
      setLatestBotId(botMsg.id);
      setLastReply(reply);
      await addMsgToConv(cid, 'assistant', reply, null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      scrollToEnd();
    } catch {
      const err = { id: `e_${Date.now()}`, role: 'assistant', content: 'Something went wrong. Please try again.', ts: Date.now(), isError: true };
      setMessages(p => [...p, err]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setLoading(false); }
  }, [input, image, messages]);

  const canSend = (input.trim() || !!image) && !loading;

  const renderItem = useCallback(({ item }) => (
    <MessageRow message={item} isLatestBot={item.id === latestBotId} onLongPress={handleLongPress} />
  ), [latestBotId]);

  const keyExtractor = useCallback(m => m.id, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {route?.params?.convTitle || 'New chat'}
        </Text>
        <TouchableOpacity
          onPress={async () => {
            const cid = await getOrCreateConvId();
            await clearMessages(cid);
            setMessages([]); setIsEmpty(true); setLastReply('');
          }}
          style={styles.headerNewBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.headerNewIcon}>✏️</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
        {isEmpty ? (
          <WelcomeView onSelect={t => { setInput(t); }} userName={user?.name} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onScroll={e => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              setShowFab(contentSize.height - layoutMeasurement.height - contentOffset.y > 220);
            }}
            scrollEventThrottle={100}
            onContentSizeChange={scrollToEnd}
            ListFooterComponent={loading ? <ThinkingRow /> : null}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={16}
          />
        )}

        {/* Scroll FAB */}
        <Animated.View style={[styles.fab, { opacity: fabOpacity }]} pointerEvents={showFab ? 'auto' : 'none'}>
          <TouchableOpacity onPress={scrollToEnd} style={styles.fabBtn}>
            <Text style={styles.fabIcon}>↓</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Follow-up chips */}
        {!!lastReply && !loading && (
          <SuggestionChips aiReply={lastReply} onSelect={t => doSend(t)} />
        )}

        {/* Image preview */}
        {image && (
          <View style={styles.imgRow}>
            <Image source={{ uri: image.uri }} style={styles.previewImg} />
            <TouchableOpacity onPress={() => setImage(null)} style={styles.removeImg}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar — ChatGPT exact */}
        <View style={[styles.inputWrap, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 28 : 14) }]}>
          <View style={styles.inputBox}>
            <TouchableOpacity onPress={pickImage} style={styles.inputLeft} activeOpacity={0.7}>
              <Text style={styles.attachIcon}>{image ? '🖼️' : '📎'}</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Message Rebel AI..."
              placeholderTextColor={Colors.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={4000}
            />
            {input.length > 200 && (
              <Text style={[styles.charCount, input.length > 3500 && { color: Colors.error }]}>
                {input.length}/4000
              </Text>
            )}
            <Animated.View style={{ transform: [{ scale: sendScale }] }}>
              <TouchableOpacity
                onPress={() => doSend()}
                disabled={!canSend}
                style={[styles.sendBtn, canSend && styles.sendBtnActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.sendIcon, !canSend && { opacity: 0.3 }]}>↑</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
          <Text style={styles.disclaimer}>Rebel AI can make mistakes. Verify important info.</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 14 : 10, paddingBottom: 12,
    borderBottomWidth: 1, borderColor: Colors.borderSubtle,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: Colors.text, fontSize: 20 },
  headerTitle: { flex: 1, color: Colors.text, fontSize: Fonts.size.md, fontWeight: '600', textAlign: 'center', marginHorizontal: 12 },
  headerNewBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerNewIcon: { fontSize: 18 },

  // Welcome
  welcomeWrap: { padding: 24, alignItems: 'center', paddingTop: 48 },
  welcomeLogoWrap: { marginBottom: 18 },
  welcomeLogo: { width: 60, height: 60, borderRadius: 16, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  welcomeLogoText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  welcomeTitle: { color: Colors.text, fontSize: Fonts.size.xl, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  promptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', width: '100%' },
  promptCard: {
    width: (SW - 60) / 2, backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  promptEmoji: { fontSize: 22, marginBottom: 6 },
  promptTitle: { color: Colors.text, fontSize: Fonts.size.sm, fontWeight: '600', marginBottom: 4 },
  promptSub: { color: Colors.textSecondary, fontSize: Fonts.size.xs, lineHeight: 16 },

  // Messages
  list: { paddingVertical: 16, paddingBottom: 6 },

  // User message — right-aligned pill
  userRow: { alignItems: 'flex-end', paddingHorizontal: 16, marginVertical: 4 },
  userBubble: {
    backgroundColor: Colors.bgUserMsg, borderRadius: Radius.xl,
    paddingVertical: 10, paddingHorizontal: 16,
    maxWidth: SW * 0.78,
  },
  userText: { color: Colors.text, fontSize: Fonts.size.md, lineHeight: 22 },
  msgImage: { width: 200, height: 150, borderRadius: 12, marginBottom: 8 },

  // AI message — left-aligned, no bubble bg (ChatGPT style)
  aiRow: { flexDirection: 'row', paddingHorizontal: 16, marginVertical: 6, alignItems: 'flex-start', gap: 12 },
  aiAvatarWrap: { paddingTop: 2 },
  aiAvatar: { width: 28, height: 28, borderRadius: 7, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  aiAvatarText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  aiContent: { flex: 1 },
  aiText: { color: Colors.text, fontSize: Fonts.size.md, lineHeight: 24 },
  cursor: { color: Colors.accent, fontSize: 16 },
  aiActions: { flexDirection: 'row', gap: 4, marginTop: 8 },
  aiActionBtn: { padding: 6, borderRadius: 8 },
  aiActionIcon: { fontSize: 14 },

  // Code
  codeBlock: { backgroundColor: '#0d1117', borderRadius: 10, marginVertical: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  codeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  codeLang: { color: Colors.textSecondary, fontSize: Fonts.size.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  codeCopy: { color: Colors.accent, fontSize: Fonts.size.xs },
  codeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#e6edf3', fontSize: 13, padding: 14, lineHeight: 20 },
  inlineCode: { backgroundColor: 'rgba(255,255,255,0.1)', color: Colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, borderRadius: 4, paddingHorizontal: 4 },

  // Thinking
  thinkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.textSecondary },

  // FAB
  fab: { position: 'absolute', bottom: 80, right: 16 },
  fabBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  fabIcon: { color: Colors.text, fontSize: 18 },

  // Chips
  chipsRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { backgroundColor: Colors.bgCard, borderRadius: Radius.full, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border },
  chipText: { color: Colors.textSecondary, fontSize: Fonts.size.xs },

  // Image
  imgRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 6 },
  previewImg: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  removeImg: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center' },

  // Input — ChatGPT style rounded box
  inputWrap: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 8 },
  inputBox: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: Colors.bgInput, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    paddingRight: 6, paddingLeft: 4, paddingVertical: 4,
    minHeight: 52,
  },
  inputLeft: { padding: 10 },
  attachIcon: { fontSize: 20 },
  textInput: {
    flex: 1, color: Colors.text, fontSize: Fonts.size.md,
    paddingVertical: 10, paddingHorizontal: 8, maxHeight: 160, lineHeight: 22,
  },
  charCount: { color: Colors.textMuted, fontSize: 10, paddingBottom: 14, paddingRight: 4 },
  sendBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.bgHover, alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  sendBtnActive: { backgroundColor: Colors.accent },
  sendIcon: { color: Colors.white, fontSize: 18, fontWeight: '900' },
  disclaimer: { color: Colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 8 },
});
