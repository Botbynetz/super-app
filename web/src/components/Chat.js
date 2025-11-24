import React, { useState, useEffect, useRef } from 'react';
import { getChatList, getChatMessages, sendMessage, createChat } from '../api';
import io from 'socket.io-client';
import './Chat.css';

function Chat({ token }) {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showCreateChat, setShowCreateChat] = useState(false);
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

  const handleSendMessage = async (e) => {
    e.preventDefault();
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
      alert('Failed to send message: ' + error.response?.data?.message);
    }
  };

  const handleCreateChat = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const chatData = {
      type: formData.get('type'),
      participants: [formData.get('participantId')],
      groupName: formData.get('groupName') || undefined
    };

    try {
      await createChat(chatData);
      setShowCreateChat(false);
      loadChats();
      e.target.reset();
    } catch (error) {
      alert('Failed to create chat: ' + error.response?.data?.message);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="chat-header">
          <h3>Chats</h3>
          <button onClick={() => setShowCreateChat(true)}>+</button>
        </div>
        <div className="chat-list">
          {chats.map(chat => (
            <div
              key={chat._id}
              className={`chat-item ${activeChat?._id === chat._id ? 'active' : ''}`}
              onClick={() => setActiveChat(chat)}
            >
              <h4>
                {chat.type === 'group' 
                  ? chat.groupName 
                  : chat.participants.find(p => p._id !== token)?.username
                }
              </h4>
              <p>{chat.type}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main">
        {activeChat ? (
          <>
            <div className="chat-header">
              <h3>
                {activeChat.type === 'group' 
                  ? activeChat.groupName 
                  : activeChat.participants.find(p => p._id !== token)?.username
                }
              </h3>
            </div>
            <div className="messages-container">
              {messages.map(msg => (
                <div key={msg._id} className="message">
                  <strong>{msg.senderId?.username}: </strong>
                  <span>{msg.text}</span>
                  <small>{new Date(msg.createdAt).toLocaleTimeString()}</small>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendMessage} className="message-input">
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit">Send</button>
            </form>
          </>
        ) : (
          <div className="no-chat-selected">
            <p>Select a chat to start messaging</p>
          </div>
        )}
      </div>

      {showCreateChat && (
        <div className="modal">
          <div className="modal-content">
            <h3>Create Chat</h3>
            <form onSubmit={handleCreateChat}>
              <select name="type" required>
                <option value="private">Private</option>
                <option value="group">Group</option>
              </select>
              <input type="text" name="participantId" placeholder="Participant User ID" required />
              <input type="text" name="groupName" placeholder="Group Name (for groups)" />
              <button type="submit">Create</button>
              <button type="button" onClick={() => setShowCreateChat(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
