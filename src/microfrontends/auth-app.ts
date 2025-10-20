import React from 'react';
import ReactDOM from 'react-dom';
import singleSpaReact from 'single-spa-react';
import { AuthProvider } from '@/contexts/AuthContext';
import Auth from '@/pages/Auth';

const lifecycles = singleSpaReact({
  React,
  ReactDOM,
  rootComponent: Auth,
  errorBoundary(err, errInfo, props) {
    return React.createElement('div', {
      style: { padding: '20px', color: 'red' }
    }, [
      React.createElement('h2', { key: 'title' }, 'Error in Auth App'),
      React.createElement('pre', { key: 'error' }, err.toString())
    ]);
  },
});

export const { bootstrap, mount, unmount } = lifecycles;