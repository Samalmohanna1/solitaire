const STORAGE_KEY = 'solitaire-stats';

export type StatsStorage = Pick<Storage, 'getItem' | 'setItem'>;

type StatsData = {
    gamesPlayed: number;
    gamesWon: number;
    currentStreak: number;
    bestStreak: number;
    bestScore: number | null;
    // the fastest win, in seconds
    bestTime: number | null;
    // a game was started but hasn't been won, so starting another one breaks the win streak
    isGameInProgress: boolean;
};

export type WinResult = {
    isBestScore: boolean;
    isBestTime: boolean;
};

function getLocalStorage(): StatsStorage | undefined {
    try {
        return window.localStorage;
    } catch {
        // some browsers block storage, for example in private browsing
        return undefined;
    }
}

function toCount(value: unknown): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function toBest(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * The player's stats across games, kept in the browser's local storage. If storage isn't available the stats still
 * work, but only until the page is closed.
 */
export class GameStats {
    #storage: StatsStorage | undefined;
    #data: StatsData;

    constructor(storage: StatsStorage | undefined = getLocalStorage()) {
        this.#storage = storage;
        this.#data = this.#load();
    }

    get gamesPlayed(): number {
        return this.#data.gamesPlayed;
    }

    get gamesWon(): number {
        return this.#data.gamesWon;
    }

    get currentStreak(): number {
        return this.#data.currentStreak;
    }

    get bestStreak(): number {
        return this.#data.bestStreak;
    }

    get bestScore(): number | null {
        return this.#data.bestScore;
    }

    get bestTime(): number | null {
        return this.#data.bestTime;
    }

    /**
     * Counts a new game as played. Called on the first move of a game, so deals the player never touches don't count.
     * If the previous game was started but never won, the win streak starts over.
     */
    public recordGameStarted(): void {
        if (this.#data.isGameInProgress) {
            this.#data.currentStreak = 0;
        }
        this.#data.gamesPlayed += 1;
        this.#data.isGameInProgress = true;
        this.#save();
    }

    /**
     * Counts a win, and says whether its score and time are the player's best.
     */
    public recordWin(score: number, timeInSeconds: number): WinResult {
        const isBestScore = this.#data.bestScore === null || score > this.#data.bestScore;
        const isBestTime = this.#data.bestTime === null || timeInSeconds < this.#data.bestTime;

        this.#data.gamesWon += 1;
        this.#data.currentStreak += 1;
        this.#data.bestStreak = Math.max(this.#data.bestStreak, this.#data.currentStreak);
        if (isBestScore) {
            this.#data.bestScore = score;
        }
        if (isBestTime) {
            this.#data.bestTime = timeInSeconds;
        }
        this.#data.isGameInProgress = false;
        this.#save();

        return { isBestScore, isBestTime };
    }

    #load(): StatsData {
        let saved: Partial<Record<keyof StatsData, unknown>> | null = null;
        try {
            saved = JSON.parse(this.#storage?.getItem(STORAGE_KEY) ?? 'null');
        } catch {
            // unreadable stats start over
        }
        if (typeof saved !== 'object' || saved === null) {
            saved = {};
        }

        return {
            gamesPlayed: toCount(saved.gamesPlayed),
            gamesWon: toCount(saved.gamesWon),
            currentStreak: toCount(saved.currentStreak),
            bestStreak: toCount(saved.bestStreak),
            bestScore: toBest(saved.bestScore),
            bestTime: toBest(saved.bestTime),
            isGameInProgress: saved.isGameInProgress === true,
        };
    }

    #save(): void {
        try {
            this.#storage?.setItem(STORAGE_KEY, JSON.stringify(this.#data));
        } catch {
            // storage can be full or blocked, in which case the stats only last until the page is closed
        }
    }
}
