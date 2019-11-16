/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser';
import { CardType, GameTag } from '@firestone-hs/reference-data';
import { Element } from 'elementtree';
import { PlayerStat } from './model/player-stat';
import { ReviewMessage } from './review-message';

export const buildPlayerStats = (replay: Replay, review: ReviewMessage): readonly PlayerStat[] => {
	const playerEntities = replay.replay
		.findall(`.//FullEntity`)
		.filter(fullEntity => fullEntity.find(`.Tag[@tag='${GameTag.CARDTYPE}'][@value='${CardType.HERO}']`))
		.filter(fullEntity => {
			const controllerId = parseInt(fullEntity.find(`.Tag[@tag='${GameTag.CONTROLLER}']`).get('value'));
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
	console.log(playerCardIds);

	const result: readonly PlayerStat[] = playerCardIds
		.map(cardId => buildPlayerStat(playerEntities, cardId, replay))
		.filter(stat => stat)
		.map(stat =>
			Object.assign(new PlayerStat(), stat, {
				matchId: review.reviewId,
				playerRank: +review.playerRank > 100 ? +review.playerRank : null,
			} as PlayerStat),
		)
		.sort((a, b) => a.finalRank - b.finalRank);
	console.log('result', result);
	if (result.length !== 8) {
		console.error('InvalidStatCount: ', result.length);
	}
	return result;
};

const buildPlayerStat = (playerEntities: readonly Element[], cardId: string, replay: Replay): PlayerStat => {
	const entities = playerEntities.filter(entity => entity.get('cardID') === cardId);

	const leaderboardValue = findLastValueOfTag(replay, entities, GameTag.PLAYER_LEADERBOARD_PLACE);
	// console.log(cardId, 'placed', cardId, leaderboardValue);
	if (!leaderboardValue) {
		return null;
	}
	const tavernUpgrades = findLastValueOfTag(replay, entities, GameTag.PLAYER_TECH_LEVEL);
	// console.log(cardId, 'tavernUpgrades', cardId, tavernUpgrades);
	return Object.assign(new PlayerStat(), {
		heroCardId: cardId,
		finalRank: leaderboardValue,
		tavernUpgrade: tavernUpgrades || 0,
	} as PlayerStat);
};

const findLastValueOfTag = (replay: Replay, entities: readonly Element[], tag: GameTag): number => {
	const entityIds = entities.map(entity => parseInt(entity.get('id') || entity.get('entity')));
	const tags = replay.replay
		.findall(`.//TagChange[@tag='${tag}']`)
		.filter(tag => entityIds.indexOf(parseInt(tag.get('entity'))) !== -1)
		.map(tag => parseInt(tag.get('value')))
		// Not sure why sometimes it resets to 0
		.filter(value => value > 0);
	if (!tags || tags.length === 0) {
		const initialPositions = entities
			.map(entity => entity.find(`.//Tag[@tag='${tag}']`))
			.filter(tag => tag)
			.map(tag => parseInt(tag.get('value')))
			.filter(value => value > 0);
		return initialPositions && initialPositions.length > 0 ? initialPositions[initialPositions.length - 1] : null;
	}
	return tags[tags.length - 1];
};
