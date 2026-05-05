import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
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
    Alert.alert('Clear History', 'All messages will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All', style: 'destructive', onPress: async () => {
          await clearChatHistory(user?.email || 'guest');
          setHistory([]);
        },
      },
    ]);
  }

  function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* Header with gradient border bottom */}
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Chat <Text style={{ color: Colors.teal }}>History</Text></Text>
            <Text style={styles.subtitle}>{history.length} message{history.length !== 1 ? 's' : ''}</Text>
          </View>
          {history.length > 0 && (
            <TouchableOpacity onPress={confirmClear} style={styles.clearBtn} activeOpacity={0.75}>
              <Text style={styles.clearTxt}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
        <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerLine} />
      </View>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyIconCircle}>
              <Text style={{ fontSize: 30 }}>💬</Text>
            </LinearGradient>
          </View>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySub}>Start chatting with Rebel Gpt to see history here</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(_, i) => i.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[styles.item, item.role === 'user' ? styles.itemUser : styles.itemBot]}>
              <View style={styles.itemHeader}>
                <View style={styles.roleRow}>
                  <View style={[styles.roleDot, { backgroundColor: item.role === 'user' ? Colors.purple : Colors.teal }]} />
                  <Text style={[styles.itemRole, { color: item.role === 'user' ? Colors.purple : Colors.teal }]}>
                    {item.role === 'user' ? 'You' : 'Rebel Gpt'}
                  </Text>
                </View>
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
  headerWrap: { backgroundColor: Colors.bgCard },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14,
  },
  headerLine: { height: 2 },
  title: { color: Colors.text, fontSize: Fonts.size.xl, fontWeight: '800' },
  subtitle: { color: Colors.textMuted, fontSize: Fonts.size.xs, marginTop: 3 },
  clearBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  clearTxt: { color: Colors.error, fontSize: Fonts.size.sm, fontWeight: '600' },
  list: { padding: 16, gap: 10 },
  item: { borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(138,43,226,0.15)' },
  itemUser: { backgroundColor: 'rgba(138,43,226,0.08)' },
  itemBot: { backgroundColor: Colors.bgCard },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roleDot: { width: 7, height: 7, borderRadius: 4 },
  itemRole: { fontSize: Fonts.size.xs, fontWeight: '700', letterSpacing: 0.5 },
  itemTime: { color: Colors.textMuted, fontSize: Fonts.size.xs },
  itemContent: { color: Colors.textSecondary, fontSize: Fonts.size.sm, lineHeight: 19 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  emptyIconWrap: { marginBottom: 4 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: Colors.text, fontSize: Fonts.size.lg, fontWeight: '700' },
  emptySub: { color: Colors.textSecondary, fontSize: Fonts.size.sm, textAlign: 'center', lineHeight: 20 },
});
