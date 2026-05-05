import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import ChatScreen from '../screens/ChatScreen';
import VoiceScreen from '../screens/VoiceScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { Colors, Fonts } from '../theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Custom tab bar — matches website's design language
function CustomTabBar({ state, descriptors, navigation }) {
  return (
    <View style={tabStyles.container}>
      <LinearGradient
        colors={['rgba(18,18,18,0.98)', 'rgba(18,18,18,1)']}
        style={tabStyles.bar}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const icons = { Chat: '💬', Voice: '🎙', History: '📜', Settings: '⚙️' };
          const labels = { Chat: 'Chat', Voice: 'Voice', History: 'History', Settings: 'Settings' };

          return (
            <TouchableOpacity
              key={route.key}
              style={tabStyles.tab}
              onPress={() => {
                if (!isFocused) navigation.navigate(route.name);
              }}
              activeOpacity={0.8}
            >
              {isFocused ? (
                <LinearGradient
                  colors={['rgba(138,43,226,0.18)', 'rgba(0,206,209,0.12)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={tabStyles.activeWrap}
                >
                  <Text style={tabStyles.icon}>{icons[route.name]}</Text>
                  <Text style={[tabStyles.label, tabStyles.labelActive]}>{labels[route.name]}</Text>
                </LinearGradient>
              ) : (
                <View style={tabStyles.inactiveWrap}>
                  <Text style={[tabStyles.icon, tabStyles.iconInactive]}>{icons[route.name]}</Text>
                  <Text style={tabStyles.label}>{labels[route.name]}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </LinearGradient>
      {/* Gradient top border matching website's purple→teal */}
      <LinearGradient
        colors={['#8a2be2', '#00ced1']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={tabStyles.topBorder}
        pointerEvents="none"
      />
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Voice" component={VoiceScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyleInterpolator: ({ current, layouts }) => ({
            cardStyle: {
              opacity: current.progress,
            },
          }),
          transitionSpec: {
            open: { animation: 'timing', config: { duration: 280 } },
            close: { animation: 'timing', config: { duration: 220 } },
          },
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const tabStyles = StyleSheet.create({
  container: { position: 'relative' },
  bar: {
    flexDirection: 'row',
    paddingBottom: 12, paddingTop: 6,
    paddingHorizontal: 8,
  },
  topBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  activeWrap: {
    alignItems: 'center', paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 14, gap: 3,
  },
  inactiveWrap: { alignItems: 'center', paddingVertical: 7, paddingHorizontal: 12, gap: 3 },
  icon: { fontSize: 20 },
  iconInactive: { opacity: 0.65 },
  label: { fontSize: Fonts.size.xs, color: Colors.textMuted, fontWeight: '500' },
  labelActive: { color: Colors.teal, fontWeight: '700' },
});
