import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { setupProfile } from '../api';

function SetupProfileScreen({ navigation, token }) {
  const [username, setUsername] = useState('');
  const [category, setCategory] = useState('kreator');
  const [bio, setBio] = useState('');

  const handleSubmit = async () => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('category', category);
    formData.append('bio', bio);

    try {
      await setupProfile(formData);
      Alert.alert('Success', 'Profile setup complete!');
      navigation.replace('Home');
    } catch (error) {
      Alert.alert('Error', 'Failed to setup profile: ' + error.response?.data?.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Setup Your Profile</Text>

      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
      />

      <View style={styles.categoryContainer}>
        <TouchableOpacity
          style={[styles.categoryButton, category === 'kreator' && styles.categoryButtonActive]}
          onPress={() => setCategory('kreator')}
        >
          <Text style={styles.categoryText}>Kreator</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.categoryButton, category === 'bisnis' && styles.categoryButtonActive]}
          onPress={() => setCategory('bisnis')}
        >
          <Text style={styles.categoryText}>Bisnis</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.categoryButton, category === 'freelancer' && styles.categoryButtonActive]}
          onPress={() => setCategory('freelancer')}
        >
          <Text style={styles.categoryText}>Freelancer</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Bio (optional)"
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={4}
      />

      <View style={styles.placeholder}>
        <Text>Skill Diagram (Placeholder)</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Complete Setup</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 5,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  categoryButton: {
    flex: 1,
    padding: 12,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  categoryButtonActive: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  placeholder: {
    backgroundColor: '#e9ecef',
    padding: 50,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SetupProfileScreen;
