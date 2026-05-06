import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, StatusBar, TextInput, Share, Clipboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { DrawerContext } from '../navigation';
import { Colors, Fonts, Radius } from '../theme';
import { getChatHistory, clearChatHistory, getCurrentUser } from '../utils/storage';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const drawer = React.useContext(DrawerContext);
  const [history, setHistory] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useFocusEffect(useCallback(() => {
    (async () => {
      const cu = await getCurrentUser();
      setUser(cu);
      const h = await getChatHistory(cu?.email || 'guest');
      const rev = h.slice().reverse();
      setHistory(rev);
      setFiltered(rev);
    })();
  }, []));

  function applyFilter(text, filter) {
    let base = history;
    if (filter === 'user') base = history.filter(m => m.role === 'user');
    else if (filter === 'ai') base = history.filter(m => m.role === 'assistant');
    if (text.trim()) {
      base = base.filter(m => m.content?.toLowerCase().includes(text.toLowerCase()));
    }
    setFiltered(base);
  }

  function onSearch(text) {
    setSearch(text);
    applyFilter(text, activeFilter);
  }

  function setFilter(f) {
    setActiveFilter(f);
    applyFilter(search, f);
  }

  function confirmClear() {
    Alert.alert('Clear History', 'All messages will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All', style: 'destructive', onPress: async () => {
          await clearChatHistory(user?.email || 'guest');
          setHistory([]); setFiltered([]);
        },
      },
    ]);
  }

  function handleLongPress(item) {
    Alert.alert('Message Options', '', [
      { text: '📋 Copy', onPress: () => Clipboard.setString(item.content) },
      { text: '🔗 Share', onPress: () => Share.share({ message: item.content }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'user', label: 'Mine' },
    { key: 'ai', label: 'AI' },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      {/* Header */}
      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          {/* Hamburger */}
          <TouchableOpacity onPress={() => drawer.open()} style={styles.hamBtn} activeOpacity={0.7} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
            <View style={styles.hamLine} /><View style={[styles.hamLine,{width:18}]} /><View style={styles.hamLine} />
          </TouchableOpacity>
          <View style={{ flex:1, flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginLeft:10 }}>
            <View>
              <Text style={styles.title}>Chat <Text style={{ color: Colors.teal }}>History</Text></Text>
              <Text style={styles.subtitle}>{filtered.length} of {history.length} messages</Text>
            </View>
            {history.length > 0 && (
              <TouchableOpacity onPress={confirmClear} style={styles.clearBtn} activeOpacity={0.75}>
                <Text style={styles.clearTxt}>🗑 Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerLine} />
      </View>

      {/* Search bar */}
      {history.length > 0 && (
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search messages..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={onSearch}
            />
            {!!search && (
              <TouchableOpacity onPress={() => onSearch('')}>
                <Text style={styles.clearSearch}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Filter chips */}
          <View style={styles.filterRow}>
            {FILTERS.map(f => (
              <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} activeOpacity={0.8}>
                {activeFilter === f.key ? (
                  <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.filterChipActive}>
                    <Text style={styles.filterChipTextActive}>{f.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.filterChip}>
                    <Text style={styles.filterChipText}>{f.label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <LinearGradient colors={['#8a2be2', '#00ced1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyCircle}>
            <Text style={{ fontSize: 28 }}>{search ? '🔍' : '💬'}</Text>
          </LinearGradient>
          <Text style={styles.emptyTitle}>{search ? 'No results found' : 'No messages yet'}</Text>
          <Text style={styles.emptySub}>{search ? 'Try a different keyword' : 'Start chatting with Rebel Gpt!'}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(_, i) => i.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onLongPress={() => handleLongPress(item)}
              activeOpacity={0.88}
            >
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
            </TouchableOpacity>
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
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14,
  },
  hamBtn: { padding: 4, gap: 5, justifyContent: 'center' },
  hamLine: { width: 22, height: 2.5, backgroundColor: Colors.text, borderRadius: 2 },
  headerLine: { height: 2 },
  title: { color: Colors.text, fontSize: Fonts.size.xl, fontWeight: '800' },
  subtitle: { color: Colors.textMuted, fontSize: Fonts.size.xs, marginTop: 3 },
  clearBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: Radius.full,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  clearTxt: { color: Colors.error, fontSize: Fonts.size.sm, fontWeight: '600' },

  searchRow: { padding: 14, gap: 10, backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderColor: 'rgba(138,43,226,0.15)' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgInput, borderRadius: 14, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(138,43,226,0.2)',
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text, fontSize: Fonts.size.sm, paddingVertical: 10 },
  clearSearch: { color: Colors.textMuted, fontSize: 14, paddingHorizontal: 4 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  filterChipText: { color: Colors.textSecondary, fontSize: Fonts.size.xs, fontWeight: '600' },
  filterChipTextActive: { color: '#fff', fontSize: Fonts.size.xs, fontWeight: '700' },

  list: { padding: 14, gap: 10 },
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
  emptyCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: Colors.text, fontSize: Fonts.size.lg, fontWeight: '700' },
  emptySub: { color: Colors.textSecondary, fontSize: Fonts.size.sm, textAlign: 'center' },
});
