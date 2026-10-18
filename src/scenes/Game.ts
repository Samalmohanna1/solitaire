import * as Phaser from 'phaser'
import { ASSET_KEYS, CARD_HEIGHT, CARD_WIDTH, SCENE_KEYS, createFullscreenButton } from './Commons'
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
const TABLEAU_PILE_FACE_DOWN_SPACER_Y = 15
// tallest a tableau pile can get before it runs into the bottom banner
const TABLEAU_PILE_MAX_HEIGHT = 660
const SUIT_FRAMES = {
    HEART: 26,
    DIAMOND: 13,
    SPADE: 39,
    CLUB: 0,
}
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
    scoreText!: Phaser.GameObjects.Text
    undoButton!: Phaser.GameObjects.Text
    timerEvent!: Phaser.Time.TimerEvent;
    timerText!: Phaser.GameObjects.Text;
    timerRunning: boolean = false;
    elapsedTime: number = 0;
    newGame!: Phaser.GameObjects.Text

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
        this.#renderBoard()

        this.#createDragEvents()
        this.#createDropZones()

        this.elapsedTime = 0;
        this.timerRunning = true;
        this.newGame = this.add.text(1520, TABLEAU_PILE_SPACER_Y + 980, 'New Game', textStyle).setInteractive({ useHandCursor: true })

        this.newGame.on('pointerdown', () => {
            this.cameras.main.fadeOut(1000, 0, 0, 0, (camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
                if (progress !== 1) {
                    return
                }
                this.scene.start(SCENE_KEYS.GAME);
            })

        });

        const fullscreenButton = createFullscreenButton(this, this.newGame.x - 60, this.newGame.y, textStyle)?.setOrigin(1, 0)

        const undoButtonX = (fullscreenButton ? fullscreenButton.x - fullscreenButton.width : this.newGame.x) - 60
        this.undoButton = this.add.text(undoButtonX, this.newGame.y, 'Undo', textStyle).setOrigin(1, 0).setInteractive({ useHandCursor: true })
        this.undoButton.on('pointerdown', () => this.#undo())
        this.input.keyboard?.on('keydown-Z', (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey) {
                this.#undo()
            }
        })

        this.timerText = this.add.text(this.scale.width / 2, TABLEAU_PILE_SPACER_Y + 996, '00:00', { font: '54px Raleway', fontStyle: 'bold', color: '#FFFEFF' }).setOrigin(.5)

        this.timerEvent = this.time.addEvent({
            delay: 1000,
            callback: () => {
                if (this.timerRunning) {
                    this.elapsedTime += 1;
                    this.timerText.setText('' + formatTime(this.elapsedTime));
                    if (this.elapsedTime % 10 === 0) {
                        this.#solitaire.applyTimePenalty()
                        this.#updateHud()
                    }
                }
            },
            loop: true,
        });


        this.add.image(0, 0, ASSET_KEYS.TABLE).setOrigin(0).setDepth(-1)
        this.add.image(this.scale.width / 2, this.scale.height, ASSET_KEYS.BANNER).setOrigin(.5, 1).setDepth(-1)

        this.moveCounterText = this.add.text(DRAW_PILE_X_POSITION + 80, TABLEAU_PILE_SPACER_Y + 980, '', textStyle)
        this.scoreText = this.add.text(this.moveCounterText.x + 250, this.moveCounterText.y, '', textStyle)
        this.#updateHud()
    }

    #updateHud(): void {
        this.moveCounterText.setText('Moves: ' + this.#solitaire.numberOfMoves)
        this.scoreText.setText('Score: ' + this.#solitaire.score)
        this.undoButton.setAlpha(this.#solitaire.canUndo ? 1 : 0.4)
    }

    #undo(): void {
        // the board is redrawn after an undo, which would pull cards out from under a drag in progress
        const isDragging = this.input.manager.pointers.some((pointer) => this.input.getDragState(pointer) !== 0)
        if (isDragging || this.#solitaire.wonGame || !this.#solitaire.undo()) {
            return
        }

        this.#playCardDrop()
        this.#renderBoard()
        this.#updateHud()
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
            // once the draw pile runs out, clicking it turns the discard pile back over
            const isValidMove =
                this.#solitaire.drawPile.length === 0 ? this.#solitaire.shuffleDiscardPile() : this.#solitaire.drawCard()
            if (isValidMove) {
                this.#handleMoveCompleted()
            }
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

        for (let pileIndex = 0; pileIndex < 7; pileIndex += 1) {
            const x = TABLEAU_PILE_X_POSITION + pileIndex * TABLEAU_PILE_SPACER_X
            this.#tableauContainers.push(this.add.container(x, TABLEAU_PILE_Y_POSITION, []))
        }
    }

    /**
     * Updates every card on the table to match the game state. Called after each move and each undo, so the table never
     * has to be patched up move by move.
     */
    #renderBoard(): void {
        const numberOfDrawPileCardsToShow = Math.min(this.#solitaire.drawPile.length, this.#drawPileCards.length)
        this.#drawPileCards.forEach((cardGameObject, cardIndex) =>
            cardGameObject.setVisible(cardIndex < numberOfDrawPileCardsToShow),
        )

        // the two discard pile game objects show the top two cards of the discard pile
        const discardPile = this.#solitaire.discardPile
        this.#discardPileCards.forEach((cardGameObject, cardIndex) => {
            const card = discardPile[discardPile.length - this.#discardPileCards.length + cardIndex]
            cardGameObject.setVisible(card !== undefined)
            if (card !== undefined) {
                cardGameObject.setFrame(this.#getCardFrame(card))
            }
        })

        this.#solitaire.foundationPiles.forEach((pile, pileIndex) => {
            this.#foundationPileCards[pileIndex].setVisible(pile.value !== 0)
            if (pile.value !== 0) {
                this.#foundationPileCards[pileIndex].setFrame(this.#getCardFrame(pile))
            }
        })

        this.#solitaire.tableauPiles.forEach((pile, pileIndex) => {
            // add or remove card game objects so the container has one for each card in the pile
            const tableauContainer = this.#tableauContainers[pileIndex]
            while (tableauContainer.length < pile.length) {
                tableauContainer.add(this.#createCard(0, 0, false))
            }
            while (tableauContainer.length > pile.length) {
                tableauContainer.removeAt(tableauContainer.length - 1, true)
            }

            pile.forEach((card, cardIndex) => {
                const cardGameObject = tableauContainer.getAt<Phaser.GameObjects.Image>(cardIndex)
                cardGameObject.setFrame(card.isFaceUp ? this.#getCardFrame(card) : CARD_BACK_FRAME)
                this.input.setDraggable(cardGameObject, card.isFaceUp)
            })

            // a dragged card that was moved away gets destroyed without a drag end event, so reset the drag depth here
            tableauContainer.setDepth(0)
            this.#layoutTableauPile(pileIndex)
        })
    }

    /**
     * Positions every card in a tableau pile. Face down cards are stacked tighter than face up cards, and face up cards
     * are squeezed together when a long pile would otherwise run into the bottom banner.
     */
    #layoutTableauPile(pileIndex: number): void {
        const pile = this.#solitaire.tableauPiles[pileIndex]
        const numberOfFaceDownCards = pile.filter((card) => !card.isFaceUp).length
        const numberOfFaceUpGaps = pile.length - numberOfFaceDownCards - 1

        let faceUpSpacerY = TABLEAU_PILE_SPACER_Y
        if (numberOfFaceUpGaps > 0) {
            const spaceForFaceUpGaps =
                TABLEAU_PILE_MAX_HEIGHT - CARD_HEIGHT * SCALE - numberOfFaceDownCards * TABLEAU_PILE_FACE_DOWN_SPACER_Y
            faceUpSpacerY = Math.min(TABLEAU_PILE_SPACER_Y, Math.floor(spaceForFaceUpGaps / numberOfFaceUpGaps))
        }

        let y = 0
        pile.forEach((card, cardIndex) => {
            this.#tableauContainers[pileIndex]
                .getAt<Phaser.GameObjects.Image>(cardIndex)
                .setPosition(0, y)
                .setData({ x: 0, y, cardIndex, pileIndex })
            y += card.isFaceUp ? faceUpSpacerY : TABLEAU_PILE_FACE_DOWN_SPACER_Y
        })
    }

    #drawCardLocationBox(x: number, y: number): void {
        this.add.rectangle(x, y, CARD_WIDTH * SCALE, CARD_HEIGHT * SCALE).setOrigin(0).setStrokeStyle(2, 0x0E0D0D, 0.5)
    }

    #createCard(x: number, y: number, draggable: boolean): Phaser.GameObjects.Image {
        return this.add
            .image(x, y, ASSET_KEYS.CARDS, CARD_BACK_FRAME)
            .setOrigin(0)
            .setScale(SCALE)
            .setInteractive({ draggable: draggable })
            .setData({ x, y })
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
                        const cardToMove = this.#tableauContainers[tableauPileIndex].getAt<Phaser.GameObjects.Image>(
                            cardIndex + i,
                        )
                        const offsetY = (cardToMove.getData('y') as number) - (gameObject.getData('y') as number)
                        cardToMove.setPosition(dragX, dragY + offsetY)
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
                .zone(TABLEAU_PILE_X_POSITION + i * TABLEAU_PILE_SPACER_X, TABLEAU_PILE_Y_POSITION, CARD_WIDTH * SCALE, TABLEAU_PILE_MAX_HEIGHT)
                .setOrigin(0)
                .setRectangleDropZone(CARD_WIDTH * SCALE, TABLEAU_PILE_MAX_HEIGHT)
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
                // cards dragged from the discard pile don't have a tableau pile index
                const tableauPileIndex = gameObject.getData('pileIndex') as number | undefined
                const cardIndex = gameObject.getData('cardIndex') as number

                let isValidMove: boolean
                if ((dropZone.getData('zoneType') as ZoneType) === ZONE_TYPE.FOUNDATION) {
                    isValidMove =
                        tableauPileIndex === undefined
                            ? this.#solitaire.playDiscardPileCardToFoundation()
                            : this.#solitaire.moveTableauCardToFoundation(tableauPileIndex, cardIndex)
                } else {
                    const targetTableauPileIndex = dropZone.getData('tableauIndex') as number
                    isValidMove =
                        tableauPileIndex === undefined
                            ? this.#solitaire.playDiscardPileCardToTableau(targetTableauPileIndex)
                            : this.#solitaire.moveTableauCardsToAnotherTableau(tableauPileIndex, cardIndex, targetTableauPileIndex)
                }

                if (isValidMove) {
                    this.#handleMoveCompleted()
                }
            },
        )
    }

    #playCardDrop(): void {
        const cardDropSound = this.sound.get('cardDrop');
        if (!cardDropSound || !cardDropSound.isPlaying) {
            this.sound.play('cardDrop', {
                volume: .7,
            });
        }
    }

    #handleMoveCompleted(): void {
        this.#playCardDrop()
        this.#renderBoard()
        this.#updateHud()

        if (!this.#solitaire.wonGame) {
            return
        }

        this.timerRunning = false;
        this.timerEvent.remove(false);

        this.cameras.main.fadeOut(1000, 0, 0, 0, (camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
            if (progress !== 1) {
                return
            }
            this.scene.start(SCENE_KEYS.WIN, { moves: this.#solitaire.numberOfMoves, time: formatTime(this.elapsedTime), score: this.#solitaire.score })
        })
    }

    #getCardFrame(data: Card | FoundationPile): number {
        return SUIT_FRAMES[data.suit] + data.value - 1
    }
}