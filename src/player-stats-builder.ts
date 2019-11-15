/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser';
import { CardType, GameTag } from '@firestone-hs/reference-data';
import { Element } from 'elementtree';
import { PlayerStat } from './model/player-stat';

export const buildPlayerStats = (replay: Replay, matchId: string): readonly PlayerStat[] => {
	console.log('replay', replay.mainPlayerId, replay.opponentPlayerId);
	const playerEntities = replay.replay
		.findall(`.//FullEntity`)
		.filter(fullEntity => fullEntity.find(`.Tag[@tag='${GameTag.CARDTYPE}'][@value='${CardType.HERO}']`))
		.filter(fullEntity => {
			const controllerId = parseInt(fullEntity.find(`.Tag[@tag='${GameTag.CONTROLLER}']`).get('value'));
			console.log('controllerId', controllerId);
			return controllerId === replay.mainPlayerId || controllerId === replay.opponentPlayerId;
		})
		.filter(
			fullEntity =>
				['TB_BaconShop_HERO_PH', 'TB_BaconShop_HERO_KelThuzad', 'TB_BaconShopBob'].indexOf(
					fullEntity.get('cardID'),
				) === -1,
		);

	// Each player has one ID per match, so we need to aggregate all of them
	// It also inclues the choices during mulligan, which should be ok since they are not assigned any info
	const playerCardIds = [...new Set(playerEntities.map(entity => entity.get('cardID')))];
	console.log('found players', playerCardIds.length, playerCardIds);

	const result: readonly PlayerStat[] = playerCardIds
		.map(cardId => buildPlayerStat(playerEntities, cardId, replay))
		.filter(stat => stat)
		.map(stat =>
			Object.assign(new PlayerStat(), {
				matchId: matchId,
			} as PlayerStat),
		)
		.sort((a, b) => a.finalRank - b.finalRank);
	console.log('result', result);
	return result;
};

const buildPlayerStat = (playerEntities: readonly Element[], cardId: string, replay: Replay): PlayerStat => {
	const entities = playerEntities.filter(entity => entity.get('cardID') === cardId);
	const entityIds = entities.map(entity => parseInt(entity.get('id') || entity.get('entity')));

	const leaderboardValue = findLastValueOfTag(replay, entityIds, GameTag.PLAYER_LEADERBOARD_PLACE);
	// console.log(cardId, 'placed', leaderboardValue);
	const tavernUpgrades = findLastValueOfTag(replay, entityIds, GameTag.PLAYER_TECH_LEVEL);
	// console.log(cardId, 'tavernUpgrades', tavernUpgrades);
	if (!leaderboardValue) {
		return null;
	}
	return Object.assign(new PlayerStat(), {
		heroCardId: cardId,
		finalRank: leaderboardValue,
		tavernUpgrade: tavernUpgrades || 0,
	} as PlayerStat);
};

const findLastValueOfTag = (replay: Replay, entityIds: readonly number[], tag: GameTag): number => {
	const tags = replay.replay
		.findall(`.//TagChange[@tag='${tag}']`)
		.filter(tag => entityIds.indexOf(parseInt(tag.get('entity'))) !== -1)
		.map(tag => parseInt(tag.get('value')))
		// Not sure why sometimes it resets to 0
		.filter(value => value > 0);
	if (!tags || tags.length === 0) {
		return null;
	}
	return tags[tags.length - 1];
};
