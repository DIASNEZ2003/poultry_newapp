import { useRouter } from "expo-router";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { get, getDatabase, ref } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "./firebaseConfig";

export default function Login() {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // This controls the "Splash Screen" while checking for saved user
  const [initialCheck, setInitialCheck] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const router = useRouter();
  const db = getDatabase();

  // Helper function to route based on role
  const routeUserByRole = async (uid: string) => {
    try {
      const userRef = ref(db, `users/${uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        const role = userData.role?.toLowerCase() || "user"; // default to user/tech if missing

        if (role === "personnel") {
          console.log("Routing Personnel to Home...");
          router.replace("/home");
        } else if (role === "user" || role === "technician") {
          console.log("Routing Technician to TechHome...");
          router.replace("/techhome");
        } else {
          // Fallback for Admin or unknown roles
          console.log("Routing Admin/Other to Home...");
          router.replace("/home");
        }
      } else {
        // If user document doesn't exist in DB, fallback to techhome or show error
        console.log("User data not found in DB.");
        Alert.alert("Error", "User profile not found.");
        setInitialCheck(false);
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
      Alert.alert("Error", "Could not verify user role.");
      setInitialCheck(false);
    }
  };

  // ---------------------------------------------------------
  // AUTO LOGIN LOGIC
  // ---------------------------------------------------------
  useEffect(() => {
    // This listener fires immediately when the app loads
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("User found! Auto-logging in:", user.uid);
        // User is saved in storage -> Check role and route
        routeUserByRole(user.uid);
      } else {
        console.log("No user found. Showing login screen.");
        // No user saved -> Stop loading and show Login Screen
        setInitialCheck(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Required", "Please enter both username and password");
      return;
    }

    setLoading(true);
    const email = `${username.trim().toLowerCase()}@poultry.com`;

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      // Do NOT use router.replace here!
      // The onAuthStateChanged useEffect will automatically trigger when sign in succeeds,
      // and it will handle the database check and routing.
    } catch (error: any) {
      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        Alert.alert("Login Failed", "Incorrect credentials.");
      } else if (error.code === "auth/too-many-requests") {
        Alert.alert("Blocked", "Too many failed attempts. Try again later.");
      } else {
        Alert.alert("Connection Error", "Ensure internet connection.");
      }
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // 1. LOADING SCREEN (Seen briefly on app open)
  // ---------------------------------------------------------
  if (initialCheck) {
    return (
      <View className="flex-1 bg-red-900 justify-center items-center">
        <ActivityIndicator size="large" color="#ffffff" />
        <Text className="text-white text-xs mt-4 font-bold tracking-widest uppercase">
          Verifying Session...
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------
  // 2. LOGIN SCREEN (Maroon Box Design)
  // ---------------------------------------------------------
  return (
    <View className="flex-1">
      <StatusBar barStyle="light-content" />

      {/* BACKGROUND IMAGE WITH MAROON OVERLAY */}
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?q=80&w=1350&auto=format&fit=crop",
        }}
        className="flex-1 justify-center"
        resizeMode="cover"
      >
        {/* The Maroon Overlay */}
        <View className="absolute inset-0 bg-red-950/85" />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-center px-8"
        >
          {/* HEADER */}
          <View className="mb-10 items-center">
            <Text className="text-white text-4xl font-bold tracking-wider mb-2">
              Login
            </Text>
            <Text className="text-red-200 text-sm">
              Sign in to your dashboard
            </Text>
          </View>

          {/* FORM */}
          <View className="w-full">
            {/* USERNAME */}
            <Text className="text-gray-200 font-medium mb-2 ml-1 text-sm">
              Username
            </Text>
            <TextInput
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white text-base mb-5 placeholder:text-gray-400"
              placeholder="Enter your username"
              placeholderTextColor="#a1a1aa"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />

            {/* PASSWORD */}
            <Text className="text-gray-200 font-medium mb-2 ml-1 text-sm">
              Password
            </Text>
            <View className="flex-row items-center w-full bg-white/10 border border-white/20 rounded-xl px-4 mb-2">
              <TextInput
                className="flex-1 py-4 text-white text-base"
                placeholder="••••••••"
                placeholderTextColor="#a1a1aa"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              {/* Text Toggle for Show/Hide */}
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="p-2"
              >
                <Text className="text-red-200 font-bold text-xs uppercase">
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* FORGOT PASSWORD LINK */}
            <TouchableOpacity className="self-end mb-8">
              <Text className="text-red-200 text-xs font-bold">
                Forgot Password?
              </Text>
            </TouchableOpacity>

            {/* LOGIN BUTTON */}
            <TouchableOpacity
              className="w-full bg-white py-4 rounded-xl items-center shadow-lg active:bg-gray-100"
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#7f1d1d" />
              ) : (
                <Text className="text-red-900 font-bold text-lg tracking-wide uppercase">
                  Login
                </Text>
              )}
            </TouchableOpacity>

            {/* FOOTER DIVIDER */}
            <View className="flex-row items-center mt-10">
              <View className="flex-1 h-[1px] bg-white/20" />
              <Text className="text-white/40 mx-4 text-xs">
                Destiny Angas System
              </Text>
              <View className="flex-1 h-[1px] bg-white/20" />
            </View>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}
