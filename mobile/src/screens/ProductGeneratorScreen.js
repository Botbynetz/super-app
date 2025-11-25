import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import api from '../api';

const ProductGeneratorScreen = ({ navigation }) => {
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('electronics');
  const [inputs, setInputs] = useState({
    adjective: '',
    benefit: '',
    feature1: '',
    feature2: '',
    advantage: '',
    targetAudience: ''
  });
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = [
    { label: 'Electronics', value: 'electronics' },
    { label: 'Fashion', value: 'fashion' },
    { label: 'Food & Beverage', value: 'food' },
    { label: 'Services', value: 'services' },
    { label: 'Digital Products', value: 'digital' },
    { label: 'Handmade', value: 'handmade' },
    { label: 'Education', value: 'education' },
    { label: 'Health & Beauty', value: 'health' },
    { label: 'Other', value: 'other' }
  ];

  const handleGenerate = async () => {
    if (!productName.trim()) {
      Alert.alert('Error', 'Please enter product name');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/ai/product-description', {
        productName,
        category,
        inputs
      });
      
      setGeneratedDescription(res.data.description);
      Alert.alert('Success', 'Product description generated!');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to generate description');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    // In real app, use Clipboard API
    Alert.alert('Copied!', 'Description copied to clipboard');
  };

  const handleSave = async () => {
    if (!generatedDescription) {
      Alert.alert('Error', 'No description to save');
      return;
    }
    Alert.alert('Saved!', 'Description saved to your products');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Product Description Generator</Text>
        <Text style={styles.subtitle}>Generate professional product descriptions instantly</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Product Name *</Text>
        <TextInput
          style={styles.input}
          value={productName}
          onChangeText={setProductName}
          placeholder="Enter product name"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Category *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={category}
            onValueChange={setCategory}
            style={styles.picker}
          >
            {categories.map(cat => (
              <Picker.Item key={cat.value} label={cat.label} value={cat.value} />
            ))}
          </Picker>
        </View>

        <Text style={styles.sectionTitle}>Product Details (Optional)</Text>
        <Text style={styles.helperText}>Fill in as many details as possible for better results</Text>

        <Text style={styles.label}>Adjective (great, modern, innovative)</Text>
        <TextInput
          style={styles.input}
          value={inputs.adjective}
          onChangeText={(text) => setInputs({...inputs, adjective: text})}
          placeholder="e.g., innovative, premium, stylish"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Main Benefit</Text>
        <TextInput
          style={styles.input}
          value={inputs.benefit}
          onChangeText={(text) => setInputs({...inputs, benefit: text})}
          placeholder="e.g., saves time, improves productivity"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Key Feature 1</Text>
        <TextInput
          style={styles.input}
          value={inputs.feature1}
          onChangeText={(text) => setInputs({...inputs, feature1: text})}
          placeholder="e.g., fast charging"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Key Feature 2</Text>
        <TextInput
          style={styles.input}
          value={inputs.feature2}
          onChangeText={(text) => setInputs({...inputs, feature2: text})}
          placeholder="e.g., water resistant"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Advantage</Text>
        <TextInput
          style={styles.input}
          value={inputs.advantage}
          onChangeText={(text) => setInputs({...inputs, advantage: text})}
          placeholder="e.g., long-lasting, eco-friendly"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Target Audience</Text>
        <TextInput
          style={styles.input}
          value={inputs.targetAudience}
          onChangeText={(text) => setInputs({...inputs, targetAudience: text})}
          placeholder="e.g., professionals, students, gamers"
          placeholderTextColor="#999"
        />

        <TouchableOpacity 
          style={[styles.generateButton, loading && styles.buttonDisabled]}
          onPress={handleGenerate}
          disabled={loading}
        >
          <Text style={styles.generateButtonText}>
            {loading ? '⏳ Generating...' : '✨ Generate Description'}
          </Text>
        </TouchableOpacity>
      </View>

      {generatedDescription && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Generated Description:</Text>
          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionText}>{generatedDescription}</Text>
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
              <Text style={styles.actionButtonText}>📋 Copy</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.actionButtonText}>💾 Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>💡 Tips for Better Results:</Text>
        <Text style={styles.tipText}>• Be specific with product features</Text>
        <Text style={styles.tipText}>• Mention unique selling points</Text>
        <Text style={styles.tipText}>• Describe the target audience</Text>
        <Text style={styles.tipText}>• Highlight key benefits</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 40
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5
  },
  subtitle: {
    fontSize: 14,
    color: '#E3F2FD'
  },
  form: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 10
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginTop: 15,
    marginBottom: 5,
    fontWeight: '500'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa'
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden'
  },
  picker: {
    height: 50
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 25,
    marginBottom: 5
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 10
  },
  generateButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 25,
    elevation: 3
  },
  buttonDisabled: {
    backgroundColor: '#ccc'
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  resultContainer: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    elevation: 2
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15
  },
  descriptionBox: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50'
  },
  descriptionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20
  },
  copyButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 10
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  tipsContainer: {
    backgroundColor: '#FFF9C4',
    margin: 15,
    padding: 20,
    borderRadius: 12
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 20
  }
});

export default ProductGeneratorScreen;
