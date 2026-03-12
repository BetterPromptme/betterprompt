export const errorHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" href="https://betterprompt.me/favicon.ico" type="image/x-icon" sizes="48x48">
  <link rel="icon" href="https://betterprompt.me/favicon.svg" type="image/svg+xml" sizes="96x96">
  <title>BetterPrompt | Authentication Failed</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #151929; color: #FFFFFF; }
    .card { text-align: center; padding: 2rem; background: #1A1F2E; border-radius: 1rem; border: 1px solid #2A2F3F; max-width: 400px; }
    h1 { color: #EE3D3D; font-size: 1.5rem; margin-bottom: .5rem; }
    p { color: #B3B3B3; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authentication Failed</h1>
    <p>{{MESSAGE}}</p>
  </div>
</body>
</html>`;
