import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { RootTabParamList, FeedStackParamList } from '../types';
import FeedScreen from '../screens/FeedScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';

export const navigationRef = createNavigationContainerRef<RootTabParamList>();

const Tab = createBottomTabNavigator<RootTabParamList>();
const FeedStack = createNativeStackNavigator<FeedStackParamList>();

function FeedStackNavigator() {
  return (
    <FeedStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontFamily: 'SpaceMono_700Bold', fontSize: 14 },
        contentStyle: { backgroundColor: Colors.background },
        headerShadowVisible: false,
      }}
    >
      <FeedStack.Screen name="FeedList" component={FeedScreen} options={{ headerShown: false }} />
      <FeedStack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{ title: 'Post Details', headerBackButtonDisplayMode: 'minimal' }}
      />
    </FeedStack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            paddingBottom: 6,
            height: 62,
          },
          tabBarActiveTintColor: Colors.accent,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarLabelStyle: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, marginTop: -2 },
          tabBarIcon: ({ focused, color, size }) => {
            const icons: Record<string, [string, string]> = {
              Feed: ['briefcase', 'briefcase-outline'],
              Settings: ['settings', 'settings-outline'],
            };
            const [active, inactive] = icons[route.name] ?? ['apps', 'apps-outline'];
            return <Ionicons name={(focused ? active : inactive) as any} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Feed" component={FeedStackNavigator} options={{ title: 'Jobs' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
