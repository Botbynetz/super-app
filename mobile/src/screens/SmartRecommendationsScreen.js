import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, Image, RefreshControl } from 'react-native';
import api from '../api';

const SmartRecommendationsScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('events');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, [activeTab]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      switch(activeTab) {
        case 'events':
          endpoint = '/ai/recommend/events';
          break;
        case 'streams':
          endpoint = '/ai/recommend/streams';
          break;
        case 'content':
          endpoint = '/ai/recommend/content';
          break;
        case 'users':
          endpoint = '/ai/recommend/users';
          break;
      }
      
      const res = await api.get(endpoint, { params: { limit: 20 } });
      setRecommendations(res.data.recommendations || []);
    } catch (error) {
      console.error('Load recommendations error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderEventItem = ({ item }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.scoreTag}>
        <Text style={styles.scoreText}>{item.score}% match</Text>
      </View>
      <Text style={styles.itemTitle}>{item.event.title}</Text>
      <Text style={styles.itemSubtitle}>{item.event.location}</Text>
      <Text style={styles.itemDate}>📅 {new Date(item.event.date).toLocaleDateString()}</Text>
      <View style={styles.factorsContainer}>
        {item.factors && Object.entries(item.factors).slice(0, 3).map(([key, value]) => (
          value > 0 && <Text key={key} style={styles.factorText}>• {key}: {value}pts</Text>
        ))}
      </View>
    </TouchableOpacity>
  );

  const renderStreamItem = ({ item }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.scoreTag}>
        <Text style={styles.scoreText}>{item.score}% match</Text>
      </View>
      <View style={styles.streamHeader}>
        <View style={styles.liveIndicator}>
          <Text style={styles.liveText}>🔴 LIVE</Text>
        </View>
        <Text style={styles.viewerCount}>👥 {item.stream.viewerCount}</Text>
      </View>
      <Text style={styles.itemTitle}>{item.stream.title}</Text>
      <Text style={styles.itemSubtitle}>by {item.stream.userId?.username || 'Unknown'}</Text>
      <Text style={styles.categoryTag}>{item.stream.category}</Text>
    </TouchableOpacity>
  );

  const renderContentItem = ({ item }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.scoreTag}>
        <Text style={styles.scoreText}>{item.score}% match</Text>
      </View>
      {item.content.mediaUrl && (
        <Image source={{ uri: item.content.mediaUrl }} style={styles.contentImage} />
      )}
      <Text style={styles.itemTitle} numberOfLines={2}>{item.content.caption}</Text>
      <Text style={styles.itemSubtitle}>by {item.content.userId?.username || 'Unknown'}</Text>
      <Text style={styles.itemDate}>❤️ {item.content.likes?.length || 0} likes</Text>
    </TouchableOpacity>
  );

  const renderUserItem = ({ item }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.scoreTag}>
        <Text style={styles.scoreText}>{item.score}% match</Text>
      </View>
      <View style={styles.userRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.user.username ? item.user.username[0].toUpperCase() : '?'}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.itemTitle}>{item.user.username}</Text>
          <Text style={styles.itemSubtitle}>{item.user.fullName || 'No name'}</Text>
          {item.user.isOnline && <Text style={styles.onlineStatus}>🟢 Online</Text>}
        </View>
      </View>
      <TouchableOpacity style={styles.followButton}>
        <Text style={styles.followButtonText}>+ Follow</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    switch(activeTab) {
      case 'events':
        return renderEventItem({ item });
      case 'streams':
        return renderStreamItem({ item });
      case 'content':
        return renderContentItem({ item });
      case 'users':
        return renderUserItem({ item });
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Smart Recommendations</Text>
        <Text style={styles.subtitle}>Personalized for you</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'events' && styles.tabActive]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
            📅 Events
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'streams' && styles.tabActive]}
          onPress={() => setActiveTab('streams')}
        >
          <Text style={[styles.tabText, activeTab === 'streams' && styles.tabTextActive]}>
            🎥 Streams
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'content' && styles.tabActive]}
          onPress={() => setActiveTab('content')}
        >
          <Text style={[styles.tabText, activeTab === 'content' && styles.tabTextActive]}>
            📱 Content
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'users' && styles.tabActive]}
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
            👤 Users
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={recommendations}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadRecommendations} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No recommendations yet</Text>
            <Text style={styles.emptySubtext}>Start interacting to get personalized recommendations</Text>
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
    backgroundColor: '#9C27B0',
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    elevation: 2
  },
  tab: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent'
  },
  tabActive: {
    borderBottomColor: '#9C27B0'
  },
  tabText: {
    fontSize: 14,
    color: '#999'
  },
  tabTextActive: {
    color: '#9C27B0',
    fontWeight: 'bold'
  },
  list: {
    padding: 15
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 2
  },
  scoreTag: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 1
  },
  scoreText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5
  },
  itemDate: {
    fontSize: 12,
    color: '#999'
  },
  factorsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  factorText: {
    fontSize: 12,
    color: '#4CAF50',
    marginBottom: 2
  },
  streamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  liveIndicator: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  viewerCount: {
    fontSize: 14,
    color: '#666'
  },
  categoryTag: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 5,
    fontWeight: 'bold'
  },
  contentImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#eee'
  },
  userRow: {
    flexDirection: 'row',
    marginBottom: 15
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#9C27B0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold'
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center'
  },
  onlineStatus: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 5
  },
  followButton: {
    backgroundColor: '#9C27B0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  followButtonText: {
    color: '#fff',
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
    color: '#ccc',
    textAlign: 'center'
  }
});

export default SmartRecommendationsScreen;
