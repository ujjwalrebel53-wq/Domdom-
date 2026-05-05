import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Image,
  Alert, Keyboard, InteractionManager, StatusBar,
  Share, Clipboard, ScrollView, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Fonts, Radius } from '../theme';
import {
  getChatHistory, addChatMessage, clearChatHistory,
  getCurrentUser, getSettings,
} from '../utils/storage';
import { sendChatMessage } from '../utils/api';
import { getFollowUpSuggestions, WELCOME_PROMPTS } from '../utils/suggestions';
import { trackMessage, trackSession } from '../utils/stats';
import TypingDots from '../components/TypingDots';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
let msgId = 0;
const newId = () => `m${++msgId}_${Date.now()}`;

// ── Typewriter ──────────────────────────────────────────
function useTypewriter(text, enabled, speed = 14) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const idxRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled || !text) { setDisplayed(text || ''); setDone(true); return; }
    setDisplayed(''); setDone(false); idxRef.current = 0;
    function tick() {
      if (idxRef.current < text.length) {
        setDisplayed(text.slice(0, idxRef.current + 1));
        idxRef.current++;
        timerRef.current = setTimeout(tick, speed);
      } else { setDone(true); }
    }
    timerRef.current = setTimeout(tick, speed);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, enabled]);

  return { displayed, done };
}

// ── Code block renderer ─────────────────────────────────
function renderContent(text, textStyle) {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3).replace(/^[a-z]+\n/, '');
      return (
        <View key={i} style={styles.codeBlock}>
          <View style={styles.codeHeader}>
            <Text style={styles.codeLang}>code</Text>
            <TouchableOpacity onPress={() => { Clipboard.setString(inner); }}>
              <Text style={styles.codeCopy}>Copy</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.codeText}>{inner.trim()}</Text>
        </View>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <Text key={i} style={styles.inlineCode}>{part.slice(1, -1)}</Text>;
    }
    // Bold: **text**
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return (
      <Text key={i} style={textStyle}>
        {boldParts.map((bp, bi) => {
          if (bp.startsWith('**') && bp.endsWith('**')) {
            return <Text key={bi} style={[textStyle, { fontWeight: '700', color: Colors.white }]}>{bp.slice(2, -2)}</Text>;
          }
          return <Text key={bi}>{bp}</Text>;
        })}
      </Text>
    );
  });
}

// ── Message bubble ──────────────────────────────────────
const MessageBubble = memo(({ message, isLatestBot, onLongPress }) => {
  const isUser = message.role === 'user';
  const slideX = useRef(new Animated.Value(isUser ? 45 : -45)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const { displayed, done } = useTypewriter(message.content, !isUser && isLatestBot, 13);

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(slideX, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  const shownText = (!isUser && isLatestBot) ? displayed : message.content;

  function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <Animated.View style={[
      styles.bubbleRow,
      isUser ? styles.bubbleRowUser : styles.bubbleRowBot,
      { opacity, transform: [{ translateX: slideX }] },
    ]}>
      {!isUser && (
        <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.botAvatar}>
          <Text style={styles.botAvatarText}>R</Text>
        </LinearGradient>
      )}
      <TouchableOpacity
        onLongPress={() => onLongPress && onLongPress(message)}
        activeOpacity={0.92}
        style={{ flexShrink: 1, maxWidth: '100%' }}
      >
        <View style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleBot,
          message.isError && styles.bubbleError,
        ]}>
          {message.image && (
            <Image source={{ uri: message.image }} style={styles.msgImage} resizeMode="cover" />
          )}
          {isUser
            ? <Text style={styles.bubbleTextUser}>{message.content}</Text>
            : (
              <View>
                {renderContent(shownText, styles.bubbleTextBot)}
                {isLatestBot && !done && (
                  <Text style={{ color: Colors.teal, fontSize: 16 }}>▌</Text>
                )}
              </View>
            )
          }
          <Text style={[styles.timeText, isUser && styles.timeTextUser]}>
            {formatTime(message.ts)}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ── Thinking indicator ──────────────────────────────────
function ThinkingBubble() {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowBot]}>
      <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.botAvatar}>
        <Text style={styles.botAvatarText}>R</Text>
      </LinearGradient>
      <View style={[styles.bubble, styles.bubbleBot]}>
        <TypingDots />
      </View>
    </View>
  );
}

// ── Welcome prompts (shown when chat is empty) ──────────
function WelcomeGrid({ onSelect, userName }) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.welcomeWrap, { opacity: fade, transform: [{ translateY: slide }] }]}>
      <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.welcomeAvatar}>
        <Text style={{ fontSize: 40 }}>R</Text>
      </LinearGradient>
      <Text style={styles.welcomeTitle}>Hello{userName ? ', ' + userName : ''}!</Text>
      <Text style={styles.welcomeSub}>I'm Rebel Gpt. How can I help you today?</Text>
      <View style={styles.promptGrid}>
        {WELCOME_PROMPTS.map((p, i) => (
          <TouchableOpacity key={i} style={styles.promptCard} onPress={() => onSelect(p.subtitle)} activeOpacity={0.78}>
            <Text style={styles.promptEmoji}>{p.emoji}</Text>
            <Text style={styles.promptTitle}>{p.title}</Text>
            <Text style={styles.promptSub}>{p.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

// ── Follow-up chips ─────────────────────────────────────
function SuggestionChips({ aiReply, onSelect }) {
  const chips = getFollowUpSuggestions(aiReply);
  const scrollX = useRef(new Animated.Value(0)).current;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsRow}
      style={styles.chipsScroll}
    >
      {chips.map((c, i) => (
        <TouchableOpacity key={i} style={styles.chip} onPress={() => onSelect(c)} activeOpacity={0.8}>
          <Text style={styles.chipText}>{c}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Main screen ─────────────────────────────────────────
export default function ChatScreen() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({});
  const [latestBotId, setLatestBotId] = useState(null);
  const [lastBotReply, setLastBotReply] = useState('');
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const listRef = useRef(null);
  const sendScale = useRef(new Animated.Value(1)).current;
  const fabOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const [cu, s] = await Promise.all([getCurrentUser(), getSettings()]);
      setUser(cu); setSettings(s);
      await trackSession();
      const email = cu?.email || 'guest';
      const hist = await getChatHistory(email);
      if (hist.length) {
        setMessages(hist.map(m => ({ id: newId(), ...m })));
        setIsEmpty(false);
      }
    })();
  }, []);

  // FAB visibility
  useEffect(() => {
    Animated.timing(fabOpacity, {
      toValue: showScrollFab ? 1 : 0,
      duration: 200, useNativeDriver: true,
    }).start();
  }, [showScrollFab]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  function onScroll(e) {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    setShowScrollFab(distFromBottom > 200);
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to attach images.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.72, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  }

  function handleLongPress(msg) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Message Options', '', [
      { text: '📋 Copy', onPress: () => Clipboard.setString(msg.content) },
      {
        text: '🔗 Share', onPress: () => Share.share({
          message: msg.role === 'assistant' ? `Rebel Gpt says:\n\n${msg.content}` : msg.content,
        }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function animateSend() {
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.80, duration: 80, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
  }

  const doSend = useCallback(async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text && !image) return;
    animateSend();
    if (!overrideText) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setIsEmpty(false);

    const userMsg = { id: newId(), role: 'user', content: text, image: image?.uri, ts: Date.now() };
    const snapshotMsgs = [...messages, userMsg];
    setMessages(snapshotMsgs);
    setInput(''); setImage(null); setLoading(true); setLastBotReply('');

    const email = user?.email || 'guest';
    await addChatMessage(email, 'user', text);
    await trackMessage();

    const historyForApi = snapshotMsgs
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-20).map(m => ({ role: m.role, content: m.content }));

    try {
      const sysPrompt = 'You are Rebel Gpt, an advanced AI assistant created by Rebel Bhaiya (Ujjwal Tiwari). Be helpful, knowledgeable, and concise.';
      const reply = await sendChatMessage(text, historyForApi.slice(0, -1), sysPrompt, image?.base64);
      const botId = newId();
      const botMsg = { id: botId, role: 'assistant', content: reply, ts: Date.now() };
      setMessages(prev => [...prev, botMsg]);
      setLatestBotId(botId);
      setLastBotReply(reply);
      await addChatMessage(email, 'assistant', reply);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      scrollToBottom();
    } catch (err) {
      const errId = newId();
      setMessages(prev => [...prev, {
        id: errId, role: 'assistant',
        content: 'Unable to reach AI right now. Please check your connection and try again.',
        ts: Date.now(), isError: true,
      }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setLoading(false); }
  }, [input, image, messages, user]);

  function confirmClear() {
    Alert.alert('New Chat', 'Start a fresh conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'New Chat', onPress: async () => {
          await clearChatHistory(user?.email || 'guest');
          setMessages([]); setIsEmpty(true);
          setLatestBotId(null); setLastBotReply('');
        },
      },
    ]);
  }

  const canSend = (input.trim().length > 0 || !!image) && !loading;

  const renderItem = useCallback(({ item }) => (
    <MessageBubble message={item} isLatestBot={item.id === latestBotId} onLongPress={handleLongPress} />
  ), [latestBotId]);

  const keyExtractor = useCallback(item => item.id, []);

  const charCount = input.length;
  const showCounter = charCount > 200;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>R</Text>
          </LinearGradient>
          <View>
            <Text style={styles.headerTitle}>Rebel <Text style={{ color: Colors.teal }}>Gpt</Text></Text>
            <View style={styles.headerStatusRow}>
              <View style={[styles.statusDot, { backgroundColor: loading ? Colors.teal : '#22c55e' }]} />
              <Text style={styles.headerStatus}>{loading ? 'Thinking...' : 'Online · GPT-5'}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={confirmClear} style={styles.newChatBtn} activeOpacity={0.8}>
          <LinearGradient colors={['rgba(138,43,226,0.18)', 'rgba(0,206,209,0.12)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.newChatGrad}>
            <Text style={styles.newChatText}>✚ New</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* ── Messages or Welcome ── */}
        {isEmpty ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            <WelcomeGrid onSelect={text => { setInput(text); }} userName={user?.name} />
          </ScrollView>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={120}
            onContentSizeChange={scrollToBottom}
            ListFooterComponent={loading ? <ThinkingBubble /> : null}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={15}
          />
        )}

        {/* ── Scroll to bottom FAB ── */}
        <Animated.View style={[styles.fab, { opacity: fabOpacity }]} pointerEvents={showScrollFab ? 'auto' : 'none'}>
          <TouchableOpacity onPress={scrollToBottom} style={styles.fabBtn} activeOpacity={0.8}>
            <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGrad}>
              <Text style={styles.fabIcon}>↓</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Follow-up chips ── */}
        {!!lastBotReply && !loading && (
          <SuggestionChips aiReply={lastBotReply} onSelect={text => doSend(text)} />
        )}

        {/* ── Image preview ── */}
        {image && (
          <View style={styles.imgPreviewRow}>
            <Image source={{ uri: image.uri }} style={styles.previewImg} />
            <TouchableOpacity onPress={() => setImage(null)} style={styles.removeImgBtn}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.imgLabel}>Image attached</Text>
          </View>
        )}

        {/* ── Input bar ── */}
        <View style={styles.inputBar}>
          <TouchableOpacity onPress={pickImage} style={styles.attachBtn} activeOpacity={0.7}>
            <Text style={styles.attachIcon}>{image ? '🖼️' : '📎'}</Text>
          </TouchableOpacity>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              placeholder="Message Rebel Gpt..."
              placeholderTextColor={Colors.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={4000}
            />
            {showCounter && (
              <Text style={[styles.charCount, charCount > 3500 && { color: Colors.error }]}>
                {charCount}/4000
              </Text>
            )}
          </View>
          <Animated.View style={{ transform: [{ scale: sendScale }] }}>
            <TouchableOpacity onPress={() => doSend()} disabled={!canSend} activeOpacity={1}>
              <LinearGradient
                colors={canSend ? ['#8a2be2', '#00ced1'] : ['#2a2a2a', '#2a2a2a']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.sendBtn}
              >
                <Text style={[styles.sendIcon, !canSend && { opacity: 0.35 }]}>↑</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
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
    borderBottomWidth: 1, borderColor: 'rgba(138,43,226,0.2)',
    backgroundColor: Colors.bgCard,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#8a2be2', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 10, elevation: 8,
  },
  headerAvatarText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  headerTitle: { color: Colors.text, fontSize: Fonts.size.md, fontWeight: '800' },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  headerStatus: { color: Colors.textSecondary, fontSize: Fonts.size.xs },
  newChatBtn: { borderRadius: 20, overflow: 'hidden' },
  newChatGrad: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(138,43,226,0.35)' },
  newChatText: { color: Colors.teal, fontSize: Fonts.size.xs, fontWeight: '700' },

  // Welcome
  welcomeWrap: { alignItems: 'center', padding: 20, paddingTop: 30 },
  welcomeAvatar: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: '#8a2be2', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 20, elevation: 14,
  },
  welcomeTitle: { color: Colors.text, fontSize: Fonts.size.xl, fontWeight: '800', marginBottom: 6 },
  welcomeSub: { color: Colors.textSecondary, fontSize: Fonts.size.sm, marginBottom: 24, textAlign: 'center' },
  promptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  promptCard: {
    width: (SCREEN_WIDTH - 56) / 2,
    backgroundColor: Colors.bgCard, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.2)',
    shadowColor: '#8a2be2', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  promptEmoji: { fontSize: 24, marginBottom: 8 },
  promptTitle: { color: Colors.text, fontSize: Fonts.size.sm, fontWeight: '700', marginBottom: 4 },
  promptSub: { color: Colors.textSecondary, fontSize: Fonts.size.xs, lineHeight: 16 },

  // Messages
  list: { paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 6 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 5, maxWidth: '87%', gap: 8 },
  bubbleRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubbleRowBot: { alignSelf: 'flex-start' },
  botAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 },
  botAvatarText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  bubble: { borderRadius: 20, padding: 12, paddingHorizontal: 14, flexShrink: 1 },
  bubbleUser: {
    backgroundColor: '#8a2be2', borderBottomRightRadius: 5,
    shadowColor: '#8a2be2', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  bubbleBot: { backgroundColor: Colors.bgCard, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: 'rgba(138,43,226,0.2)' },
  bubbleError: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
  msgImage: { width: 200, height: 150, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  bubbleTextUser: { color: Colors.white, fontSize: Fonts.size.md, lineHeight: 22 },
  bubbleTextBot: { color: Colors.textSecondary, fontSize: Fonts.size.md, lineHeight: 22 },
  timeText: { color: 'rgba(179,179,179,0.5)', fontSize: Fonts.size.xs, marginTop: 5 },
  timeTextUser: { color: 'rgba(255,255,255,0.5)', textAlign: 'right' },

  // Code blocks
  codeBlock: { backgroundColor: '#0d1117', borderRadius: 12, marginVertical: 6, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(138,43,226,0.3)' },
  codeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(138,43,226,0.15)' },
  codeLang: { color: Colors.teal, fontSize: Fonts.size.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  codeCopy: { color: Colors.textSecondary, fontSize: Fonts.size.xs },
  codeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#e6edf3', fontSize: 13, padding: 12, lineHeight: 20 },
  inlineCode: { backgroundColor: 'rgba(138,43,226,0.15)', color: Colors.teal, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, borderRadius: 4, paddingHorizontal: 4 },

  // FAB
  fab: { position: 'absolute', bottom: 80, right: 16 },
  fabBtn: { borderRadius: 24 },
  fabGrad: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#8a2be2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
  fabIcon: { color: '#fff', fontSize: 20, fontWeight: '900' },

  // Suggestion chips
  chipsScroll: { maxHeight: 50 },
  chipsRow: { paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  chip: { backgroundColor: 'rgba(138,43,226,0.12)', borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(138,43,226,0.35)' },
  chipText: { color: Colors.teal, fontSize: Fonts.size.xs, fontWeight: '600' },

  // Image preview
  imgPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 6 },
  previewImg: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(138,43,226,0.4)' },
  removeImgBtn: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  imgLabel: { color: Colors.textMuted, fontSize: Fonts.size.xs },

  // Input
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1, borderColor: 'rgba(138,43,226,0.2)',
    backgroundColor: Colors.bgCard, gap: 10,
  },
  attachBtn: { padding: 8 },
  attachIcon: { fontSize: 22 },
  inputWrap: { flex: 1, position: 'relative' },
  textInput: {
    backgroundColor: Colors.bgInput, borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 11, paddingBottom: 11,
    color: Colors.text, fontSize: Fonts.size.md, maxHeight: 140,
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.25)',
  },
  charCount: { position: 'absolute', bottom: 6, right: 12, color: Colors.textMuted, fontSize: 10 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { color: Colors.white, fontSize: 22, fontWeight: '900' },
});
