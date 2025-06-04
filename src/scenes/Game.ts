import * as Phaser from 'phaser'
import { ASSET_KEYS, CARD_HEIGHT, CARD_WIDTH, SCENE_KEYS } from './Commons'
import { Solitaire } from '../lib/solitaire'
import { Card } from '../lib/card'
import { FoundationPile } from '../lib/foundationPile'

const DEBUG = false
const SCALE = 1.6
const CARD_BACK_FRAME = 54
const FOUNDATION_PILE_X_POSITIONS = [870, 1090, 1313, 1530]
const FOUNDATION_PILE_Y_POSITION = 30
const DISCARD_PILE_X_POSITION = 430
const DISCARD_PILE_Y_POSITION = 30
const DRAW_PILE_X_POSITION = 200
const DRAW_PILE_Y_POSITION = 30
const TABLEAU_PILE_X_POSITION = 200
const TABLEAU_PILE_Y_POSITION = 320
const TABLEAU_PILE_SPACER_X = 222
const TABLEAU_PILE_SPACER_Y = 35
const SUIT_FRAMES = {
    HEART: 26,
    DIAMOND: 13,
    SPADE: 39,
    CLUB: 0,
}
let numberOfMoves = 0
const textStyle = { font: '34px Raleway', fontStyle: 'bold', color: '#FFFEFF' }

function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const minutesStr = minutes.toString().padStart(2, '0');
    const secondsStr = secs.toString().padStart(2, '0');
    return `${minutesStr}:${secondsStr}`;
}


type ZoneType = keyof typeof ZONE_TYPE
const ZONE_TYPE = {
    FOUNDATION: 'FOUNDATION',
    TABLEAU: 'TABLEAU',
} as const

export class Game extends Phaser.Scene {
    #solitaire!: Solitaire
    #drawPileCards!: Phaser.GameObjects.Image[]
    #discardPileCards!: Phaser.GameObjects.Image[]
    #foundationPileCards!: Phaser.GameObjects.Image[]
    #tableauContainers!: Phaser.GameObjects.Container[]
    moveCounterText: Phaser.GameObjects.Text
    timerEvent!: Phaser.Time.TimerEvent;
    timerText!: Phaser.GameObjects.Text;
    timerRunning: boolean = false;
    elapsedTime: number = 0;
    score: number = 0;
    scoreText!: Phaser.GameObjects.Text

    constructor() {
        super({ key: SCENE_KEYS.GAME })
    }

    public create(): void {
        this.cameras.main.fadeIn(1000)
        this.#solitaire = new Solitaire()
        this.#solitaire.newGame()

        this.#createDrawPile()
        this.#createDiscardPile()
        this.#createFoundationPiles()
        this.#createTableauPiles()

        this.#createDragEvents()
        this.#createDropZones()

        this.elapsedTime = 0;
        this.timerRunning = true;
        this.score = 0
        this.scoreText = this.add.text(760, TABLEAU_PILE_SPACER_Y + 990, 'Score: 0', textStyle);

        this.timerText = this.add.text(460, TABLEAU_PILE_SPACER_Y + 990, 'Time: 00:00', textStyle);

        this.timerEvent = this.time.addEvent({
            delay: 1000,
            callback: () => {
                if (this.timerRunning) {
                    this.elapsedTime += 1;
                    this.timerText.setText('Time: ' + formatTime(this.elapsedTime));
                }
            },
            loop: true,
        });


        this.add.image(0, 0, ASSET_KEYS.TABLE).setOrigin(0).setDepth(-1)

        this.moveCounterText = this.add.text(DRAW_PILE_X_POSITION, TABLEAU_PILE_SPACER_Y + 990, 'Moves: ' + numberOfMoves,
            textStyle)
    }

    #createDrawPile(): void {
        this.#drawCardLocationBox(DRAW_PILE_X_POSITION, DRAW_PILE_Y_POSITION)

        this.#drawPileCards = []
        for (let i = 0; i < 3; i += 1) {
            this.#drawPileCards.push(this.#createCard(DRAW_PILE_X_POSITION + i * 5, DRAW_PILE_Y_POSITION, false))
        }

        const drawZone = this.add
            .zone(DRAW_PILE_X_POSITION, DRAW_PILE_Y_POSITION, CARD_WIDTH * SCALE + TABLEAU_PILE_SPACER_Y, CARD_HEIGHT * SCALE + 12)
            .setOrigin(0)
            .setInteractive()

        drawZone.on(Phaser.Input.Events.POINTER_DOWN, () => {
            if (this.#solitaire.drawPile.length === 0 && this.#solitaire.discardPile.length === 0) {
                return
            }

            if (this.#solitaire.drawPile.length === 0) {
                this.#solitaire.shuffleDiscardPile()
                this.#discardPileCards.forEach((card) => card.setVisible(false))
                this.#showCardsInDrawPile()
                numberOfMoves += 1
                this.moveCounterText.setText('Moves: ' + numberOfMoves);
                return
            }

            this.#solitaire.drawCard()
            this.#showCardsInDrawPile()
            this.#discardPileCards[0].setFrame(this.#discardPileCards[1].frame).setVisible(this.#discardPileCards[1].visible)
            const card = this.#solitaire.discardPile[this.#solitaire.discardPile.length - 1]
            this.#discardPileCards[1].setFrame(this.#getCardFrame(card)).setVisible(true)
            numberOfMoves += 1
            this.moveCounterText.setText('Moves: ' + numberOfMoves);
        })

        if (DEBUG) {
            this.add.rectangle(drawZone.x, drawZone.y, drawZone.width, drawZone.height, 0xff0000, 0.5).setOrigin(0)
        }
    }

    #createDiscardPile(): void {
        this.#drawCardLocationBox(DISCARD_PILE_X_POSITION, DISCARD_PILE_Y_POSITION)

        this.#discardPileCards = []
        const bottomCard = this.#createCard(DISCARD_PILE_X_POSITION, DISCARD_PILE_Y_POSITION, true).setVisible(false)
        const topCard = this.#createCard(DISCARD_PILE_X_POSITION, DISCARD_PILE_Y_POSITION, true).setVisible(false)
        this.#discardPileCards.push(bottomCard, topCard)
    }

    #createFoundationPiles(): void {
        this.#foundationPileCards = []

        FOUNDATION_PILE_X_POSITIONS.forEach((x) => {
            this.#drawCardLocationBox(x, FOUNDATION_PILE_Y_POSITION)
            const card = this.#createCard(x, FOUNDATION_PILE_Y_POSITION, false).setVisible(false)
            this.#foundationPileCards.push(card)
        })
    }

    #createTableauPiles(): void {
        this.#tableauContainers = []

        this.#solitaire.tableauPiles.forEach((pile, pileIndex) => {
            const x = TABLEAU_PILE_X_POSITION + pileIndex * TABLEAU_PILE_SPACER_X
            const tableauContainer = this.add.container(x, TABLEAU_PILE_Y_POSITION, [])
            this.#tableauContainers.push(tableauContainer)
            pile.forEach((card, cardIndex) => {
                const cardGameObject = this.#createCard(0, cardIndex * TABLEAU_PILE_SPACER_Y, false, cardIndex, pileIndex)
                tableauContainer.add(cardGameObject)
                if (card.isFaceUp) {
                    cardGameObject.setFrame(this.#getCardFrame(card))
                    this.input.setDraggable(cardGameObject)
                }
            })
        })
    }

    #drawCardLocationBox(x: number, y: number): void {
        this.add.rectangle(x, y, CARD_WIDTH * SCALE, CARD_HEIGHT * SCALE).setOrigin(0).setStrokeStyle(2, 0x0E0D0D, 0.5)
    }

    #createCard(
        x: number,
        y: number,
        draggable: boolean,
        cardIndex?: number,
        pileIndex?: number,
    ): Phaser.GameObjects.Image {
        return this.add
            .image(x, y, ASSET_KEYS.CARDS, CARD_BACK_FRAME)
            .setOrigin(0)
            .setScale(SCALE)
            .setInteractive({ draggable: draggable })
            .setData({
                x,
                y,
                cardIndex,
                pileIndex,
            })
    }

    #createDragEvents(): void {
        this.#createDragStartEventListener()
        this.#createOnDragEventListener()
        this.#createDragEndEventListener()
        this.#createDropEventListener()
    }

    #createDragStartEventListener(): void {
        this.input.on(
            Phaser.Input.Events.DRAG_START,
            (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
                gameObject.setData({ x: gameObject.x, y: gameObject.y })
                const tableauPileIndex = gameObject.getData('pileIndex') as number | undefined
                if (tableauPileIndex !== undefined) {
                    this.#tableauContainers[tableauPileIndex].setDepth(2)
                } else {
                    gameObject.setDepth(2)
                }
                gameObject.setAlpha(0.8)
            },
        )
    }

    #createOnDragEventListener(): void {
        this.input.on(
            Phaser.Input.Events.DRAG,
            (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image, dragX: number, dragY: number) => {
                gameObject.setPosition(dragX, dragY)
                gameObject.setDepth(50)

                const tableauPileIndex = gameObject.getData('pileIndex') as number | undefined
                const cardIndex = gameObject.getData('cardIndex') as number
                if (tableauPileIndex !== undefined) {
                    const numberOfCardsToMove = this.#getNumberOfCardsToMoveAsPartOfStack(tableauPileIndex, cardIndex)
                    for (let i = 1; i <= numberOfCardsToMove; i += 1) {
                        this.#tableauContainers[tableauPileIndex]
                            .getAt<Phaser.GameObjects.Image>(cardIndex + i)
                            .setPosition(dragX, dragY + TABLEAU_PILE_SPACER_Y * i)
                    }
                }
            },
        )
    }

    #createDragEndEventListener(): void {
        this.input.on(
            Phaser.Input.Events.DRAG_END,
            (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
                const tableauPileIndex = gameObject.getData('pileIndex') as number | undefined
                if (tableauPileIndex !== undefined) {
                    this.#tableauContainers[tableauPileIndex].setDepth(0)
                } else {
                    gameObject.setDepth(0)
                }

                if (gameObject.active) {
                    gameObject.setPosition(gameObject.getData('x') as number, gameObject.getData('y') as number)
                    gameObject.setAlpha(1)

                    const cardIndex = gameObject.getData('cardIndex') as number
                    if (tableauPileIndex !== undefined) {
                        const numberOfCardsToMove = this.#getNumberOfCardsToMoveAsPartOfStack(tableauPileIndex, cardIndex)
                        for (let i = 1; i <= numberOfCardsToMove; i += 1) {
                            const cardToMove = this.#tableauContainers[tableauPileIndex].getAt<Phaser.GameObjects.Image>(
                                cardIndex + i,
                            )
                            cardToMove.setPosition(cardToMove.getData('x') as number, cardToMove.getData('y') as number)
                        }
                    }
                }
            },
        )
    }

    #getNumberOfCardsToMoveAsPartOfStack(tableauPileIndex: number, cardIndex: number): number {
        if (tableauPileIndex !== undefined) {
            const lastCardIndex = this.#tableauContainers[tableauPileIndex].length - 1
            if (lastCardIndex === cardIndex) {
                return 0
            }

            return lastCardIndex - cardIndex
        }
        return 0
    }

    #createDropZones(): void {
        let zone = this.add.zone(FOUNDATION_PILE_X_POSITIONS[0], FOUNDATION_PILE_Y_POSITION, ((CARD_WIDTH * 4) * SCALE + 50 * 3), 175 * SCALE).setOrigin(0).setRectangleDropZone(((CARD_WIDTH * 4) * SCALE + 50 * 3), 175 * SCALE).setData({
            zoneType: ZONE_TYPE.FOUNDATION,
        })
        if (DEBUG) {
            this.add.rectangle(zone.x, zone.y, zone.width, zone.height, 0xff0000, 0.2).setOrigin(0)
        }

        for (let i = 0; i < 7; i += 1) {
            zone = this.add
                .zone(TABLEAU_PILE_X_POSITION + i * TABLEAU_PILE_SPACER_X, TABLEAU_PILE_Y_POSITION, CARD_WIDTH * SCALE, 585)
                .setOrigin(0)
                .setRectangleDropZone(CARD_WIDTH * SCALE, 585)
                .setData({
                    zoneType: ZONE_TYPE.TABLEAU,
                    tableauIndex: i,
                })
                .setDepth(-1)
            if (DEBUG) {
                this.add.rectangle(zone.x, zone.y, zone.width, zone.height, 0xff0000, 0.5).setOrigin(0)
            }
        }
    }

    #createDropEventListener(): void {
        this.input.on(
            Phaser.Input.Events.DROP,
            (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image, dropZone: Phaser.GameObjects.Zone) => {
                const zoneType = dropZone.getData('zoneType') as ZoneType
                if (zoneType === ZONE_TYPE.FOUNDATION) {
                    this.#handleMoveCardToFoundation(gameObject)
                    return
                }
                const tableauIndex = dropZone.getData('tableauIndex') as number
                this.#handleMoveCardTableau(gameObject, tableauIndex)
            },
        )
    }

    #handleMoveCardToFoundation(gameObject: Phaser.GameObjects.Image): void {
        let isValidMove = false
        let isCardFromDiscardPile = false

        const tableauPileIndex = gameObject.getData('pileIndex') as number | undefined
        if (tableauPileIndex === undefined) {
            isValidMove = this.#solitaire.playDiscardPileCardToFoundation()
            isCardFromDiscardPile = true
        } else {
            isValidMove = this.#solitaire.moveTableauCardToFoundation(tableauPileIndex)
        }

        if (!isValidMove) {
            return
        } else {
            numberOfMoves += 1
            this.moveCounterText.setText('Moves: ' + numberOfMoves);
            this.score += 10
            this.scoreText.setText('Score: ' + this.score)
        }

        if (isCardFromDiscardPile) {
            this.#updateCardGameObjectsInDiscardPile()
        } else {
            this.#handleRevealingNewTableauCards(tableauPileIndex as number)
        }

        if (!isCardFromDiscardPile) {
            gameObject.destroy()
        }
        this.#updateFoundationPiles()
    }

    #handleMoveCardTableau(gameObject: Phaser.GameObjects.Image, targetTableauPileIndex: number): void {
        let isValidMove = false
        let isCardFromDiscardPile = false

        const originalTargetPileSize = this.#tableauContainers[targetTableauPileIndex].length

        const tableauPileIndex = gameObject.getData('pileIndex') as number | undefined
        const tableauCardIndex = gameObject.getData('cardIndex') as number
        if (tableauPileIndex === undefined) {
            isValidMove = this.#solitaire.playDiscardPileCardToTableau(targetTableauPileIndex)
            isCardFromDiscardPile = true
        } else {
            isValidMove = this.#solitaire.moveTableauCardsToAnotherTableau(
                tableauPileIndex,
                tableauCardIndex,
                targetTableauPileIndex,
            )
        }
        if (!isValidMove) {
            return
        } else {
            numberOfMoves += 1
            this.moveCounterText.setText('Moves: ' + numberOfMoves);
            if (isCardFromDiscardPile) {
                this.score += 5;
                this.scoreText.setText('Score: ' + this.score);
            }
        }

        if (isCardFromDiscardPile) {
            const card = this.#createCard(
                0,
                originalTargetPileSize * TABLEAU_PILE_SPACER_Y,
                true,
                originalTargetPileSize,
                targetTableauPileIndex,
            )
            card.setFrame(gameObject.frame)
            this.#tableauContainers[targetTableauPileIndex].add(card)
            this.#updateCardGameObjectsInDiscardPile()
            return
        }

        const numberOfCardsToMove = this.#getNumberOfCardsToMoveAsPartOfStack(tableauPileIndex as number, tableauCardIndex)
        for (let i = 0; i <= numberOfCardsToMove; i += 1) {
            const cardGameObject =
                this.#tableauContainers[tableauPileIndex as number].getAt<Phaser.GameObjects.Image>(tableauCardIndex)
            this.#tableauContainers[tableauPileIndex as number].removeAt(tableauCardIndex)
            this.#tableauContainers[targetTableauPileIndex].add(cardGameObject)

            const cardIndex = originalTargetPileSize + i
            cardGameObject.setData({
                x: 0,
                y: cardIndex * TABLEAU_PILE_SPACER_Y,
                cardIndex,
                pileIndex: targetTableauPileIndex,
            })
        }

        this.#tableauContainers[tableauPileIndex as number].setDepth(0)

        this.#handleRevealingNewTableauCards(tableauPileIndex as number)
    }

    #updateCardGameObjectsInDiscardPile(): void {
        this.#discardPileCards[1].setFrame(this.#discardPileCards[0].frame).setVisible(this.#discardPileCards[0].visible)
        const discardPileCard = this.#solitaire.discardPile[this.#solitaire.discardPile.length - 2]
        if (discardPileCard === undefined) {
            this.#discardPileCards[0].setVisible(false)
        } else {
            this.#discardPileCards[0].setFrame(this.#getCardFrame(discardPileCard)).setVisible(true)
        }
    }

    #handleRevealingNewTableauCards(tableauPileIndex: number): void {
        this.#tableauContainers[tableauPileIndex].setDepth(0)
        const flipTableauCard = this.#solitaire.flipTopTableauCard(tableauPileIndex)
        if (flipTableauCard) {
            this.score += 5;
            this.scoreText.setText('Score: ' + this.score);
            const tableauPile = this.#solitaire.tableauPiles[tableauPileIndex]
            const tableauCard = tableauPile[tableauPile.length - 1]
            const cardGameObject = this.#tableauContainers[tableauPileIndex].getAt<Phaser.GameObjects.Image>(
                tableauPile.length - 1,
            )
            cardGameObject.setFrame(this.#getCardFrame(tableauCard))
            this.input.setDraggable(cardGameObject)
        }
    }

    #updateFoundationPiles(): void {
        this.#solitaire.foundationPiles.forEach((pile: FoundationPile, pileIndex: number) => {
            if (pile.value === 0) {
                return
            }

            this.#foundationPileCards[pileIndex].setVisible(true).setFrame(this.#getCardFrame(pile))
        })
        if (this.#solitaire.wonGame) {
            this.timerRunning = false;
            this.timerEvent.remove(false);

            this.cameras.main.fadeOut(1000, 0, 0, 0, (camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
                if (progress !== 1) {
                    return
                }
                this.scene.start(SCENE_KEYS.WIN, { moves: numberOfMoves, time: formatTime(this.elapsedTime), score: this.score })
            })
        }
    }

    #showCardsInDrawPile(): void {
        const numberOfCardsToShow = Math.min(this.#solitaire.drawPile.length, 3)
        this.#drawPileCards.forEach((card, cardIndex) => {
            const showCard = cardIndex < numberOfCardsToShow
            card.setVisible(showCard)
        })
    }

    #getCardFrame(data: Card | FoundationPile): number {
        return SUIT_FRAMES[data.suit] + data.value - 1
    }
}