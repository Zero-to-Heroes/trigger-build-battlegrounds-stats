/* eslint-disable @typescript-eslint/no-use-before-define */
import { parseHsReplayString, Replay } from '@firestone-hs/hs-replay-xml-parser';
import fetch, { RequestInfo } from 'node-fetch';
import db from './db/rds';
import { PlayerStat } from './model/player-stat';
import { buildPlayerStats } from './player-stats-builder';
import { ReviewMessage } from './review-message';

export class StatsBuilder {
	public async buildStats(messages: readonly ReviewMessage[]): Promise<readonly PlayerStat[]> {
		return (await Promise.all(messages.map(msg => this.buildStat(msg)))).reduce((a, b) => a.concat(b), []);
	}

	private async buildStat(message: ReviewMessage): Promise<readonly PlayerStat[]> {
		console.log('processing message', message);
		if (message.gameMode !== 'battlegrounds') {
			console.log('not a battlegrounds game, not processing');
			return null;
		}
		console.log('building stat for', message.replayKey);
		const replayString = await this.loadReplayString(message.replayKey);
		if (!replayString || replayString.length === 0) {
			console.log('empty replay, returning');
			return null;
		}
		console.log('loaded replay string', replayString.length);
		try {
			console.log('parsing replay');
			const replay: Replay = parseHsReplayString(replayString);
			console.log('parsed replay');
			const playerStats: readonly PlayerStat[] = buildPlayerStats(replay, message.reviewId);
			console.log('built player stats', playerStats);
			const mysql = await db.getConnection();
			console.log('acquired mysql connection');
			await this.saveStats(mysql, playerStats);
			console.log('result saved');
			await mysql.end();
			return playerStats;
		} catch (e) {
			console.warn('Could not build replay for', message.reviewId, e);
			return null;
		}
	}

	private async saveStats(mysql, playerStats: readonly PlayerStat[]): Promise<void> {
		const values = playerStats.map(stat => `('${stat.heroCardId}', '${stat.finalRank}', '${stat.tavernUpgrade}')`);
		const valuesString = values.join(',');
		const query = `
				INSERT INTO player_match_recap (
					heroCardId,
					finalRank,
					tavernUpgrade
				)
				VALUES ${valuesString}`;

		await mysql.query(query);
	}

	private async loadReplayString(replayKey: string): Promise<string> {
		const data = await http(`https://s3-us-west-2.amazonaws.com/com.zerotoheroes.output/${replayKey}`);
		return data;
	}
}

const http = async (request: RequestInfo): Promise<any> => {
	return new Promise(resolve => {
		fetch(request)
			.then(response => {
				console.log('received response, reading text body');
				return response.text();
			})
			.then(body => {
				console.log('sending back body', body && body.length);
				resolve(body);
			});
	});
};
