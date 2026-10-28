import Head from 'next/head';
import { useEffect } from 'react';
import '../styles/cm.css';

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // public/sw.js (интернэтгүй нээх кэш) зөвхөн production-д. next dev-д кэш хуучин код гаргах тул бүртгэлийг цуцална.
    if (process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => {});
    else navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#7B52EE" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ЭЕШ шалгагч" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/chick.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <title>ЭЕШ шалгагч — CyberMath</title>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
