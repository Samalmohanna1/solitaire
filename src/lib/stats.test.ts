import { describe, expect, it } from 'vitest';
import { GameStats, StatsStorage } from './stats';

function createStorage(): StatsStorage & { items: Map<string, string> } {
    const items = new Map<string, string>();
    return {
        items,
        getItem: (key) => items.get(key) ?? null,
        setItem: (key, value) => {
            items.set(key, value);
        },
    };
}

function playAndWin(stats: GameStats, score = 100, time = 300) {
    stats.recordGameStarted();
    return stats.recordWin(score, time);
}

describe('GameStats', () => {
    it('starts with no games played and no bests', () => {
        const stats = new GameStats(createStorage());

        expect([stats.gamesPlayed, stats.gamesWon, stats.currentStreak, stats.bestStreak]).toEqual([0, 0, 0, 0]);
        expect(stats.bestScore).toBeNull();
        expect(stats.bestTime).toBeNull();
    });

    it('counts games played and won, and grows the win streak with each win in a row', () => {
        const stats = new GameStats(createStorage());
        playAndWin(stats);
        playAndWin(stats);

        expect(stats.gamesPlayed).toBe(2);
        expect(stats.gamesWon).toBe(2);
        expect(stats.currentStreak).toBe(2);
        expect(stats.bestStreak).toBe(2);
    });

    it('breaks the win streak when a started game is never won, but keeps the best streak', () => {
        const stats = new GameStats(createStorage());
        playAndWin(stats);
        playAndWin(stats);
        stats.recordGameStarted();
        playAndWin(stats);

        expect(stats.gamesPlayed).toBe(4);
        expect(stats.gamesWon).toBe(3);
        expect(stats.currentStreak).toBe(1);
        expect(stats.bestStreak).toBe(2);
    });

    it('keeps the highest score and the fastest time, and says when a win beats them', () => {
        const stats = new GameStats(createStorage());

        expect(playAndWin(stats, 100, 300)).toEqual({ isBestScore: true, isBestTime: true });
        expect(playAndWin(stats, 80, 250)).toEqual({ isBestScore: false, isBestTime: true });
        expect(playAndWin(stats, 150, 400)).toEqual({ isBestScore: true, isBestTime: false });
        expect(playAndWin(stats, 150, 250)).toEqual({ isBestScore: false, isBestTime: false });
        expect(stats.bestScore).toBe(150);
        expect(stats.bestTime).toBe(250);
    });

    it('remembers stats the next time the game is opened', () => {
        const storage = createStorage();
        playAndWin(new GameStats(storage), 120, 200);
        new GameStats(storage).recordGameStarted();

        const reopened = new GameStats(storage);
        expect([reopened.gamesPlayed, reopened.gamesWon, reopened.bestScore, reopened.bestTime]).toEqual([2, 1, 120, 200]);

        // the game left unfinished before reopening breaks the streak
        playAndWin(reopened);
        expect(reopened.currentStreak).toBe(1);
    });

    it('ignores saved stats that are unreadable or the wrong shape', () => {
        const unreadable = createStorage();
        unreadable.setItem('solitaire-stats', '{not json');
        const wrongShape = createStorage();
        wrongShape.setItem('solitaire-stats', JSON.stringify({ gamesPlayed: -3, gamesWon: 'lots', bestScore: 90, bestTime: null }));

        expect(new GameStats(unreadable).gamesPlayed).toBe(0);
        const stats = new GameStats(wrongShape);
        expect([stats.gamesPlayed, stats.gamesWon, stats.bestScore, stats.bestTime]).toEqual([0, 0, 90, null]);
    });

    it('still works when storage is unavailable or throws', () => {
        const throwingStorage: StatsStorage = {
            getItem: () => {
                throw new Error('blocked');
            },
            setItem: () => {
                throw new Error('full');
            },
        };

        for (const stats of [new GameStats(undefined), new GameStats(throwingStorage)]) {
            expect(playAndWin(stats)).toEqual({ isBestScore: true, isBestTime: true });
            expect(stats.gamesWon).toBe(1);
        }
    });
});
