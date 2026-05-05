import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Fonts, Radius } from '../theme';
import { getChatHistory, clearChatHistory, getCurrentUser } from '../utils/storage';

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      const cu = await getCurrentUser();
      setUser(cu);
      const h = await getChatHistory(cu?.email || 'guest');
      setHistory(h.slice().reverse());
    })();
  }, []));

  function confirmClear() {
    Alert.alert('Clear History', 'All messages will be deleted permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All', style: 'destructive', onPress: async () => {
          await clearChatHistory(user?.email || 'guest');
          setHistory([]);
        },
      },
    ]);
  }

  function roleIcon(role) { return role === 'user' ? '👤' : '🤖'; }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Chat History</Text>
        {history.length > 0 && (
          <TouchableOpacity onPress={confirmClear} style={styles.clearBtn} activeOpacity={0.7}>
            <Text style={styles.clearTxt}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySub}>Start chatting with Rebel Gpt!</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(_, i) => i.toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.item, item.role === 'user' ? styles.itemUser : styles.itemBot]}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemRole}>{roleIcon(item.role)} {item.role === 'user' ? 'You' : 'Rebel Gpt'}</Text>
                {item.ts && <Text style={styles.itemTime}>{formatTime(item.ts)}</Text>}
              </View>
              <Text style={styles.itemContent} numberOfLines={3}>{item.content}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 18, paddingTop: 14, borderBottomWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  title: { color: Colors.white, fontSize: Fonts.size.lg, fontWeight: '700' },
  clearBtn: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: Radius.full, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  clearTxt: { color: Colors.error, fontSize: Fonts.size.sm, fontWeight: '600' },
  list: { padding: 16, gap: 10 },
  item: {
    borderRadius: Radius.md, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  itemUser: { backgroundColor: 'rgba(124,58,237,0.1)' },
  itemBot: { backgroundColor: Colors.bgCard },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemRole: { color: Colors.accent, fontSize: Fonts.size.xs, fontWeight: '700' },
  itemTime: { color: Colors.textMuted, fontSize: Fonts.size.xs },
  itemContent: { color: Colors.text, fontSize: Fonts.size.sm, lineHeight: 19 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { color: Colors.text, fontSize: Fonts.size.lg, fontWeight: '700' },
  emptySub: { color: Colors.textSecondary, fontSize: Fonts.size.sm },
});
