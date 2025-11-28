import React, { useState, useEffect, useRef } from 'react';
import { 
  getChatList, 
  getChatMessages, 
  sendMessage, 
  createChat, 
  sendGroqAIMessage 
} from '../api';
import axios from 'axios';
import io from 'socket.io-client';
// AI Model utilities removed - using direct model selection
import AIRecommendations from './AIRecommendations';
import './ChatHub.css';

function ChatHub({ token, user }) {
  // Main state
  const [activeTab, setActiveTab] = useState('ai-chat'); // ai-chat, group-chat, voice-chat, video-call
  
  // AI Chat State
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [currentModel, setCurrentModel] = useState('llama-3.1-70b-versatile');
  const [isAITyping, setIsAITyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [voiceEnabled] = useState(false); // Reserved for future use
  const [isRecording, setIsRecording] = useState(false);
  const [conversationMode, setConversationMode] = useState('chat'); // chat, voice, video
  
  // Group Chat State
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showCreateChat, setShowCreateChat] = useState(false);
  
  // Video Call State - Reserved for future implementation
  // const [isInCall, setIsInCall] = useState(false);
  // const [callId, setCallId] = useState(null); 
  // const [callParticipants, setCallParticipants] = useState([]);
  
  // Refs
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const aiMessagesRef = useRef(null);
  const messagesRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const videoRef = useRef(null);

  // Available AI Models
  const aiModels = [
    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', description: 'Most capable model' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Fast responses' },
    { id: 'gemma2-9b-it', name: 'Gemma2 9B', description: 'Creative conversations' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1', description: 'Advanced reasoning' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Multilingual expert' }
  ];

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io('http://localhost:5000');
    
    socketRef.current.on('receive-message', (message) => {
      if (activeTab === 'group-chat') {
        setMessages(prev => [...prev, message]);
      }
    });

    socketRef.current.on('ai-response', (response) => {
      if (activeTab === 'ai-chat') {
        setAiMessages(prev => [...prev, {
          id: Date.now(),
          text: response.message,
          sender: 'ai',
          timestamp: new Date(),
          model: response.model
        }]);
        setIsAITyping(false);
      }
    });

    socketRef.current.on('call-started', (callData) => {
      // Video call functionality - reserved for future implementation
      // setCallId(callData.callId);
      // setCallParticipants(callData.participants);
      // setIsInCall(true);
    });

    loadChats();
    loadAIConversationHistory();

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (activeChat && activeTab === 'group-chat') {
      loadMessages(activeChat._id);
      socketRef.current.emit('join-chat', activeChat._id);
    }
  }, [activeChat, activeTab]);

  useEffect(() => {
    // Auto-scroll to bottom for AI chat
    if (aiMessagesRef.current) {
      aiMessagesRef.current.scrollTop = aiMessagesRef.current.scrollHeight;
    }
  }, [aiMessages]);

  useEffect(() => {
    // Auto-scroll to bottom for group chat
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  // AI Chat Functions
  const loadAIConversationHistory = () => {
    const saved = localStorage.getItem('ai-chat-history');
    if (saved) {
      setAiMessages(JSON.parse(saved));
    }
  };

  const saveAIConversationHistory = (messages) => {
    localStorage.setItem('ai-chat-history', JSON.stringify(messages));
  };

  const handleAIMessage = async (e) => {
    e.preventDefault();
    if (!aiInput.trim() && !selectedImage) return;

    const userMessage = {
      id: Date.now(),
      text: aiInput,
      sender: 'user',
      timestamp: new Date(),
      image: selectedImage
    };

    const updatedMessages = [...aiMessages, userMessage];
    setAiMessages(updatedMessages);
    saveAIConversationHistory(updatedMessages);
    
    setAiInput('');
    setSelectedImage(null);
    setImagePreview(null);
    setIsAITyping(true);

    try {
      let response;
      if (selectedImage) {
        // Handle image + text
        response = await axios.post('/api/ai/vision-chat', {
          message: aiInput,
          image: selectedImage,
          model: currentModel,
          conversationHistory: aiMessages.slice(-10) // Last 10 messages for context
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else if (conversationMode === 'voice') {
        // Handle voice input
        response = await axios.post('/api/ai/voice-input', {
          message: aiInput,
          model: currentModel,
          voiceSettings: { enabled: voiceEnabled }
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Regular text chat
        response = await sendGroqAIMessage({
          message: aiInput,
          model: currentModel,
          conversationHistory: aiMessages.slice(-10)
        }, token);
      }

      const aiResponse = {
        id: Date.now() + 1,
        text: response.data.message || response.data.response,
        sender: 'ai',
        timestamp: new Date(),
        model: currentModel,
        audioUrl: response.data.audioUrl,
        capabilities: response.data.capabilities
      };

      const finalMessages = [...updatedMessages, aiResponse];
      setAiMessages(finalMessages);
      saveAIConversationHistory(finalMessages);

      // Play voice response if available
      if (response.data.audioUrl && voiceEnabled) {
        const audio = new Audio(response.data.audioUrl);
        audio.play();
      }

    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
        model: currentModel,
        isError: true
      };
      
      const finalMessages = [...updatedMessages, errorMessage];
      setAiMessages(finalMessages);
      saveAIConversationHistory(finalMessages);
    } finally {
      setIsAITyping(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
        setSelectedImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('audio', audioBlob);

        try {
          const response = await axios.post('/api/ai/voice-input', formData, {
            headers: { 
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`
            }
          });

          setAiInput(response.data.transcription);
        } catch (error) {
          console.error('Voice transcription error:', error);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Voice recording error:', error);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const startVideoCall = async () => {
    try {
      const response = await axios.post('/api/ai/start-call', {
        type: 'video',
        aiPersonality: currentModel
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // setCallId(response.data.callId);
      setConversationMode('video');
      setActiveTab('video-call');
      
      // Initialize video call interface
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // setIsInCall(true);
    } catch (error) {
      console.error('Video call error:', error);
    }
  };

  const endCall = () => {
    // Video call end functionality - reserved for future implementation
    // if (callId) {
    //   socketRef.current.emit('end-call', callId);
    // }
    // setIsInCall(false);
    // setCallId(null);
    setConversationMode('chat');
    
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  // Group Chat Functions
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

  const handleGroupMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await sendMessage(activeChat._id, newMessage, token);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const createNewChat = async (chatName, participants) => {
    try {
      const response = await createChat({ name: chatName, participants }, token);
      setChats(prev => [...prev, response.data.chat]);
      setShowCreateChat(false);
      loadChats(); // Reload chats to get updated list
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  const clearAIHistory = () => {
    setAiMessages([]);
    localStorage.removeItem('ai-chat-history');
  };

  const exportAIConversation = () => {
    const conversation = aiMessages.map(msg => 
      `${msg.sender === 'user' ? 'You' : 'AI'} (${msg.timestamp.toLocaleString()}): ${msg.text}`
    ).join('\\n\\n');
    
    const blob = new Blob([conversation], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-conversation-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
  };

  const renderAIChat = () => (
    <div className="ai-chat-container">
      <div className="ai-chat-header">
        <div className="ai-model-selector">
          <label>AI Model:</label>
          <select 
            value={currentModel} 
            onChange={(e) => setCurrentModel(e.target.value)}
          >
            {aiModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} - {model.description}
              </option>
            ))}
          </select>
        </div>
        
        <div className="ai-controls">
          <button 
            onClick={() => setConversationMode(conversationMode === 'chat' ? 'voice' : 'chat')}
            className={`btn ${conversationMode === 'voice' ? 'active' : ''}`}
          >
            🎤 Voice {conversationMode === 'voice' ? 'ON' : 'OFF'}
          </button>
          <button onClick={startVideoCall} className="btn btn-video">
            📹 Video Call
          </button>
          <button onClick={clearAIHistory} className="btn btn-clear">
            🗑️ Clear
          </button>
          <button onClick={exportAIConversation} className="btn btn-export">
            📥 Export
          </button>
        </div>
      </div>

      <div className="ai-messages" ref={aiMessagesRef}>
        {aiMessages.map((message) => (
          <div key={message.id} className={`ai-message ${message.sender}`}>
            <div className="message-content">
              {message.image && (
                <img src={message.image} alt="Uploaded" className="message-image" />
              )}
              <p>{message.text}</p>
              {message.audioUrl && (
                <audio controls>
                  <source src={message.audioUrl} type="audio/mpeg" />
                </audio>
              )}
              {message.capabilities && (
                <div className="ai-capabilities">
                  <small>🧠 Capabilities used: {message.capabilities.join(', ')}</small>
                </div>
              )}
            </div>
            <div className="message-meta">
              <span className="timestamp">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
              {message.model && (
                <span className="model-badge">{message.model}</span>
              )}
            </div>
          </div>
        ))}
        
        {isAITyping && (
          <div className="ai-message ai">
            <div className="typing-indicator">
              <span></span><span></span><span></span>
              AI is thinking...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleAIMessage} className="ai-input-form">
        {imagePreview && (
          <div className="image-preview">
            <img src={imagePreview} alt="Preview" />
            <button 
              type="button" 
              onClick={() => {
                setImagePreview(null);
                setSelectedImage(null);
              }}
              className="remove-image"
            >
              ✕
            </button>
          </div>
        )}
        
        <div className="input-container">
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="attachment-btn"
          >
            📎
          </button>
          
          {conversationMode === 'voice' ? (
            <button
              type="button"
              onMouseDown={startVoiceRecording}
              onMouseUp={stopVoiceRecording}
              className={`voice-btn ${isRecording ? 'recording' : ''}`}
            >
              🎤 {isRecording ? 'Recording...' : 'Hold to Record'}
            </button>
          ) : (
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ask me anything... I can see images, understand voice, and help with complex tasks!"
              className="ai-input"
              disabled={isAITyping}
            />
          )}
          
          <button type="submit" className="send-btn" disabled={isAITyping}>
            {isAITyping ? '⏳' : '🚀'}
          </button>
        </div>
        
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          style={{ display: 'none' }}
        />
      </form>
    </div>
  );

  const renderGroupChat = () => (
    <div className="group-chat-container">
      <div className="chat-sidebar">
        <div className="chat-header">
          <h3>Chats</h3>
          <button 
            onClick={() => setShowCreateChat(true)}
            className="btn btn-create"
          >
            ➕ New Chat
          </button>
        </div>
        
        <div className="chat-list">
          {chats.map((chat) => (
            <div
              key={chat._id}
              className={`chat-item ${activeChat?._id === chat._id ? 'active' : ''}`}
              onClick={() => setActiveChat(chat)}
            >
              <div className="chat-avatar">
                {chat.isGroup ? '👥' : '👤'}
              </div>
              <div className="chat-info">
                <h4>{chat.name}</h4>
                <p>{chat.lastMessage?.text || 'No messages yet'}</p>
              </div>
              <div className="chat-time">
                {chat.lastMessage && 
                  new Date(chat.lastMessage.createdAt).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-main">
        {activeChat ? (
          <>
            <div className="chat-header">
              <div className="chat-title">
                <h3>{activeChat.name}</h3>
                <span>{activeChat.participants?.length || 0} participants</span>
              </div>
              <div className="chat-actions">
                <button className="btn btn-call">📞 Voice Call</button>
                <button className="btn btn-video-call">📹 Video Call</button>
              </div>
            </div>
            
            <div className="messages" ref={messagesRef}>
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`message ${message.sender._id === user?.id ? 'sent' : 'received'}`}
                >
                  <div className="message-content">
                    <div className="sender-name">{message.sender.displayName}</div>
                    <p>{message.text}</p>
                    <div className="message-time">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleGroupMessage} className="message-input-form">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="message-input"
              />
              <button type="submit" className="send-btn">Send</button>
            </form>
          </>
        ) : (
          <div className="no-chat-selected">
            <h3>Select a chat to start messaging</h3>
            <p>Choose from your existing conversations or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderVideoCall = () => (
    <div className="video-call-container">
      <div className="video-call-header">
        <h3>AI Video Call with {aiModels.find(m => m.id === currentModel)?.name}</h3>
        <button onClick={endCall} className="btn btn-danger">
          🔴 End Call
        </button>
      </div>
      
      <div className="video-interface">
        <div className="user-video">
          <video ref={videoRef} autoPlay muted className="video-stream" />
          <div className="video-label">You</div>
        </div>
        
        <div className="ai-video">
          <div className="ai-avatar">
            <div className="ai-visual-indicator">
              🤖 {currentModel}
            </div>
          </div>
          <div className="video-label">AI Assistant</div>
        </div>
      </div>
      
      <div className="call-controls">
        <button className="control-btn mute">🎤</button>
        <button className="control-btn video">📹</button>
        <button className="control-btn screen">🖥️</button>
        <button className="control-btn settings">⚙️</button>
      </div>
      
      {/* Real-time AI chat during video call */}
      <div className="call-chat">
        <div className="call-messages">
          {aiMessages.slice(-5).map((message) => (
            <div key={message.id} className={`call-message ${message.sender}`}>
              <span>{message.text}</span>
            </div>
          ))}
        </div>
        
        <form onSubmit={handleAIMessage} className="call-input">
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="Ask during call..."
            className="call-input-field"
          />
          <button type="submit" className="call-send-btn">Send</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="chat-hub">
      {/* Tab Navigation */}
      <div className="chat-hub-nav">
        <button 
          className={`nav-tab ${activeTab === 'ai-chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai-chat')}
        >
          🤖 AI Assistant
        </button>
        <button 
          className={`nav-tab ${activeTab === 'group-chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('group-chat')}
        >
          💬 Group Chats
        </button>
        <button 
          className={`nav-tab ${activeTab === 'voice-chat' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('ai-chat');
            setConversationMode('voice');
          }}
        >
          🎤 Voice Chat
        </button>
        <button 
          className={`nav-tab ${activeTab === 'video-call' ? 'active' : ''}`}
          onClick={() => setActiveTab('video-call')}
        >
          📹 Video Call
        </button>
      </div>

      {/* Main Content */}
      <div className="chat-hub-content">
        {activeTab === 'ai-chat' && renderAIChat()}
        {activeTab === 'group-chat' && renderGroupChat()}
        {activeTab === 'video-call' && renderVideoCall()}
      </div>

      {/* AI Recommendations Sidebar */}
      <div className="recommendations-sidebar">
        <h3>Smart Suggestions</h3>
        <AIRecommendations token={token} />
        
        <div className="quick-actions">
          <h4>Quick Actions</h4>
          <button className="quick-btn" onClick={() => setAiInput("Explain this concept: ")}>
            💡 Explain Concept
          </button>
          <button className="quick-btn" onClick={() => setAiInput("Help me brainstorm ideas for: ")}>
            🧠 Brainstorm Ideas  
          </button>
          <button className="quick-btn" onClick={() => setAiInput("Analyze this image: ")}>
            🖼️ Analyze Image
          </button>
          <button className="quick-btn" onClick={() => setAiInput("Create a plan for: ")}>
            📋 Create Plan
          </button>
        </div>
      </div>

      {/* Create Chat Modal */}
      {showCreateChat && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Create New Chat</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              createNewChat(formData.get('chatName'), []);
            }}>
              <input 
                name="chatName" 
                placeholder="Chat Name" 
                required 
                className="modal-input"
              />
              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowCreateChat(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatHub;