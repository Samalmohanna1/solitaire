import * as Phaser from 'phaser'
import { ASSET_KEYS, CARD_HEIGHT, CARD_WIDTH, SCENE_KEYS, createFullscreenButton, formatTime } from './Commons'
import { Solitaire } from '../lib/solitaire'
import { GameStats } from '../lib/stats'
import type { WinData } from './Win'
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
const labelStyle = { ...textStyle, color: '#0d0d0d', backgroundColor: '#FFFFEF', padding: { x: 30, y: 20 } }
const CARD_FLY_DURATION = 250
const CARD_FLIP_DURATION = 200
const SLIDE_BACK_DURATION = 150
const AUTO_COMPLETE_DELAY = 120
// the win cascade moves its cards 60 times a second, launching a card every few steps
const CASCADE_STEP_TIME = 1000 / 60
const CASCADE_LAUNCH_INTERVAL = 4
const CASCADE_GRAVITY = 0.7
const CASCADE_BOUNCE = 0.75
// on a slow device the cascade plays in slow motion, rather than falling further and further behind
const CASCADE_MAX_STEPS_PER_FRAME = 4
// two clicks on the same card within this many milliseconds, without dragging it, play it to its foundation
const DOUBLE_CLICK_TIME = 350
const CLICK_MAX_DISTANCE = 20


type ZoneType = keyof typeof ZONE_TYPE
const ZONE_TYPE = {
    FOUNDATION: 'FOUNDATION',
    TABLEAU: 'TABLEAU',
} as const

export class Game extends Phaser.Scene {
    #solitaire!: Solitaire
    #stats!: GameStats
    // whether this game has been counted in the stats yet, which happens on its first move
    #isGameRecorded!: boolean
    #drawPileCards!: Phaser.GameObjects.Image[]
    #discardPileCards!: Phaser.GameObjects.Image[]
    #foundationPileCards!: Phaser.GameObjects.Image[]
    #tableauContainers!: Phaser.GameObjects.Container[]
    // how many cards are still flying to each foundation pile, so the pile doesn't show them before they land
    #cardsFlyingToFoundation!: number[]
    #isAutoCompleting!: boolean
    moveCounterText: Phaser.GameObjects.Text
    scoreText!: Phaser.GameObjects.Text
    undoButton!: Phaser.GameObjects.Text
    autoCompleteButton!: Phaser.GameObjects.Text
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
        this.#stats = new GameStats()
        this.#isGameRecorded = false
        this.#cardsFlyingToFoundation = [0, 0, 0, 0]
        this.#isAutoCompleting = false

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

        // the draw and discard piles are always empty when auto-complete is possible, so the button sits over them
        this.autoCompleteButton = this.add
            .text(
                (DRAW_PILE_X_POSITION + DISCARD_PILE_X_POSITION + CARD_WIDTH * SCALE) / 2,
                DRAW_PILE_Y_POSITION + (CARD_HEIGHT * SCALE) / 2,
                'Auto-complete',
                labelStyle,
            )
            .setOrigin(0.5)
            .setDepth(10)
            .setInteractive({ useHandCursor: true })
        this.autoCompleteButton.on('pointerdown', () => this.#startAutoComplete())

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
        this.autoCompleteButton.setVisible(this.#solitaire.canAutoComplete && !this.#isAutoCompleting)
    }

    #undo(): void {
        // the board is redrawn after an undo, which would pull cards out from under a drag in progress
        const isDragging = this.input.manager.pointers.some((pointer) => this.input.getDragState(pointer) !== 0)
        if (isDragging || this.#isAutoCompleting || this.#solitaire.wonGame || !this.#solitaire.canUndo) {
            return
        }

        // land any cards still flying to a foundation first, so the foundation piles end up showing the right cards
        this.tweens.getTweens().forEach((tween) => tween.complete())
        this.#solitaire.undo()
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

        this.#renderFoundationPiles()

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
                // a card that was face down the last time the board was drawn has just been revealed
                const isRevealed = cardGameObject.getData('isFaceUp') === false && card.isFaceUp
                cardGameObject.setData('isFaceUp', card.isFaceUp)
                this.input.setDraggable(cardGameObject, card.isFaceUp)

                if (isRevealed) {
                    this.#flipCard(cardGameObject, this.#getCardFrame(card))
                } else if (!cardGameObject.getData('isFlipping')) {
                    cardGameObject.setFrame(card.isFaceUp ? this.#getCardFrame(card) : CARD_BACK_FRAME)
                }
            })

            // a dragged card that was moved away gets destroyed without a drag end event, so reset the drag depth here
            tableauContainer.setDepth(0)
            this.#layoutTableauPile(pileIndex)
        })
    }

    // turns a card face up by squashing it flat and stretching it back out with its face showing
    #flipCard(cardGameObject: Phaser.GameObjects.Image, faceFrame: number): void {
        cardGameObject.setData('isFlipping', true)
        this.tweens.add({
            targets: cardGameObject,
            scaleX: 0,
            // move right while narrowing, so the card turns around its middle
            x: (CARD_WIDTH * SCALE) / 2,
            duration: CARD_FLIP_DURATION / 2,
            ease: 'Sine.easeIn',
            yoyo: true,
            onYoyo: () => {
                if (cardGameObject.active) {
                    cardGameObject.setFrame(faceFrame)
                }
            },
            onComplete: () => {
                if (cardGameObject.active) {
                    cardGameObject
                        .setFrame(faceFrame)
                        .setScale(SCALE)
                        .setX(cardGameObject.getData('x') as number)
                        .setData('isFlipping', false)
                }
            },
        })
    }

    #renderFoundationPiles(): void {
        this.#solitaire.foundationPiles.forEach((pile, pileIndex) => {
            const value = pile.value - this.#cardsFlyingToFoundation[pileIndex]
            this.#foundationPileCards[pileIndex].setVisible(value > 0)
            if (value > 0) {
                this.#foundationPileCards[pileIndex].setFrame(SUIT_FRAMES[pile.suit] + value - 1)
            }
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
        this.#createDoubleClickEventListener()
        this.#createDropEventListener()
    }

    #createDragStartEventListener(): void {
        this.input.on(
            Phaser.Input.Events.DRAG_START,
            (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
                const tableauPileIndex = gameObject.getData('pileIndex') as number | undefined
                const tableauContainer = tableauPileIndex === undefined ? undefined : this.#tableauContainers[tableauPileIndex]

                // finish any slide or flip still running in the pile, so it doesn't fight the drag
                this.tweens.getTweensOf(tableauContainer?.list ?? [gameObject]).forEach((tween) => tween.complete())
                const raisedObject = tableauContainer ?? gameObject
                raisedObject.setDepth(2)
                gameObject.setAlpha(0.8)
            },
        )
    }

    #createOnDragEventListener(): void {
        this.input.on(
            Phaser.Input.Events.DRAG,
            (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image, dragX: number, dragY: number) => {
                gameObject.setDepth(50)
                // the cards on top of a dragged tableau card move with it, keeping their spacing
                this.#getCardsMovingWith(gameObject).forEach((card) => {
                    const offsetY = (card.getData('y') as number) - (gameObject.getData('y') as number)
                    card.setPosition(dragX, dragY + offsetY)
                })
            },
        )
    }

    #createDragEndEventListener(): void {
        this.input.on(
            Phaser.Input.Events.DRAG_END,
            (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
                if (!gameObject.active) {
                    return
                }
                gameObject.setAlpha(1)

                // slide the cards back to where they came from, keeping them above the other piles until they arrive.
                // After a valid move the cards are already in place, so they don't move.
                const tableauPileIndex = gameObject.getData('pileIndex') as number | undefined
                const raisedObject = tableauPileIndex === undefined ? gameObject : this.#tableauContainers[tableauPileIndex]
                this.#getCardsMovingWith(gameObject).forEach((card, cardIndex) => {
                    const x = card.getData('x') as number
                    const y = card.getData('y') as number
                    this.tweens.add({
                        targets: card,
                        x,
                        y,
                        duration: SLIDE_BACK_DURATION,
                        ease: 'Quad.easeOut',
                        onComplete: () => {
                            card.setPosition(x, y)
                            if (cardIndex === 0) {
                                raisedObject.setDepth(0)
                            }
                        },
                    })
                })
            },
        )
    }

    #createDoubleClickEventListener(): void {
        let lastClickedCard: Phaser.GameObjects.Image | undefined
        let lastClickTime = 0

        // pressing a face up card always starts a drag, so a click is a drag that ends where it started
        this.input.on(
            Phaser.Input.Events.DRAG_END,
            (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image) => {
                if (pointer.getDistance() > CLICK_MAX_DISTANCE) {
                    lastClickedCard = undefined
                    return
                }

                const isDoubleClick = gameObject === lastClickedCard && pointer.upTime - lastClickTime < DOUBLE_CLICK_TIME
                lastClickedCard = isDoubleClick ? undefined : gameObject
                lastClickTime = pointer.upTime
                if (isDoubleClick) {
                    this.#sendCardToFoundation(gameObject)
                }
            },
        )
    }

    // the dragged card, plus the cards on top of it when it's in a tableau pile
    #getCardsMovingWith(gameObject: Phaser.GameObjects.Image): Phaser.GameObjects.Image[] {
        const tableauPileIndex = gameObject.getData('pileIndex') as number | undefined
        if (tableauPileIndex === undefined) {
            return [gameObject]
        }

        const cardIndex = gameObject.getData('cardIndex') as number
        return this.#tableauContainers[tableauPileIndex].list.slice(cardIndex) as Phaser.GameObjects.Image[]
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
                    // the discard pile game object stays put to show the next card, so it goes back without sliding
                    gameObject.setPosition(gameObject.getData('x') as number, gameObject.getData('y') as number)
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

        if (!this.#isGameRecorded) {
            this.#stats.recordGameStarted()
            this.#isGameRecorded = true
        }

        if (!this.#solitaire.wonGame) {
            return
        }

        this.timerRunning = false;
        this.timerEvent.remove(false);

        const winData: WinData = {
            moves: this.#solitaire.numberOfMoves,
            score: this.#solitaire.score,
            time: this.elapsedTime,
            stats: this.#stats,
            ...this.#stats.recordWin(this.#solitaire.score, this.elapsedTime),
        }
        // let the last card land on its foundation before the cards start bouncing off
        this.time.delayedCall(CARD_FLY_DURATION + 100, () => this.#playWinCascade(() => this.#showWinScreen(winData)))
    }

    #showWinScreen(winData: WinData): void {
        this.cameras.main.fadeOut(1000, 0, 0, 0, (camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
            if (progress !== 1) {
                return
            }
            this.scene.start(SCENE_KEYS.WIN, winData)
        })
    }

    /**
     * The classic win celebration: the cards bounce off the foundations one at a time, leaving trails behind them.
     * Tapping anywhere skips straight to the win screen.
     */
    #playWinCascade(onDone: () => void): void {
        // the trails cover the whole board, so they also catch every tap before the buttons underneath can
        const trails = this.add
            .renderTexture(0, 0, this.scale.width, this.scale.height)
            .setOrigin(0)
            .setDepth(200)
            .setInteractive()
        this.add.text(this.scale.width / 2, this.scale.height - 70, 'Tap to continue', labelStyle).setOrigin(0.5).setDepth(201)

        // the cards leave from the top of the foundations, taking turns between the four piles
        const cardsToLaunch: { pileIndex: number; value: number }[] = []
        for (let value = 13; value > 0; value -= 1) {
            this.#solitaire.foundationPiles.forEach((pile, pileIndex) => {
                if (pile.value >= value) {
                    cardsToLaunch.push({ pileIndex, value })
                }
            })
        }

        const cardWidth = CARD_WIDTH * SCALE
        const cardHeight = CARD_HEIGHT * SCALE
        let bouncingCards: { frame: number; x: number; y: number; velocityX: number; velocityY: number }[] = []
        let step = 0
        let timeToCatchUp = 0
        let isDone = false

        // moves the cards on by one step, stamping a trail for each; only called between trails.beginDraw/endDraw
        const moveCards = () => {
            const launch = step % CASCADE_LAUNCH_INTERVAL === 0 ? cardsToLaunch.shift() : undefined
            step += 1
            if (launch !== undefined) {
                const suitFrame = SUIT_FRAMES[this.#solitaire.foundationPiles[launch.pileIndex].suit]
                bouncingCards.push({
                    frame: suitFrame + launch.value - 1,
                    x: FOUNDATION_PILE_X_POSITIONS[launch.pileIndex],
                    y: FOUNDATION_PILE_Y_POSITION,
                    velocityX: Phaser.Math.Between(7, 13) * (Math.random() < 0.5 ? -1 : 1),
                    velocityY: Phaser.Math.FloatBetween(-12, -2),
                })
                // the foundation now shows the card underneath
                this.#foundationPileCards[launch.pileIndex].setVisible(launch.value > 1).setFrame(suitFrame + launch.value - 2)
            }

            bouncingCards.forEach((card) => {
                card.velocityY += CASCADE_GRAVITY
                card.x += card.velocityX
                card.y += card.velocityY
                if (card.y + cardHeight > this.scale.height) {
                    card.y = this.scale.height - cardHeight
                    card.velocityY *= -CASCADE_BOUNCE
                }
                trails.stamp(ASSET_KEYS.CARDS, card.frame, card.x, card.y, { originX: 0, originY: 0, scale: SCALE, skipBatch: true })
            })
            // a card is done once it leaves the side of the screen
            bouncingCards = bouncingCards.filter((card) => card.x > -cardWidth && card.x < this.scale.width)
        }

        const update = (_time: number, delta: number) => {
            timeToCatchUp = Math.min(timeToCatchUp + delta, CASCADE_STEP_TIME * CASCADE_MAX_STEPS_PER_FRAME)
            // draw all of this frame's trails in one go, since drawing them one at a time is slow
            trails.beginDraw()
            while (timeToCatchUp >= CASCADE_STEP_TIME) {
                timeToCatchUp -= CASCADE_STEP_TIME
                moveCards()
            }
            trails.endDraw()

            if (cardsToLaunch.length === 0 && bouncingCards.length === 0) {
                finish()
            }
        }
        this.events.on(Phaser.Scenes.Events.UPDATE, update)

        const finish = () => {
            if (isDone) {
                return
            }
            isDone = true
            this.events.off(Phaser.Scenes.Events.UPDATE, update)
            onDone()
        }
        trails.once(Phaser.Input.Events.POINTER_DOWN, finish)
    }

    /**
     * Plays a discard pile or tableau card to its foundation, if that's a valid move, and animates it flying there. Used
     * by double clicks and auto-complete.
     */
    #sendCardToFoundation(cardGameObject: Phaser.GameObjects.Image): boolean {
        // cards in the discard pile don't have a tableau pile index
        const tableauPileIndex = cardGameObject.getData('pileIndex') as number | undefined
        const sourcePile =
            tableauPileIndex === undefined ? this.#solitaire.discardPile : this.#solitaire.tableauPiles[tableauPileIndex]
        const card = sourcePile[sourcePile.length - 1]
        const isValidMove =
            tableauPileIndex === undefined
                ? this.#solitaire.playDiscardPileCardToFoundation()
                : this.#solitaire.moveTableauCardToFoundation(tableauPileIndex, cardGameObject.getData('cardIndex') as number)
        if (!isValidMove) {
            return false
        }

        // read the card's position before the board is redrawn, since tableau cards are positioned inside their container
        const startX = cardGameObject.x + (cardGameObject.parentContainer?.x ?? 0)
        const startY = cardGameObject.y + (cardGameObject.parentContainer?.y ?? 0)
        const foundationIndex = this.#solitaire.foundationPiles.findIndex((pile) => pile.suit === card.suit)
        this.#cardsFlyingToFoundation[foundationIndex] += 1
        this.#handleMoveCompleted()

        const foundationCard = this.#foundationPileCards[foundationIndex]
        const flyingCard = this.add
            .image(startX, startY, ASSET_KEYS.CARDS, this.#getCardFrame(card))
            .setOrigin(0)
            .setScale(SCALE)
            .setDepth(100)
        this.tweens.add({
            targets: flyingCard,
            x: foundationCard.x,
            y: foundationCard.y,
            duration: CARD_FLY_DURATION,
            ease: 'Quad.easeOut',
            onComplete: () => {
                flyingCard.destroy()
                this.#cardsFlyingToFoundation[foundationIndex] -= 1
                this.#renderFoundationPiles()
            },
        })
        return true
    }

    #startAutoComplete(): void {
        if (this.#isAutoCompleting || !this.#solitaire.canAutoComplete) {
            return
        }

        this.#isAutoCompleting = true
        this.#updateHud()
        this.#autoCompleteNextCard()
    }

    // plays one card to a foundation, then waits a moment before playing the next, until the game is won
    #autoCompleteNextCard(): void {
        const pileIndex = this.#solitaire.findNextAutoCompletePile()
        const tableauContainer = pileIndex === undefined ? undefined : this.#tableauContainers[pileIndex]
        const lastCard = tableauContainer?.getAt<Phaser.GameObjects.Image>(tableauContainer.length - 1)
        if (lastCard === undefined || !this.#sendCardToFoundation(lastCard)) {
            this.#isAutoCompleting = false
            this.#updateHud()
            return
        }

        this.time.delayedCall(AUTO_COMPLETE_DELAY, () => this.#autoCompleteNextCard())
    }

    #getCardFrame(data: Card | FoundationPile): number {
        return SUIT_FRAMES[data.suit] + data.value - 1
    }
}