import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Image, ActivityIndicator,
  Alert, Keyboard, InteractionManager, StatusBar,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Fonts, Radius } from '../theme';
import {
  getChatHistory, addChatMessage, clearChatHistory, getCurrentUser, getSettings,
} from '../utils/storage';
import { sendChatMessage } from '../utils/api';
import TypingDots from '../components/TypingDots';

let msgId = 0;
const newId = () => `m${++msgId}_${Date.now()}`;

// ── Typewriter hook ──────────────────────────────────────
function useTypewriter(text, enabled, speed = 16) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const idxRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled || !text) { setDisplayed(text || ''); setDone(true); return; }
    setDisplayed('');
    setDone(false);
    idxRef.current = 0;

    function tick() {
      if (idxRef.current < text.length) {
        setDisplayed(text.slice(0, idxRef.current + 1));
        idxRef.current++;
        timerRef.current = setTimeout(tick, speed);
      } else {
        setDone(true);
      }
    }
    timerRef.current = setTimeout(tick, speed);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, enabled]);

  return { displayed, done };
}

// ── Single message bubble ────────────────────────────────
const MessageBubble = memo(({ message, isLatestBot }) => {
  const isUser = message.role === 'user';
  const slideX = useRef(new Animated.Value(isUser ? 40 : -40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const { displayed } = useTypewriter(
    message.content,
    !isUser && isLatestBot
  );

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
    <Animated.View
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowBot,
        { opacity, transform: [{ translateX: slideX }] },
      ]}
    >
      {!isUser && (
        <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.botAvatar}>
          <Text style={styles.botAvatarText}>R</Text>
        </LinearGradient>
      )}
      <View style={[
        styles.bubble,
        isUser ? styles.bubbleUser : styles.bubbleBot,
        message.isError && styles.bubbleError,
      ]}>
        {message.image && (
          <Image source={{ uri: message.image }} style={styles.msgImage} resizeMode="cover" />
        )}
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {shownText}
          {!isUser && isLatestBot && displayed.length < (message.content || '').length && (
            <Text style={{ color: Colors.teal }}>▌</Text>
          )}
        </Text>
        <Text style={[styles.timeText, isUser && styles.timeTextUser]}>{formatTime(message.ts)}</Text>
      </View>
    </Animated.View>
  );
});

// ── Typing dots indicator ────────────────────────────────
function ThinkingBubble() {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowBot]}>
      <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.botAvatar}>
        <Text style={styles.botAvatarText}>R</Text>
      </LinearGradient>
      <View style={styles.bubbleBot}>
        <TypingDots />
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────
export default function ChatScreen() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({});
  const [latestBotId, setLatestBotId] = useState(null);
  const listRef = useRef(null);
  const sendScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      const [cu, s] = await Promise.all([getCurrentUser(), getSettings()]);
      setUser(cu); setSettings(s);
      const email = cu?.email || 'guest';
      const hist = await getChatHistory(email);
      if (hist.length) {
        setMessages(hist.map(m => ({ id: newId(), ...m })));
      } else {
        const welcomeId = newId();
        setMessages([{
          id: welcomeId,
          role: 'assistant',
          content: `Hello${cu?.name ? ' ' + cu.name : ''}! I'm Rebel Gpt.\n\nAsk me anything — coding, science, math, creative writing, or everyday help.`,
          ts: Date.now(),
        }]);
        setLatestBotId(welcomeId);
      }
    })();
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to attach images.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  }

  function animateSend() {
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }),
    ]).start();
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && !image) return;
    animateSend();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();

    const userMsg = { id: newId(), role: 'user', content: text, image: image?.uri, ts: Date.now() };
    const snapshotMsgs = [...messages, userMsg];
    setMessages(snapshotMsgs);
    setInput(''); setImage(null); setLoading(true);

    const email = user?.email || 'guest';
    await addChatMessage(email, 'user', text);

    const historyForApi = snapshotMsgs
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const sysPrompt = 'You are Rebel Gpt, an advanced AI assistant created by Rebel Bhaiya (Ujjwal Tiwari). Be helpful, knowledgeable, and concise.';
      const reply = await sendChatMessage(text, historyForApi.slice(0, -1), sysPrompt, image?.base64);

      const botId = newId();
      const botMsg = { id: botId, role: 'assistant', content: reply, ts: Date.now() };
      setMessages(prev => [...prev, botMsg]);
      setLatestBotId(botId);
      await addChatMessage(email, 'assistant', reply);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      scrollToBottom();
    } catch (err) {
      const errId = newId();
      setMessages(prev => [...prev, { id: errId, role: 'assistant', content: `Unable to reach AI. Please try again.`, ts: Date.now(), isError: true }]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [input, image, messages, user, settings]);

  function confirmClear() {
    Alert.alert('Clear Chat', 'Delete all messages?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await clearChatHistory(user?.email || 'guest');
          const id = newId();
          setMessages([{ id, role: 'assistant', content: 'New conversation started!', ts: Date.now() }]);
          setLatestBotId(id);
        },
      },
    ]);
  }

  const canSend = (input.trim().length > 0 || !!image) && !loading;

  const renderItem = useCallback(({ item }) => (
    <MessageBubble message={item} isLatestBot={item.id === latestBotId} />
  ), [latestBotId]);

  const keyExtractor = useCallback(item => item.id, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>R</Text>
          </LinearGradient>
          <View>
            <Text style={styles.headerTitle}>Rebel <Text style={{ color: Colors.teal }}>Gpt</Text></Text>
            <View style={styles.headerStatusRow}>
              <View style={[styles.statusDot, { backgroundColor: loading ? Colors.teal : Colors.success }]} />
              <Text style={styles.headerStatus}>{loading ? 'Thinking...' : 'Online'}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={confirmClear} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.clearIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          ListFooterComponent={loading ? <ThinkingBubble /> : null}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={15}
          getItemLayout={undefined}
        />

        {/* Image preview */}
        {image && (
          <View style={styles.imgPreviewRow}>
            <Image source={{ uri: image.uri }} style={styles.previewImg} />
            <TouchableOpacity onPress={() => setImage(null)} style={styles.removeImgBtn}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.imgLabel}>Image attached</Text>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity onPress={pickImage} style={styles.attachBtn} activeOpacity={0.7}>
            <Text style={styles.attachIcon}>📎</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Message Rebel Gpt..."
            placeholderTextColor={Colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={4000}
          />
          <Animated.View style={{ transform: [{ scale: sendScale }] }}>
            <TouchableOpacity onPress={sendMessage} disabled={!canSend} activeOpacity={1}>
              <LinearGradient
                colors={canSend ? ['#8a2be2', '#00ced1'] : ['#2a2a2a', '#2a2a2a']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.sendBtn}
              >
                <Text style={[styles.sendIcon, !canSend && { opacity: 0.4 }]}>↑</Text>
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
    paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 14 : 10, paddingBottom: 12,
    borderBottomWidth: 1, borderColor: 'rgba(138,43,226,0.2)',
    backgroundColor: Colors.bgCard,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#8a2be2', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 10, elevation: 8,
  },
  headerAvatarText: { color: '#fff', fontSize: 19, fontWeight: '900' },
  headerTitle: { color: Colors.text, fontSize: Fonts.size.md, fontWeight: '700' },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  headerStatus: { color: Colors.textSecondary, fontSize: Fonts.size.xs },
  clearIcon: { fontSize: 20 },

  // Messages
  list: { paddingHorizontal: 14, paddingVertical: 14, paddingBottom: 4 },
  bubbleRow: {
    flexDirection: 'row', alignItems: 'flex-end', marginVertical: 5,
    maxWidth: '86%', gap: 8,
  },
  bubbleRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubbleRowBot: { alignSelf: 'flex-start' },
  botAvatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    marginBottom: 2,
  },
  botAvatarText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  bubble: {
    borderRadius: 20, padding: 12, paddingHorizontal: 15,
    flexShrink: 1, maxWidth: '100%',
  },
  bubbleUser: {
    backgroundColor: '#8a2be2',
    borderBottomRightRadius: 5,
    shadowColor: '#8a2be2', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  bubbleBot: {
    backgroundColor: Colors.bgCard,
    borderBottomLeftRadius: 5,
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.2)',
  },
  bubbleError: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  msgImage: {
    width: 200, height: 150, borderRadius: 12,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  bubbleText: { color: Colors.textSecondary, fontSize: Fonts.size.md, lineHeight: 22 },
  bubbleTextUser: { color: Colors.white },
  timeText: { color: 'rgba(179,179,179,0.55)', fontSize: Fonts.size.xs, marginTop: 5 },
  timeTextUser: { color: 'rgba(255,255,255,0.55)', textAlign: 'right' },

  // Image preview
  imgPreviewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 8,
  },
  previewImg: { width: 50, height: 50, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderPurple },
  removeImgBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center',
  },
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
  textInput: {
    flex: 1, backgroundColor: Colors.bgInput,
    borderRadius: 24, paddingHorizontal: 16, paddingVertical: 11,
    color: Colors.text, fontSize: Fonts.size.md, maxHeight: 130,
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.25)',
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { color: Colors.white, fontSize: 22, fontWeight: '900' },
});
