import React, { useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

import SplashScreen   from '../screens/SplashScreen';
import AuthScreen     from '../screens/AuthScreen';
import ChatScreen     from '../screens/ChatScreen';
import VoiceScreen    from '../screens/VoiceScreen';
import HistoryScreen  from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { Colors, Fonts } from '../theme';

const Stack = createStackNavigator();
const { width: SW } = Dimensions.get('window');
const DRAWER_W = SW * 0.72;

// ── Drawer Context ────────────────────────────────────────
export const DrawerContext = React.createContext({ open: () => {}, close: () => {} });

// ── Drawer content ────────────────────────────────────────
function DrawerContent({ navigation, closeDrawer, currentRoute, insets }) {
  const items = [
    { name: 'Chat',     icon: '💬', label: 'Chat' },
    { name: 'Voice',    icon: '🎙',  label: 'Voice Assistant' },
    { name: 'History',  icon: '📜',  label: 'History' },
    { name: 'Settings', icon: '⚙️',  label: 'Settings' },
  ];

  return (
    <View style={[drawerStyles.root, { paddingTop: insets.top + 16 }]}>
      {/* Logo */}
      <View style={drawerStyles.logoRow}>
        <LinearGradient colors={['#8a2be2','#00ced1']} start={{ x:0, y:0 }} end={{ x:1, y:1 }} style={drawerStyles.logoCircle}>
          <Text style={drawerStyles.logoText}>R</Text>
        </LinearGradient>
        <View>
          <Text style={drawerStyles.appName}>Rebel <Text style={{ color: Colors.teal }}>AI</Text></Text>
          <Text style={drawerStyles.appSub}>Unleash the Code.</Text>
        </View>
      </View>

      {/* Gradient divider */}
      <LinearGradient colors={['#8a2be2','#00ced1']} start={{ x:0, y:0 }} end={{ x:1, y:0 }} style={drawerStyles.divider} />

      {/* Nav items */}
      <View style={drawerStyles.navList}>
        {items.map(item => {
          const isActive = currentRoute === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              style={[drawerStyles.navItem, isActive && drawerStyles.navItemActive]}
              onPress={() => { closeDrawer(); navigation.navigate(item.name); }}
              activeOpacity={0.75}
            >
              {isActive ? (
                <LinearGradient
                  colors={['rgba(138,43,226,0.22)','rgba(0,206,209,0.12)']}
                  start={{ x:0, y:0 }} end={{ x:1, y:0 }}
                  style={drawerStyles.navItemGrad}
                >
                  <Text style={drawerStyles.navIcon}>{item.icon}</Text>
                  <Text style={[drawerStyles.navLabel, drawerStyles.navLabelActive]}>{item.label}</Text>
                  {/* Active indicator bar */}
                  <View style={drawerStyles.activeBar} />
                </LinearGradient>
              ) : (
                <View style={drawerStyles.navItemInner}>
                  <Text style={[drawerStyles.navIcon, { opacity: 0.6 }]}>{item.icon}</Text>
                  <Text style={drawerStyles.navLabel}>{item.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bottom version */}
      <View style={[drawerStyles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <LinearGradient colors={['#8a2be2','#00ced1']} start={{ x:0, y:0 }} end={{ x:1, y:0 }} style={drawerStyles.divider} />
        <Text style={drawerStyles.footerText}>Rebel AI v1.0 · Built by Rebel Bhaiya</Text>
      </View>
    </View>
  );
}

// ── Custom Drawer wrapper ─────────────────────────────────
function DrawerNavigator({ children, navigation, currentRoute }) {
  const insets = useSafeAreaInsets();
  const slideX  = useRef(new Animated.Value(-DRAWER_W)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const isOpen  = useRef(false);

  function openDrawer() {
    isOpen.current = true;
    Animated.parallel([
      Animated.spring(slideX, { toValue: 0, friction: 8, tension: 65, useNativeDriver: true }),
      Animated.timing(bgOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }

  function closeDrawer() {
    Animated.parallel([
      Animated.timing(slideX, { toValue: -DRAWER_W, duration: 220, useNativeDriver: true }),
      Animated.timing(bgOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { isOpen.current = false; });
  }

  return (
    <DrawerContext.Provider value={{ open: openDrawer, close: closeDrawer }}>
      <View style={{ flex: 1 }}>
        {children}

        {/* Backdrop */}
        <Animated.View
          style={[drawerStyles.backdrop, { opacity: bgOpacity }]}
          pointerEvents="none"
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={closeDrawer} activeOpacity={1} />
        </Animated.View>

        {/* Drawer panel */}
        <Animated.View style={[drawerStyles.drawer, { transform: [{ translateX: slideX }] }]}>
          <DrawerContent
            navigation={navigation}
            closeDrawer={closeDrawer}
            currentRoute={currentRoute}
            insets={insets}
          />
        </Animated.View>
      </View>
    </DrawerContext.Provider>
  );
}

// ── Main App stack ────────────────────────────────────────
function MainApp({ navigation }) {
  const [currentRoute, setCurrentRoute] = React.useState('Chat');
  const Stack2 = createStackNavigator();

  return (
    <DrawerNavigator navigation={navigation} currentRoute={currentRoute}>
      <Stack2.Navigator
        screenOptions={{ headerShown: false }}
        screenListeners={{ state: e => {
          const routes = e.data?.state?.routes;
          if (routes?.length) setCurrentRoute(routes[routes.length - 1].name);
        }}}
      >
        <Stack2.Screen name="Chat"     component={ChatScreen} />
        <Stack2.Screen name="Voice"    component={VoiceScreen} />
        <Stack2.Screen name="History"  component={HistoryScreen} />
        <Stack2.Screen name="Settings" component={SettingsScreen} />
      </Stack2.Navigator>
    </DrawerNavigator>
  );
}

export default function AppNavigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyleInterpolator: ({ current }) => ({ cardStyle: { opacity: current.progress } }),
          transitionSpec: {
            open:  { animation: 'timing', config: { duration: 280 } },
            close: { animation: 'timing', config: { duration: 220 } },
          },
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Auth"   component={AuthScreen} />
        <Stack.Screen name="Main"   component={MainApp} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const drawerStyles = StyleSheet.create({
  // Drawer panel
  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: DRAWER_W, backgroundColor: '#1a1a1a',
    zIndex: 999,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 20,
  },
  root: { flex: 1, paddingHorizontal: 16 },

  // Backdrop
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 998,
  },

  // Logo
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  logoCircle: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  appName: { color: Colors.text, fontSize: Fonts.size.lg, fontWeight: '800' },
  appSub: { color: Colors.textMuted, fontSize: Fonts.size.xs, marginTop: 2 },

  // Divider
  divider: { height: 1.5, borderRadius: 2, marginBottom: 16, opacity: 0.6 },

  // Nav items
  navList: { gap: 4 },
  navItem: { borderRadius: 14, overflow: 'hidden' },
  navItemActive: {},
  navItemGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14,
    position: 'relative',
  },
  navItemInner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  navIcon: { fontSize: 20, width: 26, textAlign: 'center' },
  navLabel: { color: Colors.textSecondary, fontSize: Fonts.size.md, fontWeight: '500', flex: 1 },
  navLabelActive: { color: Colors.text, fontWeight: '700' },
  activeBar: {
    position: 'absolute', right: 0, top: '20%', bottom: '20%',
    width: 3, borderRadius: 2, backgroundColor: Colors.teal,
  },

  // Footer
  footer: { marginTop: 'auto', paddingTop: 16 },
  footerText: { color: Colors.textMuted, fontSize: Fonts.size.xs, textAlign: 'center', marginTop: 10 },
});
