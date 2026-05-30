import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

import { getThemeById, DEFAULT_THEME_ID } from '@/lib/themes/definitions';

/** Default surface color for first paint before JS hydrates (matches :root in global.css). */
const defaultBg2 = getThemeById(DEFAULT_THEME_ID).colors.bg2;

/**
 * Root HTML template for static web export. Runs in Node only — no browser APIs.
 * Keeps the status-bar / notch safe area filled with the app surface color.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content={defaultBg2} />
        <link rel="icon" href="/app/favicon.ico?v=2" sizes="any" />
        <link rel="icon" type="image/png" href="/app/favicon.png?v=2" sizes="48x48" />
        <link rel="apple-touch-icon" href="/app/apple-touch-icon.png?v=2" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
html {
  touch-action: manipulation;
}
html, body, #root {
  background-color: ${defaultBg2};
}
`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
