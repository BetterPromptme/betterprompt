export const errorHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="https://betterprompt.me/favicon.ico" type="image/x-icon" sizes="48x48">
  <link rel="icon" href="https://betterprompt.me/favicon.svg" type="image/svg+xml" sizes="96x96">
  <title>BetterPrompt | Authentication Failed</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #151929; color: #FFFFFF; }
    .icon { width: 64px; height: 64px; background: #1A1F2E; border: 1px solid #2A2F3F; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; }
    .icon svg { width: 32px; height: 32px; }
    h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.5rem; color: #FFFFFF; }
    p { color: #B3B3B3; margin: 0; font-size: 0.95rem; }
  </style>
</head>
<body>
  <div class="icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="#EE3D3D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M15 9l-6 6M9 9l6 6"/>
    </svg>
  </div>
  <h1>Authentication Failed</h1>
  <p>{{MESSAGE}}</p>
</body>
</html>`;
