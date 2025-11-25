import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { getProfile, getAllContent, getAllEvents, searchContent, getFeaturedLiveStreams } from '../api';

function HomeScreen({ navigation, token, setToken }) {
  const [profile, setProfile] = useState(null);
  const [contents, setContents] = useState([]);
  const [events, setEvents] = useState([]);
  const [featuredStreams, setFeaturedStreams] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProfile();
    loadAllContent();
    loadAllEvents();
    loadFeaturedStreams();
    
    // Refresh featured streams every 30 seconds
    const interval = setInterval(loadFeaturedStreams, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadProfile = async () => {
    try {
      const response = await getProfile();
      setProfile(response.data.user);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const loadAllContent = async () => {
    try {
      const response = await getAllContent();
      setContents(response.data.contents);
    } catch (error) {
      console.error('Failed to load content:', error);
    }
  };

  const loadAllEvents = async () => {
    try {
      const response = await getAllEvents();
      setEvents(response.data.events);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const loadFeaturedStreams = async () => {
    try {
      const response = await getFeaturedLiveStreams(5);
      setFeaturedStreams(response.data.streams);
    } catch (error) {
      console.error('Failed to load featured streams:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadAllContent();
      loadAllEvents();
      return;
    }
    try {
      const response = await searchContent(searchQuery);
      setContents(response.data.contents);
      setEvents(response.data.events);
    } catch (error) {
      Alert.alert('Error', 'Search failed');
    }
  };

  const handleLogout = () => {
    setToken(null);
  };

  if (!profile) return <View><Text>Loading...</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Super App</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.profileSummary}>
        <Text style={styles.username}>{profile.username}</Text>
        <Text>{profile.category}</Text>
        <Text>{profile.bio}</Text>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search events or content..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.buttonText}>Search</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.buttonText}>Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.buttonText}>Create Event</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Chat')}
        >
          <Text style={styles.buttonText}>Chat</Text>
        </TouchableOpacity>
      </View>

      {/* Featured Live Streams Section */}
      {featuredStreams.length > 0 && (
        <View style={styles.featuredSection}>
          <Text style={styles.sectionTitle}>🔴 Live Now</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {featuredStreams.map(stream => (
              <TouchableOpacity 
                key={stream._id} 
                style={styles.streamCard}
                onPress={() => Alert.alert('Stream', `Join ${stream.title}`)}
              >
                {stream.isBoosted && (
                  <View style={styles.boostedBadge}>
                    <Text style={styles.boostedText}>⚡ BOOSTED</Text>
                  </View>
                )}
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
                <Text style={styles.streamTitle}>{stream.title}</Text>
                <Text style={styles.streamCategory}>{stream.category}</Text>
                <View style={styles.streamFooter}>
                  <Text style={styles.streamerName}>@{stream.userId?.username}</Text>
                  <Text style={styles.viewerCount}>👁 {stream.viewerCount || 0}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Content ({contents.length})</Text>
        {contents.map(content => (
          <View key={content._id} style={styles.contentItem}>
            <Text>{content.caption}</Text>
            <Text style={styles.smallText}>By: {content.userId?.username}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Events ({events.length})</Text>
        {events.map(event => (
          <View key={event._id} style={styles.eventItem}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text>{event.description}</Text>
            <Text style={styles.smallText}>
              {new Date(event.date).toLocaleDateString()}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007bff',
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
  },
  profileSummary: {
    backgroundColor: 'white',
    padding: 20,
    margin: 10,
    borderRadius: 10,
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  searchBar: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    padding: 10,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: 'white',
    margin: 10,
    padding: 15,
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  contentItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10,
  },
  eventItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  smallText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  featuredSection: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
  },
  streamCard: {
    width: 200,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    marginRight: 12,
    position: 'relative',
  },
  boostedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 1,
  },
  boostedText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
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
    backgroundColor: '#FF0000',
    marginRight: 6,
  },
  liveText: {
    color: '#FF0000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  streamTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  streamCategory: {
    color: '#999',
    fontSize: 12,
    marginBottom: 8,
  },
  streamFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streamerName: {
    color: '#007bff',
    fontSize: 12,
  },
  viewerCount: {
    color: '#ccc',
    fontSize: 12,
  },
});

export default HomeScreen;
