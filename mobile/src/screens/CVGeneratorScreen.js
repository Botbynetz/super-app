import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, FlatList } from 'react-native';
import api from '../api';

const CVGeneratorScreen = ({ navigation }) => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [cvData, setCvData] = useState({
    fullName: '',
    email: '',
    phone: '',
    summary: '',
    skills: '',
    experience: '',
    education: ''
  });
  const [myCVs, setMyCVs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMyCVs();
  }, []);

  const loadMyCVs = async () => {
    try {
      const res = await api.get('/ai/cvs');
      setMyCVs(res.data.cvs || []);
    } catch (error) {
      console.error('Load CVs error:', error);
    }
  };

  const handleGenerate = async () => {
    if (!cvData.fullName || !cvData.email) {
      Alert.alert('Error', 'Please fill required fields (Name & Email)');
      return;
    }

    if (!selectedTemplate) {
      Alert.alert('Error', 'Please select a template');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/ai/generate-cv', {
        templateId: selectedTemplate,
        data: {
          ...cvData,
          skills: cvData.skills.split(',').map(s => s.trim()),
          experience: cvData.experience ? [{ title: cvData.experience, company: 'Self', duration: '2024' }] : [],
          education: cvData.education ? [{ degree: cvData.education, institution: 'University', year: '2024' }] : []
        }
      });
      
      Alert.alert('Success', 'CV generated successfully!');
      loadMyCVs();
      setCvData({
        fullName: '',
        email: '',
        phone: '',
        summary: '',
        skills: '',
        experience: '',
        education: ''
      });
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to generate CV');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI CV Generator</Text>
        <Text style={styles.subtitle}>Create professional CV from your profile</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          value={cvData.fullName}
          onChangeText={(text) => setCvData({...cvData, fullName: text})}
          placeholder="Your full name"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          value={cvData.email}
          onChangeText={(text) => setCvData({...cvData, email: text})}
          placeholder="your.email@example.com"
          keyboardType="email-address"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={cvData.phone}
          onChangeText={(text) => setCvData({...cvData, phone: text})}
          placeholder="+62 812 3456 7890"
          keyboardType="phone-pad"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Professional Summary</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={cvData.summary}
          onChangeText={(text) => setCvData({...cvData, summary: text})}
          placeholder="Brief summary about yourself"
          multiline
          numberOfLines={4}
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Skills (comma separated)</Text>
        <TextInput
          style={styles.input}
          value={cvData.skills}
          onChangeText={(text) => setCvData({...cvData, skills: text})}
          placeholder="e.g., JavaScript, React, Node.js"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Experience</Text>
        <TextInput
          style={styles.input}
          value={cvData.experience}
          onChangeText={(text) => setCvData({...cvData, experience: text})}
          placeholder="Job title or role"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Education</Text>
        <TextInput
          style={styles.input}
          value={cvData.education}
          onChangeText={(text) => setCvData({...cvData, education: text})}
          placeholder="Degree or certification"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.templateSection}>
        <Text style={styles.sectionTitle}>Select Template</Text>
        <View style={styles.templateButtons}>
          <TouchableOpacity 
            style={[styles.templateButton, selectedTemplate === 'modern' && styles.templateSelected]}
            onPress={() => setSelectedTemplate('modern')}
          >
            <Text style={styles.templateButtonText}>Modern</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.templateButton, selectedTemplate === 'professional' && styles.templateSelected]}
            onPress={() => setSelectedTemplate('professional')}
          >
            <Text style={styles.templateButtonText}>Professional</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.generateButton, loading && styles.buttonDisabled]}
        onPress={handleGenerate}
        disabled={loading}
      >
        <Text style={styles.generateButtonText}>
          {loading ? '⏳ Generating...' : '📄 Generate CV'}
        </Text>
      </TouchableOpacity>

      {myCVs.length > 0 && (
        <View style={styles.myCVsSection}>
          <Text style={styles.sectionTitle}>My CVs ({myCVs.length})</Text>
          {myCVs.map((cv, index) => (
            <View key={cv._id} style={styles.cvCard}>
              <Text style={styles.cvTitle}>CV #{index + 1}</Text>
              <Text style={styles.cvDate}>Created: {new Date(cv.createdAt).toLocaleDateString()}</Text>
              <TouchableOpacity style={styles.viewButton}>
                <Text style={styles.viewButtonText}>View/Download</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>💡 Your badges and achievements will be automatically included!</Text>
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
    backgroundColor: '#FF5722',
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
    color: '#FFE0B2'
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 10
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginTop: 10,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top'
  },
  templateSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 10
  },
  templateButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  templateButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    marginHorizontal: 5,
    backgroundColor: '#fff'
  },
  templateSelected: {
    borderColor: '#FF5722',
    backgroundColor: '#FFEBEE'
  },
  templateButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
  },
  generateButton: {
    backgroundColor: '#4CAF50',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
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
  myCVsSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 10
  },
  cvCard: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF5722'
  },
  cvTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5
  },
  cvDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 10
  },
  viewButton: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center'
  },
  viewButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    margin: 20,
    padding: 15,
    borderRadius: 8
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    textAlign: 'center'
  }
});

export default CVGeneratorScreen;
