import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, Animated, Image, ActivityIndicator,
  Alert, Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts, Radius, Shadow } from '../theme';
import {
  getChatHistory, addChatMessage, clearChatHistory, getCurrentUser, getSettings,
} from '../utils/storage';
import { sendChatMessage } from '../utils/api';
import MessageBubble from '../components/MessageBubble';
import TypingDots from '../components/TypingDots';

let msgId = 0;
function newId() { return `m_${++msgId}_${Date.now()}`; }

export default function ChatScreen() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({});
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const sendScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      const cu = await getCurrentUser();
      const s = await getSettings();
      setUser(cu); setSettings(s);
      const email = cu?.email || 'guest';
      const hist = await getChatHistory(email);
      if (hist.length) {
        setMessages(hist.map(m => ({ id: newId(), ...m })));
      } else {
        setMessages([{
          id: newId(),
          role: 'assistant',
          content: `Hello${cu ? ' ' + cu.name : ''}! I'm Rebel Gpt. Ask me anything — coding, science, math, or general knowledge. How can I help you today?`,
          ts: Date.now(),
        }]);
      }
    })();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages]);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow media access to attach images.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  }

  function pressSendAnim() {
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && !image) return;
    pressSendAnim();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();

    const userMsg = { id: newId(), role: 'user', content: text, image: image?.uri, ts: Date.now() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput(''); setImage(null); setLoading(true);

    const email = user?.email || 'guest';
    await addChatMessage(email, 'user', text);

    // Get history for context (all previous messages before this one)
    const historyForApi = newMsgs
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const sysPrompt = settings.systemPrompt ||
        'You are Rebel Gpt, an advanced AI assistant created by Rebel Bhaiya (Ujjwal Tiwari). Be helpful, knowledgeable, and concise.';
      // Pass history without the current message (already in the prompt builder)
      const reply = await sendChatMessage(
        text,
        historyForApi.slice(0, -1),
        sysPrompt,
        image?.base64,
      );
      const botMsg = { id: newId(), role: 'assistant', content: reply, ts: Date.now() };
      setMessages(prev => [...prev, botMsg]);
      await addChatMessage(email, 'assistant', reply);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const errMsg = { id: newId(), role: 'assistant', content: `⚠️ ${err.message}`, ts: Date.now(), isError: true };
      setMessages(prev => [...prev, errMsg]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [input, image, messages, user, settings]);

  function confirmClear() {
    Alert.alert('Clear Chat', 'Delete all messages?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          await clearChatHistory(user?.email || 'guest');
          setMessages([{ id: newId(), role: 'assistant', content: 'Chat cleared. Start a new conversation!', ts: Date.now() }]);
        },
      },
    ]);
  }

  const canSend = (input.trim().length > 0 || !!image) && !loading;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}><Text style={styles.avatarText}>R</Text></View>
          <View>
            <Text style={styles.headerTitle}>Rebel Gpt</Text>
            <Text style={styles.headerSub}>{loading ? '● Thinking...' : '● Online'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={confirmClear} style={styles.clearBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.clearTxt}>🗑</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={loading ? <TypingDots /> : null}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Image preview */}
      {image && (
        <View style={styles.imgPreview}>
          <Image source={{ uri: image.uri }} style={styles.previewImg} />
          <TouchableOpacity onPress={() => setImage(null)} style={styles.removeImg}>
            <Text style={{ color: Colors.white, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity onPress={pickImage} style={styles.attachBtn} activeOpacity={0.7}>
          <Text style={styles.attachIcon}>📎</Text>
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          placeholder="Message Rebel Gpt..."
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={4000}
          returnKeyType="default"
        />
        <Animated.View style={{ transform: [{ scale: sendScale }] }}>
          <TouchableOpacity
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!canSend}
            activeOpacity={0.82}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.glow,
  },
  avatarText: { color: Colors.white, fontSize: 18, fontWeight: '900' },
  headerTitle: { color: Colors.white, fontSize: Fonts.size.md, fontWeight: '700' },
  headerSub: { color: Colors.success, fontSize: Fonts.size.xs, marginTop: 1 },
  clearBtn: { padding: 6 },
  clearTxt: { fontSize: 18 },
  list: { padding: 16, paddingBottom: 8 },
  imgPreview: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8,
  },
  previewImg: { width: 56, height: 56, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  removeImg: {
    marginLeft: 8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center',
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    borderTopWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard, gap: 10,
  },
  attachBtn: { padding: 8, justifyContent: 'center' },
  attachIcon: { fontSize: 22 },
  textInput: {
    flex: 1, backgroundColor: Colors.bgInput, borderRadius: Radius.xl,
    paddingHorizontal: 16, paddingVertical: 12,
    color: Colors.text, fontSize: Fonts.size.md,
    maxHeight: 140, borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    ...Shadow.glow,
  },
  sendBtnDisabled: { backgroundColor: Colors.bgInput, shadowOpacity: 0 },
  sendIcon: { color: Colors.white, fontSize: 20, fontWeight: '900' },
});
