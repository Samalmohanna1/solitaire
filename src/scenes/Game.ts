import { Scene } from 'phaser';
import { ASSET_KEYS, SCENE_KEYS } from './Commons';

const DEBUG = false;
const SCALE = 1.5;
const CARD_BACK_FRAME = 52;
const SUIT_FRAMES = {
    HEART: 26,
    DIAMOND: 13,
    SPADES: 39,
    CLUBS: 0
}

const FOUNDATION_PILE_X_POSITIONS = [360, 425, 490, 555]
const FOUNDATION_PILE_Y_POSITION = 5
const DISCARD_PILE_X_POSITIONS = 85
const DISCARD_PILE_Y_POSITIONS = 5
const DRAW_PILE_X_POSITIONS = 5
const DRAW_PILE_Y_POSITIONS = 5
const TABLEAU_PILE_X_POSITIONS = 40
const TABLEAU_PILE_Y_POSITIONS = 92


export class Game extends Scene {
    drawPileCards!: Phaser.GameObjects.Image[]
    discardPileCards!: Phaser.GameObjects.Image[]
    foundationPileCards!: Phaser.GameObjects.Image[]
    tableauContainers!: Phaser.GameObjects.Container[]

    constructor() {
        super({ key: SCENE_KEYS.GAME });
    }

    create() {
        this.createDrawPile()
        this.createDiscardPile()
        this.createFoundationPiles()
        this.createTableauPiles()
        this.add.image(0, 0, ASSET_KEYS.TABLE).setOrigin(0).setDepth(-1)
    }

    createDrawPile() {
        this.drawCardLocationBox(DRAW_PILE_X_POSITIONS, DRAW_PILE_Y_POSITIONS)
        this.drawPileCards = []
        for (let i = 0; i < 3; i++) {
            this.drawPileCards.push(this.createCard(DRAW_PILE_X_POSITIONS + i * 5, DRAW_PILE_Y_POSITIONS))
        }
    }

    drawCardLocationBox(x: number, y: number) {
        this.add.rectangle(x, y, 56, 78).setOrigin(0).setStrokeStyle(2, 0x000000, .5)
    }

    createCard(x: number, y: number): Phaser.GameObjects.Image {
        return this.add.image(x, y, ASSET_KEYS.CARDS, CARD_BACK_FRAME).setOrigin(0).setScale(SCALE)
    }

    createDiscardPile() {
        this.drawCardLocationBox(DISCARD_PILE_X_POSITIONS, DISCARD_PILE_Y_POSITIONS)
        this.discardPileCards = []
        const bottomCard = this.createCard(DISCARD_PILE_X_POSITIONS, DISCARD_PILE_Y_POSITIONS).setVisible(false)
        const topCard = this.createCard(DISCARD_PILE_X_POSITIONS, DISCARD_PILE_Y_POSITIONS).setVisible(false)
        this.discardPileCards.push(bottomCard, topCard)
    }

    createFoundationPiles() {
        this.foundationPileCards = []
        FOUNDATION_PILE_X_POSITIONS.forEach((x) => {
            this.drawCardLocationBox(x, FOUNDATION_PILE_Y_POSITION)
            const card = this.createCard(x, FOUNDATION_PILE_Y_POSITION).setVisible(false)
            this.foundationPileCards.push(card)
        })

    }

    createTableauPiles() {
        this.tableauContainers = []
        for (let i = 0; i < 7; i++) {
            const x = TABLEAU_PILE_X_POSITIONS + i * 85
            const tableauContainer = this.add.container(x, TABLEAU_PILE_Y_POSITIONS, [])
            this.tableauContainers.push(tableauContainer)
            for (let j = 0; j < i + 1; j++) {
                const cardGameObject = this.createCard(0, j * 20)
                tableauContainer.add(cardGameObject)
            }
        }
    }
}
