import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image } from 'react-native';
import { api } from '../api';

export default function LiveStreamScreen({ navigation }) {
  const [streams, setStreams] = useState([]);
  const [category, setCategory] = useState('all');

  const categories = ['all', 'coding', 'design', 'trading', 'gaming', 'music', 'art', 'education', 'lifestyle'];

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 10000);
    return () => clearInterval(interval);
  }, [category]);

  const fetchStreams = async () => {
    try {
      const query = category !== 'all' ? `?category=${category}` : '';
      const response = await api.get(`/livestream/list${query}`);
      if (response.data.success) {
        setStreams(response.data.streams);
      }
    } catch (error) {
      console.error('Error fetching streams:', error);
    }
  };

  const renderStream = ({ item }) => (
    <TouchableOpacity 
      style={styles.streamCard}
      onPress={() => navigation.navigate('WatchStream', { streamId: item._id })}
    >
      <Image 
        source={{ uri: item.thumbnailUrl || 'https://via.placeholder.com/300x200' }} 
        style={styles.thumbnail}
      />
      {item.isBoosted && (
        <View style={styles.boostBadge}>
          <Text style={styles.boostText}>⚡ BOOSTED</Text>
        </View>
      )}
      <View style={styles.streamInfo}>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
          <Text style={styles.viewerCount}>👁 {item.viewerCount}</Text>
        </View>
        <Text style={styles.streamTitle}>{item.title}</Text>
        <View style={styles.streamerInfo}>
          <Image 
            source={{ uri: item.userId?.profilePicture || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
          <Text style={styles.streamerName}>{item.userId?.username}</Text>
          <Text style={styles.category}>{item.category}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Streams</Text>
        <TouchableOpacity 
          style={styles.goLiveButton}
          onPress={() => navigation.navigate('StartStream')}
        >
          <Text style={styles.goLiveText}>🔴 Go Live</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        data={categories}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryChip, category === item && styles.categoryChipActive]}
            onPress={() => setCategory(item)}
          >
            <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={item => item}
        showsHorizontalScrollIndicator={false}
        style={styles.categoryList}
      />

      <FlatList
        data={streams}
        renderItem={renderStream}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.streamList}
        refreshing={false}
        onRefresh={fetchStreams}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  goLiveButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  goLiveText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  categoryList: {
    paddingHorizontal: 10,
    paddingVertical: 15,
  },
  categoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#222',
    marginRight: 10,
  },
  categoryChipActive: {
    backgroundColor: '#3498db',
  },
  categoryText: {
    color: '#999',
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#fff',
  },
  streamList: {
    padding: 10,
  },
  streamCard: {
    backgroundColor: '#111',
    borderRadius: 10,
    marginBottom: 15,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: '#222',
  },
  boostBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#f39c12',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  boostText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  streamInfo: {
    padding: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e74c3c',
    marginRight: 5,
  },
  liveText: {
    color: '#e74c3c',
    fontWeight: 'bold',
    marginRight: 10,
  },
  viewerCount: {
    color: '#999',
    fontSize: 12,
  },
  streamTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  streamerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
  },
  streamerName: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  category: {
    color: '#3498db',
    fontSize: 12,
    fontWeight: '600',
  },
});
