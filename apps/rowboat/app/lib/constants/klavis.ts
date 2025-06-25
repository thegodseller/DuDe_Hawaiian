// Server name to URL parameter mapping
export const SERVER_URL_PARAMS: Record<string, string> = {
  'Google Calendar': 'gcalendar',
  'Google Drive': 'gdrive', 
  'Google Docs': 'gdocs',
  'Google Sheets': 'gsheets',
  'Gmail': 'gmail',
  'GitHub': 'github',
  'Slack': 'slack',
  'Jira': 'jira',
  'Notion': 'notion',
  'Supabase': 'supabase',
  'WordPress': 'wordpress',
  'Asana': 'asana',
  'Close': 'close',
  'Confluence': 'confluence',
  'Salesforce': 'salesforce',
  'Linear': 'linear',
  'Attio': 'attio'
};

// Server name to environment variable mapping for client IDs
export const SERVER_CLIENT_ID_MAP: Record<string, string | undefined> = {
  'GitHub': process.env.KLAVIS_GITHUB_CLIENT_ID,
  'Google Calendar': process.env.KLAVIS_GOOGLE_CLIENT_ID,
  'Google Drive': process.env.KLAVIS_GOOGLE_CLIENT_ID,
  'Google Docs': process.env.KLAVIS_GOOGLE_CLIENT_ID,
  'Google Sheets': process.env.KLAVIS_GOOGLE_CLIENT_ID,
  'Gmail': process.env.KLAVIS_GOOGLE_CLIENT_ID,
  'Slack': process.env.KLAVIS_SLACK_ID,
}; 