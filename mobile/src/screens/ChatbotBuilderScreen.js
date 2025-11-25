import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, FlatList } from 'react-native';
import api from '../api';

const ChatbotBuilderScreen = ({ navigation }) => {
  const [chatbots, setChatbots] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [flows, setFlows] = useState([]);
  const [newFlow, setNewFlow] = useState({
    trigger: '',
    triggerType: 'contains',
    response: ''
  });

  useEffect(() => {
    loadChatbots();
  }, []);

  const loadChatbots = async () => {
    try {
      const res = await api.get('/ai/chatbots');
      setChatbots(res.data.chatbots || []);
    } catch (error) {
      console.error('Load chatbots error:', error);
    }
  };

  const addFlow = () => {
    if (!newFlow.trigger || !newFlow.response) {
      Alert.alert('Error', 'Please fill trigger and response');
      return;
    }
    
    setFlows([...flows, { ...newFlow, id: Date.now() }]);
    setNewFlow({ trigger: '', triggerType: 'contains', response: '' });
    Alert.alert('Added!', 'Flow added successfully');
  };

  const removeFlow = (id) => {
    setFlows(flows.filter(f => f.id !== id));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter chatbot name');
      return;
    }

    if (flows.length === 0) {
      Alert.alert('Error', 'Please add at least one flow');
      return;
    }

    setLoading(true);
    try {
      await api.post('/ai/chatbot-generator', {
        name,
        description,
        flows: flows.map(f => ({
          trigger: f.trigger,
          triggerType: f.triggerType,
          response: f.response
        })),
        deploymentType: 'private'
      });
      
      Alert.alert('Success', 'Chatbot created successfully!');
      setShowForm(false);
      setName('');
      setDescription('');
      setFlows([]);
      loadChatbots();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create chatbot');
    } finally {
      setLoading(false);
    }
  };

  const testChatbot = (chatbotId, chatbotName) => {
    navigation.navigate('TestChatbot', { chatbotId, chatbotName });
  };

  const renderChatbotItem = ({ item }) => (
    <View style={styles.chatbotCard}>
      <View style={styles.chatbotHeader}>
        <Text style={styles.chatbotName}>{item.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: item.isActive ? '#4CAF50' : '#999' }]}>
          <Text style={styles.statusText}>{item.isActive ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>
      
      {item.description && (
        <Text style={styles.chatbotDescription}>{item.description}</Text>
      )}
      
      <View style={styles.chatbotStats}>
        <Text style={styles.statText}>💬 {item.stats?.totalInteractions || 0} interactions</Text>
        <Text style={styles.statText}>🎯 {item.flows?.length || 0} flows</Text>
      </View>
      
      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={styles.testButton}
          onPress={() => testChatbot(item._id, item.name)}
        >
          <Text style={styles.testButtonText}>🧪 Test</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>✏️ Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFlowItem = ({ item }) => (
    <View style={styles.flowCard}>
      <View style={styles.flowHeader}>
        <Text style={styles.flowTrigger}>🎯 {item.trigger}</Text>
        <TouchableOpacity onPress={() => removeFlow(item.id)}>
          <Text style={styles.removeButton}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.flowType}>Type: {item.triggerType}</Text>
      <Text style={styles.flowResponse}>💬 {item.response}</Text>
    </View>
  );

  if (showForm) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => setShowForm(false)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.formTitle}>Create New Chatbot</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Chatbot Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Support Bot, FAQ Bot"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What does this chatbot do?"
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />

          <Text style={styles.sectionTitle}>Conversation Flows</Text>
          
          {flows.length > 0 && (
            <FlatList
              data={flows}
              renderItem={renderFlowItem}
              keyExtractor={item => item.id.toString()}
              style={styles.flowList}
              scrollEnabled={false}
            />
          )}

          <View style={styles.newFlowContainer}>
            <Text style={styles.label}>Trigger Keyword *</Text>
            <TextInput
              style={styles.input}
              value={newFlow.trigger}
              onChangeText={(text) => setNewFlow({...newFlow, trigger: text})}
              placeholder="e.g., hello, help, price"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Trigger Type</Text>
            <View style={styles.triggerTypes}>
              {['exact', 'contains', 'startsWith'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.triggerTypeButton,
                    newFlow.triggerType === type && styles.triggerTypeActive
                  ]}
                  onPress={() => setNewFlow({...newFlow, triggerType: type})}
                >
                  <Text style={[
                    styles.triggerTypeText,
                    newFlow.triggerType === type && styles.triggerTypeTextActive
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Bot Response *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={newFlow.response}
              onChangeText={(text) => setNewFlow({...newFlow, response: text})}
              placeholder="Bot's reply to this trigger"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={styles.addFlowButton} onPress={addFlow}>
              <Text style={styles.addFlowButtonText}>+ Add Flow</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.createButton, loading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={styles.createButtonText}>
              {loading ? '⏳ Creating...' : '🤖 Create Chatbot'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Chatbot Builder</Text>
        <Text style={styles.subtitle}>Create rule-based chatbots without coding</Text>
      </View>

      <TouchableOpacity 
        style={styles.createNewButton}
        onPress={() => setShowForm(true)}
      >
        <Text style={styles.createNewButtonText}>+ Create New Chatbot</Text>
      </TouchableOpacity>

      <FlatList
        data={chatbots}
        renderItem={renderChatbotItem}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No chatbots yet</Text>
            <Text style={styles.emptySubtext}>Create your first chatbot to get started</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    backgroundColor: '#673AB7',
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
    color: '#E1BEE7'
  },
  createNewButton: {
    backgroundColor: '#4CAF50',
    margin: 15,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 3
  },
  createNewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  list: {
    padding: 15
  },
  chatbotCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 2
  },
  chatbotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  chatbotName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  chatbotDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10
  },
  chatbotStats: {
    flexDirection: 'row',
    marginBottom: 15
  },
  statText: {
    fontSize: 14,
    color: '#999',
    marginRight: 15
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  testButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginRight: 10
  },
  testButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  editButton: {
    flex: 1,
    backgroundColor: '#FF9800',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center'
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  formHeader: {
    backgroundColor: '#673AB7',
    padding: 20,
    paddingTop: 40
  },
  backButton: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff'
  },
  form: {
    padding: 20
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
    backgroundColor: '#fff'
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 25,
    marginBottom: 15
  },
  flowList: {
    marginBottom: 20
  },
  flowCard: {
    backgroundColor: '#E1BEE7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10
  },
  flowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5
  },
  flowTrigger: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1
  },
  removeButton: {
    fontSize: 20,
    color: '#F44336',
    fontWeight: 'bold'
  },
  flowType: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5
  },
  flowResponse: {
    fontSize: 14,
    color: '#333'
  },
  newFlowContainer: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20
  },
  triggerTypes: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10
  },
  triggerTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff'
  },
  triggerTypeActive: {
    backgroundColor: '#673AB7',
    borderColor: '#673AB7'
  },
  triggerTypeText: {
    fontSize: 12,
    color: '#666'
  },
  triggerTypeTextActive: {
    color: '#fff',
    fontWeight: 'bold'
  },
  addFlowButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10
  },
  addFlowButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  createButton: {
    backgroundColor: '#673AB7',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 3
  },
  buttonDisabled: {
    backgroundColor: '#ccc'
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold'
  },
  emptyState: {
    alignItems: 'center',
    padding: 40
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 5
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc'
  }
});

export default ChatbotBuilderScreen;
