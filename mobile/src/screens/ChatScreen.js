import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, FlatList } from 'react-native';
import io from 'socket.io-client';
import { getChatList, getChatMessages, sendMessage } from '../api';

function ChatScreen({ token }) {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    
    socketRef.current.on('receive-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    loadChats();

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (activeChat) {
      loadMessages(activeChat._id);
      socketRef.current.emit('join-chat', activeChat._id);
    }
  }, [activeChat]);

  const loadChats = async () => {
    try {
      const response = await getChatList();
      setChats(response.data.chats);
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  };

  const loadMessages = async (chatId) => {
    try {
      const response = await getChatMessages(chatId);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const response = await sendMessage({
        chatId: activeChat._id,
        text: newMessage
      });

      socketRef.current.emit('send-message', {
        chatId: activeChat._id,
        message: response.data.message
      });

      setMessages(prev => [...prev, response.data.message]);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (!activeChat) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Select a chat</Text>
        <FlatList
          data={chats}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatItem}
              onPress={() => setActiveChat(item)}
            >
              <Text style={styles.chatTitle}>
                {item.type === 'group' ? item.groupName : 'Private Chat'}
              </Text>
              <Text>{item.type}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setActiveChat(null)}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {activeChat.type === 'group' ? activeChat.groupName : 'Private Chat'}
        </Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.message}>
            <Text style={styles.messageSender}>{item.senderId?.username}</Text>
            <Text>{item.text}</Text>
            <Text style={styles.messageTime}>
              {new Date(item.createdAt).toLocaleTimeString()}
            </Text>
          </View>
        )}
        style={styles.messagesList}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={newMessage}
          onChangeText={setNewMessage}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
          <Text style={styles.buttonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
  },
  chatItem: {
    backgroundColor: 'white',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  header: {
    backgroundColor: '#007bff',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    color: 'white',
    fontSize: 16,
    marginRight: 15,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  messagesList: {
    flex: 1,
    padding: 10,
  },
  message: {
    backgroundColor: 'white',
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
  },
  messageSender: {
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 5,
  },
  messageTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 20,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default ChatScreen;
