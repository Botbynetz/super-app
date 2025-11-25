import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, getUnreadCount } from '../api';

function NotificationScreen({ token }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, []);

  const loadNotifications = async (pageNum = 1) => {
    try {
      const response = await getNotifications(pageNum, 20);
      if (pageNum === 1) {
        setNotifications(response.data.notifications);
      } else {
        setNotifications([...notifications, ...response.data.notifications]);
      }
      setHasMore(response.data.hasMore);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await getUnreadCount();
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadNotifications(1);
    setRefreshing(false);
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(notifications.map(n => 
        n._id === notificationId ? { ...n, isRead: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      follower: '👤',
      stream_start: '🔴',
      event_reminder: '📅',
      event_invite: '🎫',
      badge_earned: '🏆',
      level_up: '⬆️',
      gift_received: '🎁',
      mention: '💬',
      comment: '💬',
      like: '❤️',
      system: '📢'
    };
    return icons[type] || '🔔';
  };

  const renderNotificationItem = ({ item }) => {
    const timeSince = getTimeSince(new Date(item.createdAt));
    
    return (
      <TouchableOpacity 
        style={[styles.notificationItem, !item.isRead && styles.unreadItem]}
        onPress={() => handleMarkAsRead(item._id)}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{getNotificationIcon(item.type)}</Text>
        </View>
        <View style={styles.contentContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>{timeSince}</Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const getTimeSince = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <Text style={styles.markAllButton}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadText}>{unreadCount} unread notification{unreadCount > 1 ? 's' : ''}</Text>
        </View>
      )}

      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={() => {
          if (hasMore && !refreshing) {
            const nextPage = page + 1;
            setPage(nextPage);
            loadNotifications(nextPage);
          }
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </View>
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
  markAllButton: {
    color: 'white',
    fontSize: 14,
  },
  unreadBanner: {
    backgroundColor: '#FFF9C4',
    padding: 10,
    alignItems: 'center',
  },
  unreadText: {
    color: '#F57C00',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationItem: {
    backgroundColor: 'white',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  unreadItem: {
    backgroundColor: '#E3F2FD',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  time: {
    fontSize: 12,
    color: '#999',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007bff',
    marginLeft: 8,
    marginTop: 5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default NotificationScreen;
