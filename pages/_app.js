import Head from 'next/head';
import { useEffect } from 'react';
import '../styles/cm.css';

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
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
