import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { App } from './App';
import { pagesPreview } from './api';
import './styles.css';
import './extras.css';

// Hash routing avoids GitHub Pages 404 responses on client-side routes.
const Router = pagesPreview ? HashRouter : BrowserRouter;
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Router><App /></Router></React.StrictMode>,
);
