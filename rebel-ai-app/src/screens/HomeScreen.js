// ChatGPT-style conversations list (left sidebar / home screen)
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, TextInput, Animated, StatusBar, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Fonts, Radius } from '../theme';
import {
  getConversations, createConversation, deleteConversation,
  deleteAllConversations, groupByDate, updateConversationTitle,
} from '../utils/conversations';
import { getCurrentUser } from '../utils/storage';

export default function HomeScreen({ navigation }) {
  const [groups, setGroups] = useState([]);
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [allConvs, setAllConvs] = useState([]);
  const [renaming, setRenaming] = useState(null);
  const [renameText, setRenameText] = useState('');

  useFocusEffect(useCallback(() => {
    (async () => {
      const [cu, convs] = await Promise.all([getCurrentUser(), getConversations()]);
      setUser(cu);
      setAllConvs(convs);
      setGroups(groupByDate(convs));
    })();
  }, []));

  function filterConvs(text) {
    setSearch(text);
    if (!text.trim()) {
      setGroups(groupByDate(allConvs));
    } else {
      const f = allConvs.filter(c => c.title.toLowerCase().includes(text.toLowerCase()));
      setGroups(f.length ? [['Results', f]] : []);
    }
  }

  async function startNewChat() {
    const conv = await createConversation('New Chat');
    navigation.navigate('Chat', { convId: conv.id, convTitle: conv.title });
  }

  function openChat(conv) {
    navigation.navigate('Chat', { convId: conv.id, convTitle: conv.title });
  }

  function handleLongPress(conv) {
    Alert.alert(conv.title.slice(0, 30), '', [
      { text: '✏️ Rename', onPress: () => { setRenaming(conv.id); setRenameText(conv.title); } },
      {
        text: '🗑 Delete', style: 'destructive', onPress: () => {
          Alert.alert('Delete Chat', 'Delete this conversation?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive', onPress: async () => {
                await deleteConversation(conv.id);
                const updated = allConvs.filter(c => c.id !== conv.id);
                setAllConvs(updated);
                setGroups(groupByDate(updated));
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function submitRename() {
    if (!renameText.trim() || !renaming) { setRenaming(null); return; }
    await updateConversationTitle(renaming, renameText.trim());
    const updated = allConvs.map(c => c.id === renaming ? { ...c, title: renameText.trim() } : c);
    setAllConvs(updated);
    setGroups(groupByDate(updated));
    setRenaming(null);
  }

  function confirmDeleteAll() {
    Alert.alert('Delete All Chats', 'This will permanently delete all conversations.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All', style: 'destructive', onPress: async () => {
          await deleteAllConversations();
          setAllConvs([]); setGroups([]);
        },
      },
    ]);
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }

  const renderConv = ({ item: conv }) => (
    renaming === conv.id ? (
      <View style={styles.renameRow}>
        <TextInput
          style={styles.renameInput}
          value={renameText}
          onChangeText={setRenameText}
          autoFocus
          onSubmitEditing={submitRename}
          onBlur={submitRename}
          returnKeyType="done"
        />
      </View>
    ) : (
      <TouchableOpacity
        style={styles.convItem}
        onPress={() => openChat(conv)}
        onLongPress={() => handleLongPress(conv)}
        activeOpacity={0.7}
      >
        <View style={styles.convIcon}>
          <Text style={styles.convIconText}>💬</Text>
        </View>
        <View style={styles.convInfo}>
          <Text style={styles.convTitle} numberOfLines={1}>{conv.title}</Text>
          <Text style={styles.convTime}>{formatTime(conv.updatedAt)}</Text>
        </View>
      </TouchableOpacity>
    )
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bgSidebar} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.logoRow}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>R</Text>
            </View>
            <Text style={styles.appName}>Rebel AI</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => navigation.navigate('Voice')} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.headerBtnText}>🎙</Text>
            </TouchableOpacity>
            {allConvs.length > 0 && (
              <TouchableOpacity onPress={confirmDeleteAll} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.headerBtnText}>🗑</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={filterConvs}
          />
          {!!search && (
            <TouchableOpacity onPress={() => filterConvs('')}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* New Chat button — ChatGPT style */}
      <TouchableOpacity style={styles.newChatBtn} onPress={startNewChat} activeOpacity={0.8}>
        <View style={styles.newChatInner}>
          <Text style={styles.newChatPlus}>+</Text>
          <Text style={styles.newChatText}>New chat</Text>
        </View>
      </TouchableOpacity>

      {/* Conversation list */}
      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySub}>Tap "New chat" to start</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={([label]) => label}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item: [label, convs] }) => (
            <View>
              <Text style={styles.groupLabel}>{label}</Text>
              {convs.map(conv => (
                <View key={conv.id}>
                  {renderConv({ item: conv })}
                </View>
              ))}
            </View>
          )}
        />
      )}

      {/* User info */}
      {user && (
        <TouchableOpacity
          style={styles.userBar}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.8}
        >
          <View style={styles.userAvatarCircle}>
            <Text style={styles.userAvatarText}>{user.name?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
          </View>
          <Text style={styles.userSettingsIcon}>⚙️</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgSidebar },

  header: { paddingTop: Platform.OS === 'android' ? 14 : 10, paddingHorizontal: 14, paddingBottom: 10 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  appName: { color: Colors.text, fontSize: Fonts.size.lg, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { fontSize: 16 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text, fontSize: Fonts.size.sm, paddingVertical: 10 },
  searchClear: { color: Colors.textMuted, fontSize: 14, padding: 4 },

  newChatBtn: { marginHorizontal: 14, marginBottom: 4 },
  newChatInner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  newChatPlus: { color: Colors.accent, fontSize: 22, fontWeight: '300', lineHeight: 22 },
  newChatText: { color: Colors.text, fontSize: Fonts.size.md, fontWeight: '500' },

  list: { paddingHorizontal: 8, paddingBottom: 12 },
  groupLabel: { color: Colors.textMuted, fontSize: Fonts.size.xs, fontWeight: '600', paddingHorizontal: 8, paddingTop: 14, paddingBottom: 4, textTransform: 'none', letterSpacing: 0 },
  convItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, paddingVertical: 10,
    borderRadius: Radius.md,
  },
  convIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  convIconText: { fontSize: 16 },
  convInfo: { flex: 1 },
  convTitle: { color: Colors.text, fontSize: Fonts.size.sm, fontWeight: '400' },
  convTime: { color: Colors.textMuted, fontSize: Fonts.size.xs, marginTop: 1 },

  renameRow: { paddingHorizontal: 10, paddingVertical: 6 },
  renameInput: {
    backgroundColor: Colors.bgInput, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 9,
    color: Colors.text, fontSize: Fonts.size.sm,
    borderWidth: 1, borderColor: Colors.accent,
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyIcon: { fontSize: 44, marginBottom: 4 },
  emptyTitle: { color: Colors.text, fontSize: Fonts.size.md, fontWeight: '600' },
  emptySub: { color: Colors.textSecondary, fontSize: Fonts.size.sm },

  userBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderTopWidth: 1, borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgSidebar,
  },
  userAvatarCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { color: Colors.text, fontSize: Fonts.size.sm, fontWeight: '600' },
  userEmail: { color: Colors.textMuted, fontSize: Fonts.size.xs },
  userSettingsIcon: { fontSize: 18 },
});
