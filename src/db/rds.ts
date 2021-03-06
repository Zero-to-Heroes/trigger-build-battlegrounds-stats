/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-var-requires */
import { SecretsManager } from 'aws-sdk';
import { GetSecretValueRequest, GetSecretValueResponse } from 'aws-sdk/clients/secretsmanager';
import MySQLServerless from 'serverless-mysql';

const secretsManager = new SecretsManager({ region: 'us-west-2' });
let connection, connectionPromise;

const connect = async () => {
	const secretRequest: GetSecretValueRequest = {
		SecretId: 'rds-battlegrounds',
	};
	const secret: SecretInfo = await getSecret(secretRequest);
	const config = {
		host: secret.host,
		user: secret.username,
		password: secret.password,
		database: 'player_match_recap',
		port: secret.port,
	};
	connection = MySQLServerless({ config });
	return connection;
};

const getConnection = async () => {
	if (connection) {
		return connection;
	}
	if (connectionPromise) {
		return connectionPromise;
	}
	connectionPromise = connect();

	return connectionPromise;
};

export default { getConnection };

const getSecret = (secretRequest: GetSecretValueRequest) => {
	return new Promise<SecretInfo>(resolve => {
		secretsManager.getSecretValue(secretRequest, (err, data: GetSecretValueResponse) => {
			const secretInfo: SecretInfo = JSON.parse(data.SecretString);
			resolve(secretInfo);
		});
	});
};

interface SecretInfo {
	readonly username: string;
	readonly password: string;
	readonly host: string;
	readonly port: number;
	readonly dbClusterIdentifier: string;
}
