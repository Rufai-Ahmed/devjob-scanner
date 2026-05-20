// Background task must be imported first so TaskManager.defineTask runs at module init
import "./src/services/backgroundTask";

import React, { useEffect } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import {
  useFonts,
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from "@expo-google-fonts/space-mono";
import AppNavigator, { navigationRef } from "./src/navigation";
import { requestNotificationPermissions } from "./src/services/notificationService";
import { registerBackgroundTask } from "./src/services/backgroundTask";
import { getSettings } from "./src/services/storageService";
import { Colors } from "./src/constants/colors";
import { SERVER_URL } from "./src/constants/server";
import { RedditPost } from "./src/types";

export default function App() {
  const [fontsLoaded] = useFonts({ SpaceMono_400Regular, SpaceMono_700Bold });

  // Handles cold-start tap (app was closed when notification arrived)
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (lastResponse)
      navigateToPost(lastResponse.notification.request.content.data);
  }, [lastResponse]);

  useEffect(() => {
    async function checkForUpdate() {
      if (__DEV__) return;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;
        await Updates.fetchUpdateAsync();
        Alert.alert(
          "Update ready",
          "A new version has been downloaded. Restart now to apply it.",
          [
            { text: "Later", style: "cancel" },
            { text: "Restart", onPress: () => Updates.reloadAsync() },
          ]
        );
      } catch {}
    }
    checkForUpdate();
  }, []);

  useEffect(() => {
    async function init() {
      await requestNotificationPermissions();
      const settings = await getSettings();
      await registerBackgroundTask(settings.fetchInterval);
      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync();
        await fetch(`${SERVER_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      } catch {}
    }
    init();

    // Handles tap while app is backgrounded or foregrounded
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        navigateToPost(response.notification.request.content.data);
      },
    );

    return () => sub.remove();
  }, []);

  function navigateToPost(data: Record<string, unknown>) {
    if (!data?.post) return;
    try {
      const post = JSON.parse(data.post as string) as RedditPost;
      // Wait for nav container to be ready
      const tryNav = () => {
        if (navigationRef.isReady()) {
          navigationRef.navigate("Feed", {
            screen: "PostDetail",
            params: { post },
          } as any);
        } else {
          setTimeout(tryNav, 100);
        }
      };
      tryNav();
    } catch {}
  }

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
