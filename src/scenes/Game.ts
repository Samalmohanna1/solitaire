import { Scene } from 'phaser';
import { ASSET_KEYS, CARD_HEIGHT, CARD_WIDTH, SCENE_KEYS } from './Commons';
import { Solitaire } from '../lib/solitaier';

const DEBUG = true;
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

type ZoneType = keyof typeof ZONE_TYPE
const ZONE_TYPE = {
    FOUNDATION: 'FOUNDATION',
    TABLEAU: 'TABLEAU'
} as const

export class Game extends Scene {
    drawPileCards!: Phaser.GameObjects.Image[]
    discardPileCards!: Phaser.GameObjects.Image[]
    foundationPileCards!: Phaser.GameObjects.Image[]
    tableauContainers!: Phaser.GameObjects.Container[]
    solitaire!: Solitaire

    constructor() {
        super({ key: SCENE_KEYS.GAME });
    }

    create() {
        this.createDrawPile()
        this.createDiscardPile()
        this.createFoundationPiles()
        this.createTableauPiles()
        this.createDragEvents()
        this.createDropZones()
        this.solitaire = new Solitaire()
        this.solitaire.newGame()
        this.add.image(0, 0, ASSET_KEYS.TABLE).setOrigin(0).setDepth(-1)
    }

    createDrawPile() {
        this.drawCardLocationBox(DRAW_PILE_X_POSITIONS, DRAW_PILE_Y_POSITIONS)
        this.drawPileCards = []
        for (let i = 0; i < 3; i++) {
            this.drawPileCards.push(this.createCard(DRAW_PILE_X_POSITIONS + i * 5, DRAW_PILE_Y_POSITIONS, false))
        }
        const drawZone = this.add.zone(0, 0, CARD_WIDTH * SCALE + 20, CARD_HEIGHT * SCALE + 12).setOrigin(0).setInteractive()

        drawZone.on(Phaser.Input.Events.POINTER_DOWN, () => {
            this.discardPileCards[0].setFrame(this.discardPileCards[1].frame).setVisible(this.discardPileCards[1].visible)
            this.discardPileCards[1].setFrame(CARD_BACK_FRAME).setVisible(true)
        })

        if (DEBUG) {
            this.add.rectangle(drawZone.x, drawZone.y, drawZone.width, drawZone.height, 0xff0000, 0.5).setOrigin(0)
        }
    }

    drawCardLocationBox(x: number, y: number) {
        this.add.rectangle(x, y, 56, 78).setOrigin(0).setStrokeStyle(2, 0x000000, .5)
    }

    createCard(x: number, y: number, draggable: boolean, cardIndex?: number, pileIndex?: number): Phaser.GameObjects.Image {
        return this.add.image(x, y, ASSET_KEYS.CARDS, CARD_BACK_FRAME).setOrigin(0).setScale(SCALE).setInteractive({ draggable: draggable }).setData({
            x, y, cardIndex, pileIndex
        })
    }

    createDiscardPile() {
        this.drawCardLocationBox(DISCARD_PILE_X_POSITIONS, DISCARD_PILE_Y_POSITIONS)
        this.discardPileCards = []
        const bottomCard = this.createCard(DISCARD_PILE_X_POSITIONS, DISCARD_PILE_Y_POSITIONS, true).setVisible(false)
        const topCard = this.createCard(DISCARD_PILE_X_POSITIONS, DISCARD_PILE_Y_POSITIONS, true).setVisible(false)
        this.discardPileCards.push(bottomCard, topCard)
    }

    createFoundationPiles() {
        this.foundationPileCards = []
        FOUNDATION_PILE_X_POSITIONS.forEach((x) => {
            this.drawCardLocationBox(x, FOUNDATION_PILE_Y_POSITION)
            const card = this.createCard(x, FOUNDATION_PILE_Y_POSITION, false).setVisible(false)
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
                const cardGameObject = this.createCard(0, j * 20, true, j, i)
                tableauContainer.add(cardGameObject)
            }
        }
    }

    createDragEvents() {
        this.createDragStartEventListener()
        this.createDragEventListener()
        this.createDragEndEventListener()
        this.createDropEventListener()
    }

    createDragStartEventListener() {
        this.input.on(Phaser.Input.Events.DRAG_START, (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
            gameObject.setData({ x: gameObject.x, y: gameObject.y })
            const tableauPileIndex = gameObject.getData('pileIndex') as number | undefined

            if (tableauPileIndex !== undefined) {
                this.tableauContainers[tableauPileIndex].setDepth(2)
            } else {
                gameObject.setDepth(2)
            }
            gameObject.setAlpha(0.5)
        })
    }
    createDragEventListener() {
        this.input.on(Phaser.Input.Events.DRAG, (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image, dragX: number, dragY: number) => {
            gameObject.setPosition(dragX, dragY)

            const tableauPileIndex = gameObject.getData('pileIndex') as number | undefined
            const cardIndex = gameObject.getData('cardIndex') as number

            if (tableauPileIndex !== undefined) {
                const numberOfCardsToMove = this.getNumberOfCardsToMoveAsPartOfStack(tableauPileIndex, cardIndex)
                for (let i = 1; i <= numberOfCardsToMove; i++) {
                    this.tableauContainers[tableauPileIndex]
                        .getAt<Phaser.GameObjects.Image>(cardIndex + i)
                        .setPosition(dragX, dragY + 20 * i)
                }
            }
        })
    }
    createDragEndEventListener() {
        this.input.on(Phaser.Input.Events.DRAG_END, (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
            const tableauPileIndex = gameObject.getData('pileIndex') as number | undefined

            if (tableauPileIndex !== undefined) {
                this.tableauContainers[tableauPileIndex].setDepth(0)
            } else {
                gameObject.setDepth(0)
            }
            if (gameObject.active) {
                gameObject.setAlpha(1)
                gameObject.setPosition(gameObject.getData('x') as number, gameObject.getData('y') as number)

                const cardIndex = gameObject.getData('cardIndex') as number

                if (tableauPileIndex !== undefined) {
                    const numberOfCardsToMove = this.getNumberOfCardsToMoveAsPartOfStack(tableauPileIndex, cardIndex)
                    for (let i = 1; i <= numberOfCardsToMove; i++) {
                        const cardsToMove = this.tableauContainers[tableauPileIndex]
                            .getAt<Phaser.GameObjects.Image>(cardIndex + i)
                        cardsToMove.setPosition(cardsToMove.getData('x') as number, cardsToMove.getData('y') as number)
                    }
                }
            }

        })
    }

    getNumberOfCardsToMoveAsPartOfStack(tableauPileIndex: number, cardIndex: number): number {
        if (tableauPileIndex !== undefined) {
            const lastCardIndex = this.tableauContainers[tableauPileIndex].length - 1
            return lastCardIndex - cardIndex
        }
        return 0
    }


    createDropZones() {
        let zone = this.add.zone(350, 0, 270, 85).setOrigin(0).setRectangleDropZone(270, 85).setData({ zoneType: ZONE_TYPE.FOUNDATION })

        if (DEBUG) {
            this.add.rectangle(zone.x, zone.y, zone.width, zone.height, 0xff0000, .2).setOrigin(0)
        }

        for (let i = 0; i < 7; i++) {
            zone = this.add.zone(30 + i * 85, 92, 75.5, 585)
                .setOrigin(0)
                .setRectangleDropZone(75.5, 585)
                .setData({ zoneType: ZONE_TYPE.TABLEAU, tableauIndex: i })
                .setDepth(-1)
            if (DEBUG) {
                this.add.rectangle(zone.x, zone.y, zone.width, zone.height, 0xff0000, .2).setOrigin(0)
            }
        }
    }


    createDropEventListener() {
        this.input.on(Phaser.Input.Events.DROP, (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image, dropZone: Phaser.GameObjects.Zone) => {
            const zoneType = dropZone.getData('zoneType') as ZoneType
            if (zoneType === ZONE_TYPE.FOUNDATION) {
                this.handleMoveCardToFoundation(gameObject)
                return
            }
            const tableauIndex = dropZone.getData('tableauIndex') as number
            this.handleMoveCardTableau(gameObject, tableauIndex)
        })
    }

    handleMoveCardToFoundation(gameObject: Phaser.GameObjects.Image) {
        let isValidMove = false
        let isCardFromDiscardPile = false
        const tableauPileIndex = gameObject.getData('pileIndex') as number | undefined
        if (tableauPileIndex === undefined) {
            isValidMove = this.solitaire.playDiscardPileToFoundation()
        } else {
            isValidMove = this.solitaire.moveTableauCardToFoundation(tableauPileIndex)
        }
        if (!isValidMove) {
            return
        }

        if (isCardFromDiscardPile) {
            this.updateCardGameObjectInDescardPile()
        } else {
            this.handleRevealingNewTableauCards(tableauPileIndex as number)
        }
        if (!isCardFromDiscardPile) {
            gameObject.destroy()
        }
        this.updateFoundationPiles()
    }

    handleMoveCardTableau(gameObject: Phaser.GameObjects.Image, targetTableauPileIndex: number) {
        let isValidMove = false
        let isCardFromDiscardPile = false

        const originalTargetPileSize = this.tableauContainers[targetTableauPileIndex].length

        const tableauPileIndex = gameObject.getData('pileIndex') as number | undefined
        const tableauCardIndex = gameObject.getData('cardIndex') as number
        if (tableauPileIndex === undefined) {
            isValidMove = this.solitaire.playDiscardPileToTableau(targetTableauPileIndex)
            isCardFromDiscardPile = true
        } else {
            isValidMove = this.solitaire.moveTableauCardToAnotherTableau(tableauPileIndex, tableauCardIndex, targetTableauPileIndex)
        }

        if (!isValidMove) {
            return
        }

        if (isCardFromDiscardPile) {
            const card = this.createCard(0, originalTargetPileSize * 20, true, originalTargetPileSize, targetTableauPileIndex)
            card.setFrame(gameObject.frame)
            this.tableauContainers[targetTableauPileIndex].add(card)

            this.updateCardGameObjectInDescardPile()
            return
        }
        const numberOfCardsToMove = this.getNumberOfCardsToMoveAsPartOfStack(tableauPileIndex as number, tableauCardIndex)
        for (let i = 0; i <= numberOfCardsToMove; i++) {
            const cardGameObject = this.tableauContainers[tableauPileIndex as number].getAt<Phaser.GameObjects.Image>(tableauCardIndex)
            this.tableauContainers[tableauPileIndex as number].removeAt(tableauCardIndex)
            this.tableauContainers[targetTableauPileIndex].add(cardGameObject)

            const cardIndex = originalTargetPileSize + i
            cardGameObject.setData({ x: 0, y: cardIndex * 20, cardIndex, pileIndex: targetTableauPileIndex })
        }
        this.tableauContainers[tableauPileIndex as number].setDepth(0)
        this.handleRevealingNewTableauCards(tableauPileIndex as number)
    }

    updateCardGameObjectInDescardPile() {
        this.discardPileCards[1].setFrame(this.discardPileCards[0].frame).setVisible(this.discardPileCards[0].visible)
        this.discardPileCards[0].setVisible(false)
    }

    handleRevealingNewTableauCards(tableauPileIndex: number) {

    }

    updateFoundationPiles() {

    }
}
