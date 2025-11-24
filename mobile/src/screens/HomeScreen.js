import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { getProfile, getAllContent, getAllEvents, searchContent } from '../api';

function HomeScreen({ navigation, token, setToken }) {
  const [profile, setProfile] = useState(null);
  const [contents, setContents] = useState([]);
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProfile();
    loadAllContent();
    loadAllEvents();
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
});

export default HomeScreen;
