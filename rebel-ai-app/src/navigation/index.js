import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import ChatScreen from '../screens/ChatScreen';
import VoiceScreen from '../screens/VoiceScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createStackNavigator();

const fade = ({ current }) => ({
  cardStyle: { opacity: current.progress },
});

const slideUp = ({ current, layouts }) => ({
  cardStyle: {
    transform: [{
      translateY: current.progress.interpolate({
        inputRange: [0, 1], outputRange: [layouts.screen.height, 0],
      }),
    }],
  },
});

export default function AppNavigation() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName="Splash"
      >
        <Stack.Screen name="Splash" component={SplashScreen}
          options={{ cardStyleInterpolator: fade, gestureEnabled: false }} />
        <Stack.Screen name="Auth" component={AuthScreen}
          options={{ cardStyleInterpolator: fade, gestureEnabled: false }} />
        {/* Main app — Home is the conversations list */}
        <Stack.Screen name="Main" component={HomeScreen}
          options={{ cardStyleInterpolator: fade, gestureEnabled: false }} />
        {/* Chat opens from Home */}
        <Stack.Screen name="Chat" component={ChatScreen}
          options={{
            cardStyleInterpolator: ({ current, layouts }) => ({
              cardStyle: {
                transform: [{
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1], outputRange: [layouts.screen.width, 0],
                  }),
                }],
              },
            }),
            gestureEnabled: true,
            gestureDirection: 'horizontal',
          }} />
        {/* Voice mode — slides up from bottom */}
        <Stack.Screen name="Voice" component={VoiceScreen}
          options={{ cardStyleInterpolator: slideUp, gestureEnabled: true, gestureDirection: 'vertical' }} />
        <Stack.Screen name="Settings" component={SettingsScreen}
          options={{
            cardStyleInterpolator: ({ current, layouts }) => ({
              cardStyle: {
                transform: [{
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1], outputRange: [layouts.screen.width, 0],
                  }),
                }],
              },
            }),
            gestureEnabled: true,
            gestureDirection: 'horizontal',
          }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
