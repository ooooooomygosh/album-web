import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyCegvGNNg1-Fbr0Ptw7hDxw82IkA1VcnCU',
  authDomain: 'music-b0420.firebaseapp.com',
  projectId: 'music-b0420',
  storageBucket: 'music-b0420.firebasestorage.app',
  messagingSenderId: '457908144785',
  appId: '1:457908144785:web:2bb2df7eadf0c12f1a4d30',
  measurementId: 'G-YF7T9CS9C7'
};

export const firebaseApp = initializeApp(firebaseConfig);

export async function initAnalytics() {
  if (typeof window === 'undefined') return null;
  if (import.meta.env.VITE_ENABLE_ANALYTICS !== '1') return null;
  const { getAnalytics, isSupported } = await import('firebase/analytics');
  if (!(await isSupported())) return null;
  return getAnalytics(firebaseApp);
}
