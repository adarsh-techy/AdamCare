import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { BACKEND_URL } from '../services/apiClient';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const socketInstance = io(BACKEND_URL, {
      transports: ['websocket'],
      autoConnect: true
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
