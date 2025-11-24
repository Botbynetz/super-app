import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import SetupProfileScreen from './src/screens/SetupProfileScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ChatScreen from './src/screens/ChatScreen';

const Stack = createStackNavigator();

function App() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadToken();
  }, []);

  const loadToken = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('token');
      if (savedToken) {
        setToken(savedToken);
      }
    } catch (error) {
      console.error('Failed to load token:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveToken = async (newToken) => {
    try {
      if (newToken) {
        await AsyncStorage.setItem('token', newToken);
      } else {
        await AsyncStorage.removeItem('token');
      }
      setToken(newToken);
    } catch (error) {
      console.error('Failed to save token:', error);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!token ? (
          <>
            <Stack.Screen name="Login">
              {props => <LoginScreen {...props} setToken={saveToken} />}
            </Stack.Screen>
          </>
        ) : (
          <>
            <Stack.Screen name="Home">
              {props => <HomeScreen {...props} token={token} setToken={saveToken} />}
            </Stack.Screen>
            <Stack.Screen name="SetupProfile">
              {props => <SetupProfileScreen {...props} token={token} />}
            </Stack.Screen>
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Chat">
              {props => <ChatScreen {...props} token={token} />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
