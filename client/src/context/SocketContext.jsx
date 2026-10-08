import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);

  let currentToken = null;
  try {
    const auth = useAuth();
    currentToken = auth?.token;
  } catch {
    currentToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  }

  const socket = useMemo(() => {
    const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin;

    return io(serverUrl, {
      auth: (cb) => {
        const token = localStorage.getItem('token');
        cb({ token });
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
  }, []);

  // Keep socket auth synchronized with active user token and refresh connection if needed
  useEffect(() => {
    const token = currentToken || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    socket.auth = { token };
    if (socket.connected) {
      socket.disconnect().connect();
    }
  }, [currentToken, socket]);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
      setConnecting(false);
    }

    function onDisconnect() {
      setConnected(false);
    }

    function onConnectError() {
      setConnected(false);
      setConnecting(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    if (socket.connected) {
      setConnected(true);
      setConnecting(false);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, connected, connecting }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
