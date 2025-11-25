import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ScrollView } from 'react-native';
import { api } from '../api';
import io from 'socket.io-client';

export default function WatchStreamScreen({ route, navigation }) {
  const { streamId } = route.params;
  const [stream, setStream] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [selectedGift, setSelectedGift] = useState(null);
  const socketRef = useRef(null);

  const gifts = [
    { id: 1, name: '❤️', value: 10 },
    { id: 2, name: '🔥', value: 25 },
    { id: 3, name: '💎', value: 50 },
    { id: 4, name: '👑', value: 100 },
    { id: 5, name: '🚀', value: 250 },
  ];

  useEffect(() => {
    fetchStreamDetails();
    joinStream();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-stream', { streamId, userId: 'currentUserId' });
        socketRef.current.disconnect();
      }
    };
  }, []);

  const fetchStreamDetails = async () => {
    try {
      const response = await api.get(`/livestream/${streamId}`);
      if (response.data.success) {
        setStream(response.data.stream);
      }
    } catch (error) {
      console.error('Error fetching stream:', error);
    }
  };

  const joinStream = async () => {
    try {
      const response = await api.post(`/livestream/${streamId}/join`);
      if (response.data.success) {
        const socket = io('http://YOUR_SERVER_URL');
        socketRef.current = socket;

        socket.emit('join-stream', { 
          streamId, 
          rtcRoomId: response.data.rtcRoomId,
          userId: 'currentUserId'
        });

        socket.on('stream-chat-message', (data) => {
          setMessages(prev => [...prev, data]);
        });

        socket.on('stream-gift', (data) => {
          setMessages(prev => [...prev, { 
            type: 'gift', 
            ...data 
          }]);
        });

        socket.on('viewer-joined', (data) => {
          setStream(prev => ({ ...prev, viewerCount: data.viewerCount }));
        });

        socket.on('viewer-left', (data) => {
          setStream(prev => ({ ...prev, viewerCount: data.viewerCount }));
        });
      }
    } catch (error) {
      console.error('Error joining stream:', error);
    }
  };

  const sendMessage = () => {
    if (message.trim() && socketRef.current) {
      socketRef.current.emit('stream-chat-message', {
        streamId,
        message: message.trim(),
        username: 'CurrentUser'
      });
      setMessage('');
    }
  };

  const sendGift = async (gift) => {
    try {
      const response = await api.post(`/livestream/${streamId}/gift`, {
        giftType: gift.name,
        coinValue: gift.value
      });

      if (response.data.success && socketRef.current) {
        socketRef.current.emit('stream-gift', {
          streamId,
          gift,
          fromUser: 'CurrentUser'
        });
        setSelectedGift(null);
      }
    } catch (error) {
      console.error('Error sending gift:', error);
      alert(error.response?.data?.error || 'Failed to send gift');
    }
  };

  const handleLike = () => {
    if (socketRef.current) {
      socketRef.current.emit('stream-like', { streamId, userId: 'currentUserId' });
    }
  };

  if (!stream) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading stream...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video Player Placeholder */}
      <View style={styles.videoContainer}>
        <Text style={styles.videoPlaceholder}>📹 Live Video Stream</Text>
        <Text style={styles.videoNote}>WebRTC Integration Required</Text>
        
        <View style={styles.streamOverlay}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={styles.viewerCount}>👁 {stream.viewerCount}</Text>
        </View>

        <View style={styles.streamInfo}>
          <Text style={styles.streamTitle}>{stream.title}</Text>
          <Text style={styles.streamerName}>@{stream.userId?.username}</Text>
        </View>
      </View>

      {/* Chat Section */}
      <View style={styles.chatContainer}>
        <ScrollView style={styles.chatMessages}>
          {messages.map((msg, index) => (
            <View key={index} style={styles.chatMessage}>
              {msg.type === 'gift' ? (
                <Text style={styles.giftMessage}>
                  {msg.fromUser} sent {msg.gift.name} ({msg.gift.value} coins)
                </Text>
              ) : (
                <Text style={styles.message}>
                  <Text style={styles.username}>{msg.username}: </Text>
                  {msg.message}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.chatInput}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#666"
            value={message}
            onChangeText={setMessage}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Text style={styles.actionText}>❤️</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => setSelectedGift(selectedGift ? null : true)}
        >
          <Text style={styles.actionText}>🎁</Text>
        </TouchableOpacity>
      </View>

      {/* Gift Selector */}
      {selectedGift && (
        <View style={styles.giftSelector}>
          <Text style={styles.giftTitle}>Send a Gift</Text>
          <FlatList
            horizontal
            data={gifts}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.giftItem}
                onPress={() => sendGift(item)}
              >
                <Text style={styles.giftEmoji}>{item.name}</Text>
                <Text style={styles.giftValue}>{item.value} 🪙</Text>
              </TouchableOpacity>
            )}
            keyExtractor={item => item.id.toString()}
          />
          <TouchableOpacity 
            style={styles.closeGiftButton}
            onPress={() => setSelectedGift(null)}
          >
            <Text style={styles.closeGiftText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 50,
  },
  videoContainer: {
    height: 300,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    color: '#fff',
    fontSize: 24,
  },
  videoNote: {
    color: '#666',
    fontSize: 12,
    marginTop: 10,
  },
  streamOverlay: {
    position: 'absolute',
    top: 15,
    left: 15,
    right: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e74c3c',
    marginRight: 5,
  },
  liveText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  viewerCount: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  streamInfo: {
    position: 'absolute',
    bottom: 15,
    left: 15,
    right: 15,
  },
  streamTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  streamerName: {
    color: '#999',
    fontSize: 14,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  chatMessages: {
    flex: 1,
    padding: 10,
  },
  chatMessage: {
    marginBottom: 8,
  },
  message: {
    color: '#fff',
    fontSize: 14,
  },
  username: {
    fontWeight: 'bold',
    color: '#3498db',
  },
  giftMessage: {
    color: '#f39c12',
    fontWeight: 'bold',
  },
  chatInput: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  input: {
    flex: 1,
    backgroundColor: '#111',
    color: '#fff',
    padding: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
  },
  sendText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  actions: {
    position: 'absolute',
    right: 10,
    top: 350,
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionText: {
    fontSize: 24,
  },
  giftSelector: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  giftTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  giftItem: {
    alignItems: 'center',
    marginRight: 20,
    padding: 10,
    backgroundColor: '#222',
    borderRadius: 10,
  },
  giftEmoji: {
    fontSize: 40,
    marginBottom: 5,
  },
  giftValue: {
    color: '#f39c12',
    fontWeight: 'bold',
  },
  closeGiftButton: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    alignItems: 'center',
  },
  closeGiftText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
