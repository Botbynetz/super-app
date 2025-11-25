import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { api } from '../api';

export default function StartStreamScreen({ navigation }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('coding');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const categories = ['coding', 'design', 'trading', 'gaming', 'music', 'art', 'education', 'lifestyle', 'other'];

  const startStream = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a stream title');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/livestream/start', {
        title: title.trim(),
        category,
        description: description.trim()
      });

      if (response.data.success) {
        Alert.alert('Success', 'Stream started!', [
          { text: 'OK', onPress: () => navigation.replace('StreamingNow', { 
            streamId: response.data.stream.streamId,
            streamKey: response.data.stream.streamKey,
            rtcRoomId: response.data.stream.rtcRoomId
          })}
        ]);
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to start stream');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Start Live Stream</Text>
        <Text style={styles.headerSubtitle}>Share your skills with the world 🌍</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Stream Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter stream title..."
          placeholderTextColor="#666"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        <Text style={styles.label}>Category *</Text>
        <View style={styles.categoryGrid}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryButton, category === cat && styles.categoryButtonActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.categoryButtonText, category === cat && styles.categoryButtonTextActive]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Description (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Tell viewers what your stream is about..."
          placeholderTextColor="#666"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          maxLength={500}
        />

        <TouchableOpacity 
          style={[styles.startButton, isLoading && styles.startButtonDisabled]}
          onPress={startStream}
          disabled={isLoading}
        >
          <Text style={styles.startButtonText}>
            {isLoading ? '🔄 Starting...' : '🔴 Go Live Now'}
          </Text>
        </TouchableOpacity>

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>💡 Tips for a great stream:</Text>
          <Text style={styles.tipText}>• Choose a catchy title</Text>
          <Text style={styles.tipText}>• Pick the right category for your content</Text>
          <Text style={styles.tipText}>• Engage with your viewers in chat</Text>
          <Text style={styles.tipText}>• Consider boosting your stream for more visibility</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#999',
    fontSize: 14,
    marginTop: 5,
  },
  form: {
    padding: 20,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#111',
    color: '#fff',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  categoryButton: {
    backgroundColor: '#111',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    margin: 5,
    borderWidth: 1,
    borderColor: '#222',
  },
  categoryButtonActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  categoryButtonText: {
    color: '#999',
    fontWeight: '600',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  startButton: {
    backgroundColor: '#e74c3c',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 30,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tips: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  tipsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  tipText: {
    color: '#999',
    fontSize: 14,
    marginBottom: 5,
  },
});
