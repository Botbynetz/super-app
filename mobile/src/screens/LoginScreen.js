import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { sendOTP, verifyOTP, setAuthToken } from '../api';

function LoginScreen({ navigation, setToken }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [autoLogin, setAutoLogin] = useState(false);

  const handleSendOTP = async () => {
    try {
      await sendOTP(phoneNumber);
      setStep(2);
      Alert.alert('Success', 'OTP sent to your phone!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send OTP: ' + error.response?.data?.message);
    }
  };

  const handleVerifyOTP = async () => {
    try {
      const response = await verifyOTP(phoneNumber, otp, autoLogin);
      const token = response.data.token;
      setAuthToken(token);
      setToken(token);
      
      if (response.data.isNewUser) {
        navigation.replace('SetupProfile');
      } else {
        navigation.replace('Home');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to verify OTP: ' + error.response?.data?.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Super App</Text>
      <Text style={styles.subtitle}>Talent Ekonomi</Text>

      {step === 1 ? (
        <View style={styles.form}>
          <Text style={styles.heading}>Login / Sign Up</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter phone number (e.g., +62812...)"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
          <TouchableOpacity style={styles.button} onPress={handleSendOTP}>
            <Text style={styles.buttonText}>Send OTP</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.heading}>Enter OTP</Text>
          <Text>OTP sent to {phoneNumber}</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity style={styles.button} onPress={handleVerifyOTP}>
            <Text style={styles.buttonText}>Verify OTP</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep(1)}>
            <Text style={styles.buttonText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#667eea',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
    marginBottom: 40,
  },
  form: {
    width: '100%',
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 10,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 5,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LoginScreen;
