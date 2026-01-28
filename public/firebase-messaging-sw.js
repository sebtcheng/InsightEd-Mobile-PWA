// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// --- PLACEHOLDER CONFIG (User must replace this) ---
const firebaseConfig = {
    apiKey: "AIzaSyDKbjlnMauvdUZS4S8V6FkNaWAEXFQ1fFs",
    authDomain: "insighted-6ba10.firebaseapp.com",
    projectId: "insighted-6ba10",
    storageBucket: "insighted-6ba10.firebasestorage.app",
    messagingSenderId: "945568231794",
    appId: "1:945568231794:web:5a3c1688c1ddfa8dd7edeb"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Background Message Handler
messaging.onBackgroundMessage(function (payload) {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/pwa-192x192.png', // Default icon
        tag: 'background-alert'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
