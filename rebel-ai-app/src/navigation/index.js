import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';

import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import ChatScreen from '../screens/ChatScreen';
import VoiceScreen from '../screens/VoiceScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { Colors, Fonts } from '../theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ emoji, label, focused }) {
  return (
    <View style={[tabStyles.iconWrap, focused && tabStyles.iconFocused]}>
      <Text style={tabStyles.emoji}>{emoji}</Text>
      <Text style={[tabStyles.label, focused && tabStyles.labelFocused]}>{label}</Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabStyles.bar,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💬" label="Chat" focused={focused} /> }}
      />
      <Tab.Screen
        name="Voice"
        component={VoiceScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🎙" label="Voice" focused={focused} /> }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📜" label="History" focused={focused} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" label="Settings" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: true }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.bgCard,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 68,
    paddingBottom: 8,
  },
  iconWrap: { alignItems: 'center', paddingTop: 6, paddingHorizontal: 12, borderRadius: 12, gap: 2 },
  iconFocused: { backgroundColor: Colors.accentGlow },
  emoji: { fontSize: 22 },
  label: { fontSize: Fonts.size.xs, color: Colors.textMuted, marginTop: 2 },
  labelFocused: { color: Colors.accentLight, fontWeight: '700' },
});
