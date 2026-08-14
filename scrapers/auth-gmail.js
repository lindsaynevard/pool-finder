// One-time script to authorize Gmail API access for poolfinderalerts@gmail.com
// Run with: node scrapers/auth-gmail.js
// Signs in via browser, prints a refresh token to save as a GitHub secret.
import { google } from 'googleapis';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { exec } from 'child_process';

const creds = JSON.parse(readFileSync('./scrapers/gmail-credentials.json'));
const { client_id, client_secret } = creds.installed;

const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  'http://localhost:3333'
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  prompt: 'consent',
});

console.log('\nOpen this URL in an incognito window and sign in with poolfinderalerts@gmail.com:\n');
console.log(authUrl);
console.log('');

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3333');
  const code = url.searchParams.get('code');
  if (!code) { res.end('No code — try again.'); return; }

  res.end('<h1>Authorized! You can close this tab and go back to the terminal.</h1>');
  server.close();

  const { tokens } = await oauth2Client.getToken(code);
  console.log('\n✓ Success! Add this to GitHub secrets as GMAIL_REFRESH_TOKEN:\n');
  console.log(tokens.refresh_token);
  console.log('');
});

server.listen(3333, () => {
  console.log('Waiting for you to sign in...');
});
