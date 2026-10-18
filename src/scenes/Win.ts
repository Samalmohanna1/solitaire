import { Scene, GameObjects } from 'phaser';
import { ASSET_KEYS, SCENE_KEYS, formatTime } from './Commons';
import { GameStats } from '../lib/stats';

const NEW_BEST_COLOR = '#F2C14E'
const textStyle = { font: '40px Raleway', fontStyle: 'bold', color: '#FFFEFF' }
const newBestStyle = { font: '30px Raleway', fontStyle: 'bold', color: NEW_BEST_COLOR }
const statsStyle = { font: '30px Raleway', color: '#FFFEFF' }

export type WinData = {
    moves: number
    score: number
    // in seconds
    time: number
    isBestScore: boolean
    isBestTime: boolean
    stats: GameStats
}

export class Win extends Scene {
    start: GameObjects.Image;
    #winData: WinData;

    constructor() {
        super({ key: SCENE_KEYS.WIN });
    }

    init(data: WinData) {
        this.#winData = data
    }

    create() {
        const { moves, score, time, isBestScore, isBestTime, stats } = this.#winData
        const centerY = this.scale.height / 2

        this.cameras.main.fadeIn(1000)
        this.add.image(0, 0, ASSET_KEYS.WIN).setOrigin(0);
        this.start = this.add.image(300, centerY + 335, ASSET_KEYS.PLAY_AGAIN).setInteractive({ useHandCursor: true }).setOrigin(0, .5)

        this.#addResult(centerY - 40, 'Moves:     -----------------------', `${moves}`, false)
        this.#addResult(centerY + 15, 'Score:       -----------------------', `${score}`, isBestScore)
        this.#addResult(centerY + 70, 'Time:        -----------------------', formatTime(time), isBestTime)

        let newBest = ''
        if (isBestScore && isBestTime) {
            newBest = 'New best score and time!'
        } else if (isBestScore) {
            newBest = 'New best score!'
        } else if (isBestTime) {
            newBest = 'New best time!'
        }
        this.add.text(215, centerY + 132, newBest, newBestStyle)

        const bestStreak = stats.bestStreak > stats.currentStreak ? ` (best ${stats.bestStreak})` : ''
        this.add
            .text(215, centerY + 175, `Games won: ${stats.gamesWon} of ${stats.gamesPlayed}   ·   Win streak: ${stats.currentStreak}${bestStreak}`, statsStyle)
            .setAlpha(0.8)
        this.add
            .text(215, centerY + 217, `Best score: ${stats.bestScore ?? score}   ·   Best time: ${formatTime(stats.bestTime ?? time)}`, statsStyle)
            .setAlpha(0.8)

        this.start.on('pointerdown', () => {
            this.cameras.main.fadeOut(1000, 0, 0, 0, (camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
                if (progress !== 1) {
                    return
                }
                this.scene.start(SCENE_KEYS.GAME);
            })

        });
    }

    // a result row for this game, with its value shown in gold when it's the player's best
    #addResult(y: number, label: string, value: string, isNewBest: boolean): void {
        this.add.text(215, y, label, textStyle)
        this.add.text(1025, y, value, { ...textStyle, color: isNewBest ? NEW_BEST_COLOR : textStyle.color }).setOrigin(1, 0)
    }
}
