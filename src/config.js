import getEnvValue from 'get-env-value';

const CONFIG = {
  rootFolder: getEnvValue.stringValue('GDIFS_ROOT_FOLDER'),
  oauthClientId: getEnvValue.stringValue('GDIFS_OAUTH_CLIENT_ID'),
  oauthClientSecret: getEnvValue.stringValue('GDIFS_OAUTH_CLIENT_SECRET'),
  oauthRedirectUrl: getEnvValue.stringValue(
    'GDIFS_OAUTH_REDIRECT_URL',
    'urn:ietf:wg:oauth:2.0:oob',
  ),
  syncIntervalMs: getEnvValue.integerValue(
    'GDIFS_SYNC_INTERVAL_MS',
    600_000, // 10 min
  ),
  dataPath: getEnvValue.stringValue('GDIFS_DATA_PATH', '/data'),
  configPath: getEnvValue.stringValue('GDIFS_CONFIG_PATH', '/config'),
};

export default CONFIG;
