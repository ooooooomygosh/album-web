import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './fonts.css';
import './cabin-room.css';
import './room-immersive.css';
import './record-library.css';
import './album-wall.css';
import './app.css';
import './styles/pixel-ui.css';

createRoot(document.getElementById('root')).render(<App/>);
