import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { App } from './App';
import { pagesPreview } from './api';
import './styles.css';
import './extras.css';
import './brand.css';
import './gateway.css';
import './dashboard-sidebar.css';
import './refined.css';
import './quiet-home.css';
import './client-explore.css';
import './profile-menu.css';
import './official-brand.css';
import './client-overview.css';
import './footer.css';
import './lumina-home.css';
import './credit-shop.css';
import './home-story.css';
import './lumina-responsive.css';
import './auth-login.css';
import './admin-overview-insights.css';
import './dashboard-gradient.css';
import './sidebar-motion.css';

// Hash routing avoids GitHub Pages 404 responses on client-side routes.
const Router = pagesPreview ? HashRouter : BrowserRouter;
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Router><App /></Router></React.StrictMode>,
);
