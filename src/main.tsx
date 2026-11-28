import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

const updateSW=registerSW({
  immediate:true,
  onNeedRefresh(){
    (window as typeof window&{saffilionUpdateReady?:boolean}).saffilionUpdateReady=true;
    window.dispatchEvent(new Event('saffilion-update-ready'));
  },
});
window.addEventListener('saffilion-apply-update',()=>{
  (window as typeof window&{saffilionUpdateReady?:boolean}).saffilionUpdateReady=false;
  void updateSW(true);
});
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
