import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { api } from '../api';

export default function LeaderboardScreen({ navigation }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [type, setType] = useState('level');

  const types = [
    { id: 'level', label: 'Level' },
    { id: 'viewers', label: 'Viewers' },
    { id: 'streamer', label: 'Top Streamers' },
    { id: 'gifter', label: 'Top Gifters' }
  ];

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [type]);

  const fetchLeaderboard = async () => {
    try {
      const response = await api.get(`/gamification/leaderboard?type=${type}`);
      if (response.data.success) {
        setLeaderboard(response.data.leaderboard);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const renderUser = ({ item, index }) => {
    let displayValue = '';
    switch (type) {
      case 'level':
        displayValue = `Level ${item.level}`;
        break;
      case 'viewers':
        displayValue = `${item.stats.totalViewers} viewers`;
        break;
      case 'streamer':
        displayValue = `${item.stats.totalLiveStreams} streams`;
        break;
      case 'gifter':
        displayValue = `${item.stats.totalGiftsSent} 🪙`;
        break;
    }

    const rankColor = index === 0 ? '#f39c12' : index === 1 ? '#95a5a6' : index === 2 ? '#cd7f32' : '#3498db';

    return (
      <TouchableOpacity 
        style={styles.userCard}
        onPress={() => navigation.navigate('Profile', { userId: item.userId._id })}
      >
        <View style={[styles.rank, { backgroundColor: rankColor }]}>
          <Text style={styles.rankText}>#{index + 1}</Text>
        </View>
        <Image 
          source={{ uri: item.userId?.profilePicture || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.username}>{item.userId?.username}</Text>
          <Text style={styles.displayValue}>{displayValue}</Text>
        </View>
        {index < 3 && (
          <Text style={styles.medal}>
            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leaderboard 🏆</Text>
        <Text style={styles.headerSubtitle}>Top performers in the community</Text>
      </View>

      <FlatList
        horizontal
        data={types}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.typeChip, type === item.id && styles.typeChipActive]}
            onPress={() => setType(item.id)}
          >
            <Text style={[styles.typeText, type === item.id && styles.typeTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        style={styles.typeList}
      />

      <FlatList
        data={leaderboard}
        renderItem={renderUser}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={styles.list}
        refreshing={false}
        onRefresh={fetchLeaderboard}
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
  typeList: {
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  typeChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#111',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  typeChipActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  typeText: {
    color: '#999',
    fontWeight: '600',
  },
  typeTextActive: {
    color: '#fff',
  },
  list: {
    padding: 15,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  rank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  rankText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  displayValue: {
    color: '#3498db',
    fontSize: 14,
  },
  medal: {
    fontSize: 30,
  },
});
