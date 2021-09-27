import getEnvValue from 'get-env-value';
import Conf from 'conf';

const schema = {
  rootFolder: {
    type: 'string',
    default: getEnvValue.stringValue('GDIFS_ROOT_FOLDER'),
  },
  oauthClientId: {
    type: 'string',
    default: getEnvValue.stringValue('GDIFS_OAUTH_CLIENT_ID'),
  },
  oauthClientSecret: {
    type: 'string',
    default: getEnvValue.stringValue('GDIFS_OAUTH_CLIENT_SECRET'),
  },
  oauthRedirectUrl: {
    type: 'string',
    default: getEnvValue.stringValue(
      'GDIFS_OAUTH_REDIRECT_URL',
      'urn:ietf:wg:oauth:2.0:oob',
    ),
  },
  syncIntervalMs: {
    type: 'number',
    default: getEnvValue.integerValue(
      'GDIFS_SYNC_INTERVAL_MS',
      600_000, // 10 min
    ),
  },
  dataPath: {
    type: 'string',
    default: getEnvValue.stringValue('GDIFS_DATA_PATH', '/data'),
  },
  currentState: {
    type: 'object',
  },
  tokens: {
    type: 'object',
  },
};

const config = new Conf({ schema });

export default config;
