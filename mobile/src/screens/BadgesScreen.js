import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList } from 'react-native';
import { api } from '../api';

export default function BadgesScreen({ navigation, route }) {
  const { userId } = route.params;
  const [progress, setProgress] = useState(null);
  const [allBadges, setAllBadges] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [progressRes, badgesRes] = await Promise.all([
        api.get(`/gamification/progress/${userId}`),
        api.get('/gamification/badges')
      ]);

      if (progressRes.data.success) {
        setProgress(progressRes.data.progress);
      }
      if (badgesRes.data.success) {
        setAllBadges(badgesRes.data.badges);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const renderBadge = ({ item }) => {
    const earned = progress?.badges.some(b => b.badgeId._id === item._id);
    
    return (
      <View style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
        <View style={styles.badgeIcon}>
          <Text style={styles.badgeEmoji}>{earned ? '🏆' : '🔒'}</Text>
        </View>
        <View style={styles.badgeInfo}>
          <Text style={styles.badgeName}>{item.name}</Text>
          <Text style={styles.badgeDescription}>{item.description}</Text>
          <View style={styles.badgeMeta}>
            <Text style={[styles.rarity, styles[`rarity${item.rarity}`]]}>
              {item.rarity.toUpperCase()}
            </Text>
            {item.coinReward > 0 && (
              <Text style={styles.reward}>+{item.coinReward} 🪙</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (!progress) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Badges & Achievements</Text>
        <Text style={styles.earnedCount}>
          {progress.badges.length} / {allBadges.length} Earned
        </Text>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.levelCard}>
          <Text style={styles.levelLabel}>Level</Text>
          <Text style={styles.levelNumber}>{progress.level}</Text>
        </View>
        <View style={styles.expCard}>
          <Text style={styles.expLabel}>Experience Points</Text>
          <Text style={styles.expNumber}>{progress.experiencePoints} XP</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress.levelProgress}%` }]} />
          </View>
          <Text style={styles.expNext}>Next level: {progress.expForNextLevel} XP</Text>
        </View>
      </View>

      <View style={styles.coinsCard}>
        <Text style={styles.coinsLabel}>Your Coins</Text>
        <Text style={styles.coinsAmount}>🪙 {progress.coins}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Badges</Text>
        <FlatList
          data={allBadges}
          renderItem={renderBadge}
          keyExtractor={item => item._id}
          scrollEnabled={false}
        />
      </View>
    </ScrollView>
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
  earnedCount: {
    color: '#3498db',
    fontSize: 16,
    marginTop: 5,
  },
  progressSection: {
    flexDirection: 'row',
    padding: 15,
    gap: 15,
  },
  levelCard: {
    flex: 1,
    backgroundColor: '#111',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f39c12',
  },
  levelLabel: {
    color: '#999',
    fontSize: 14,
    marginBottom: 10,
  },
  levelNumber: {
    color: '#f39c12',
    fontSize: 48,
    fontWeight: 'bold',
  },
  expCard: {
    flex: 2,
    backgroundColor: '#111',
    padding: 20,
    borderRadius: 15,
  },
  expLabel: {
    color: '#999',
    fontSize: 14,
    marginBottom: 10,
  },
  expNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#222',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3498db',
  },
  expNext: {
    color: '#666',
    fontSize: 12,
  },
  coinsCard: {
    margin: 15,
    backgroundColor: '#111',
    padding: 20,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f39c12',
  },
  coinsLabel: {
    color: '#999',
    fontSize: 16,
  },
  coinsAmount: {
    color: '#f39c12',
    fontSize: 28,
    fontWeight: 'bold',
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  badgeCard: {
    backgroundColor: '#111',
    flexDirection: 'row',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  badgeCardLocked: {
    opacity: 0.5,
  },
  badgeIcon: {
    width: 60,
    height: 60,
    backgroundColor: '#222',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  badgeEmoji: {
    fontSize: 32,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  badgeDescription: {
    color: '#999',
    fontSize: 14,
    marginBottom: 8,
  },
  badgeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rarity: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  raritycommon: {
    backgroundColor: '#95a5a6',
    color: '#fff',
  },
  rarityrare: {
    backgroundColor: '#3498db',
    color: '#fff',
  },
  rarityepic: {
    backgroundColor: '#9b59b6',
    color: '#fff',
  },
  raritylegendary: {
    backgroundColor: '#f39c12',
    color: '#fff',
  },
  reward: {
    color: '#f39c12',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
