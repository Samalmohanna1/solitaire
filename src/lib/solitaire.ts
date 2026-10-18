import { Card } from './card';
import { CARD_SUIT, CardSuit, CardValue } from './common';
import { Deck } from './deck';
import { FoundationPile } from './foundationPile';
import { exhaustiveGuard } from './utils';

// points awarded for each kind of move, and what undoing a move and every 10 seconds of play cost
export const SCORE = {
    DISCARD_TO_FOUNDATION: 10,
    TABLEAU_TO_FOUNDATION: 10,
    DISCARD_TO_TABLEAU: 5,
    REVEAL_TABLEAU_CARD: 5,
    UNDO: -15,
    TIME_PENALTY: -2,
} as const;

type CardState = {
    suit: CardSuit;
    value: CardValue;
    isFaceUp: boolean;
};

// a saved copy of the game, taken before each move so the move can be undone
type SolitaireState = {
    drawPile: CardState[];
    discardPile: CardState[];
    tableauPiles: CardState[][];
    foundationValues: (CardValue | 0)[];
    // the points the move earned, so undoing it can take them back
    points: number;
};

function toCardState(card: Card): CardState {
    return { suit: card.suit, value: card.value, isFaceUp: card.isFaceUp };
}

function toCard(cardState: CardState): Card {
    return new Card(cardState.suit, cardState.value, cardState.isFaceUp);
}

export class Solitaire {
    #deck: Deck;
    #foundationPileSpade: FoundationPile;
    #foundationPileClub: FoundationPile;
    #foundationPileHeart: FoundationPile;
    #foundationPileDiamond: FoundationPile;
    #tableauPiles: Card[][];
    #score: number;
    #numberOfMoves: number;
    #history: SolitaireState[];

    constructor() {
        this.#deck = new Deck();
        this.#foundationPileClub = new FoundationPile(CARD_SUIT.CLUB);
        this.#foundationPileSpade = new FoundationPile(CARD_SUIT.SPADE);
        this.#foundationPileHeart = new FoundationPile(CARD_SUIT.HEART);
        this.#foundationPileDiamond = new FoundationPile(CARD_SUIT.DIAMOND);
        this.#tableauPiles = [[], [], [], [], [], [], []];
        this.#score = 0;
        this.#numberOfMoves = 0;
        this.#history = [];
    }

    get drawPile(): Card[] {
        return this.#deck.drawPile;
    }

    get discardPile(): Card[] {
        return this.#deck.discardPile;
    }

    get tableauPiles(): Card[][] {
        return this.#tableauPiles;
    }

    get foundationPiles(): FoundationPile[] {
        return [
            this.#foundationPileSpade,
            this.#foundationPileClub,
            this.#foundationPileHeart,
            this.#foundationPileDiamond,
        ];
    }

    get score(): number {
        return this.#score;
    }

    get numberOfMoves(): number {
        return this.#numberOfMoves;
    }

    get canUndo(): boolean {
        return this.#history.length > 0;
    }

    get wonGame(): boolean {
        return (
            this.#foundationPileClub.value === 13 &&
            this.#foundationPileDiamond.value === 13 &&
            this.#foundationPileHeart.value === 13 &&
            this.#foundationPileSpade.value === 13
        );
    }

    /**
     * Resets the solitaire game state and setups up the game state for a new game by building the tableau piles that are needed.
     */
    public newGame(): void {
        /**
         * Rules for game setup:
         *
         * To form the tableau, seven piles need to be created. Starting from left to right, place the first card face up to make the first pile,
         * deal one card face down for the next six piles. Starting again from left to right, place one card face up on the second pile and deal
         * one card face down on piles three through seven. Starting again from left to right, place one card face up on the third pile and deal
         * one card face down on piles four through seven. Continue this pattern until pile seven has one card facing up on top of a pile of six
         * cards facing down.
         *
         * The remaining cards form the stock (or “hand”) pile and are placed above the tableau.
         *
         * When starting out, the foundations and waste pile do not have any cards.
         */
        this.#deck.reset();
        this.#tableauPiles = [[], [], [], [], [], [], []];
        this.#foundationPileClub.reset();
        this.#foundationPileDiamond.reset();
        this.#foundationPileHeart.reset();
        this.#foundationPileSpade.reset();
        this.#score = 0;
        this.#numberOfMoves = 0;
        this.#history = [];

        for (let i = 0; i < 7; i += 1) {
            for (let j = i; j < 7; j += 1) {
                const card = this.#deck.draw() as Card;
                if (j === i) {
                    card.flip();
                }
                this.#tableauPiles[j].push(card);
            }
        }
    }

    public drawCard(): boolean {
        if (this.#deck.drawPile.length === 0) {
            return false;
        }

        this.#startMove(0);
        const card = this.#deck.draw() as Card;
        card.flip();
        this.#deck.discardPile.push(card);
        return true;
    }

    public shuffleDiscardPile(): boolean {
        // the discard pile can only be turned back over once the draw pile is empty
        if (this.#deck.drawPile.length !== 0 || this.#deck.discardPile.length === 0) {
            return false;
        }

        this.#startMove(0);
        this.#deck.shuffleInDiscardPile();
        return true;
    }

    public playDiscardPileCardToFoundation(): boolean {
        // get the top card of the discard pile (last element in array)
        const card = this.#deck.discardPile[this.#deck.discardPile.length - 1];
        if (card === undefined) {
            return false;
        }

        // based on the suit, check the correct foundation pile for the current value to make sure this is the next card
        if (!this.#isValidMoveToAddCardToFoundation(card)) {
            return false;
        }

        // play card to the foundation pile and remove from the discard pile
        this.#startMove(SCORE.DISCARD_TO_FOUNDATION);
        this.#addCardToFoundation(card);
        this.#deck.discardPile.pop();

        return true;
    }

    public playDiscardPileCardToTableau(targetTableauIndex: number): boolean {
        // get the top card of the discard pile (last element in array)
        const card = this.#deck.discardPile[this.#deck.discardPile.length - 1];
        if (card === undefined) {
            return false;
        }

        const targetTableauPile = this.#tableauPiles[targetTableauIndex];
        if (targetTableauPile === undefined) {
            return false;
        }

        // based on the card suit color and card number, check that this card is allowed as the next card in the target tableau
        if (!this.#isValidMoveToAddCardToTableau(card, targetTableauPile)) {
            return false;
        }

        // play card to the tableau pile and remove from the discard pile
        this.#startMove(SCORE.DISCARD_TO_TABLEAU);
        this.#tableauPiles[targetTableauIndex].push(card);
        this.#deck.discardPile.pop();

        return true;
    }

    public moveTableauCardsToAnotherTableau(
        initialTableauIndex: number,
        cardIndex: number,
        targetTableauIndex: number,
    ): boolean {
        const initialTableauPile = this.#tableauPiles[initialTableauIndex];
        const targetTableauPile = this.#tableauPiles[targetTableauIndex];
        if (initialTableauPile === undefined || targetTableauPile === undefined) {
            return false;
        }

        // get the starting card from the first tableau pile
        const card = initialTableauPile[cardIndex];
        if (card === undefined) {
            return false;
        }

        // validate that the card is visible to the player
        if (!card.isFaceUp) {
            return false;
        }

        // based on the suit color and card number, check that this card is allowed as the next card in the target tableau
        if (!this.#isValidMoveToAddCardToTableau(card, targetTableauPile)) {
            return false;
        }

        // move the cards to the target tableau pile and remove from the initial tableau pile
        this.#startMove(0);
        const cardsToMove = initialTableauPile.splice(cardIndex);
        cardsToMove.forEach((card) => targetTableauPile.push(card));
        this.#revealTopTableauCard(initialTableauIndex);

        return true;
    }

    public moveTableauCardToFoundation(tableauIndex: number, cardIndex: number): boolean {
        const tableauPile = this.#tableauPiles[tableauIndex];
        if (tableauPile === undefined) {
            return false;
        }

        // only the last card in the tableau pile can be played to a foundation, not a card with other cards stacked on it
        if (cardIndex !== tableauPile.length - 1) {
            return false;
        }
        const card = tableauPile[cardIndex];
        if (card === undefined) {
            return false;
        }

        // based on the card suit, check the correct foundation pile for the current value to make sure this is the next card
        if (!this.#isValidMoveToAddCardToFoundation(card)) {
            return false;
        }

        // play card to the foundation pile and remove from the tableau pile
        this.#startMove(SCORE.TABLEAU_TO_FOUNDATION);
        this.#addCardToFoundation(card);
        tableauPile.pop();
        this.#revealTopTableauCard(tableauIndex);

        return true;
    }

    /**
     * Puts the game back the way it was before the last move. Undoing takes back the points that move earned plus the
     * undo cost, and counts as a move. Time penalties taken since the move are not refunded.
     */
    public undo(): boolean {
        const previousState = this.#history.pop();
        if (previousState === undefined) {
            return false;
        }

        this.#deck.restore(previousState.drawPile.map(toCard), previousState.discardPile.map(toCard));
        this.#tableauPiles = previousState.tableauPiles.map((pile) => pile.map(toCard));
        this.foundationPiles.forEach((pile, pileIndex) => pile.restore(previousState.foundationValues[pileIndex]));
        this.#score = Math.max(0, this.#score - previousState.points + SCORE.UNDO);
        this.#numberOfMoves += 1;

        return true;
    }

    /**
     * Takes points off for time played. Called every 10 seconds while the game is running.
     */
    public applyTimePenalty(): void {
        this.#score = Math.max(0, this.#score + SCORE.TIME_PENALTY);
    }

    /**
     * Saves the game so the move about to be made can be undone, then counts the move and awards its points. Called once a
     * move is known to be valid, before any cards are moved.
     */
    #startMove(points: number): void {
        this.#history.push({
            drawPile: this.#deck.drawPile.map(toCardState),
            discardPile: this.#deck.discardPile.map(toCardState),
            tableauPiles: this.#tableauPiles.map((pile) => pile.map(toCardState)),
            foundationValues: this.foundationPiles.map((pile) => pile.value),
            points: 0,
        });
        this.#numberOfMoves += 1;
        this.#awardPoints(points);
    }

    // adds points for the move being made, and records them with the move so an undo can take them back
    #awardPoints(points: number): void {
        this.#score += points;
        this.#history[this.#history.length - 1].points += points;
    }

    // turns over the last card in a tableau pile once the cards on top of it have been moved away
    #revealTopTableauCard(tableauIndex: number): void {
        const tableauPile = this.#tableauPiles[tableauIndex];
        const card = tableauPile[tableauPile.length - 1];
        if (card === undefined || card.isFaceUp) {
            return;
        }

        card.flip();
        this.#awardPoints(SCORE.REVEAL_TABLEAU_CARD);
    }

    #addCardToFoundation(card: Card): void {
        let foundationPile: FoundationPile;
        switch (card.suit) {
            case CARD_SUIT.CLUB:
                foundationPile = this.#foundationPileClub;
                break;
            case CARD_SUIT.SPADE:
                foundationPile = this.#foundationPileSpade;
                break;
            case CARD_SUIT.HEART:
                foundationPile = this.#foundationPileHeart;
                break;
            case CARD_SUIT.DIAMOND:
                foundationPile = this.#foundationPileDiamond;
                break;
            default:
                exhaustiveGuard(card.suit);
        }
        foundationPile.addCard();
    }

    #isValidMoveToAddCardToFoundation(card: Card): boolean {
        let foundationPile: FoundationPile;
        switch (card.suit) {
            case CARD_SUIT.CLUB:
                foundationPile = this.#foundationPileClub;
                break;
            case CARD_SUIT.SPADE:
                foundationPile = this.#foundationPileSpade;
                break;
            case CARD_SUIT.HEART:
                foundationPile = this.#foundationPileHeart;
                break;
            case CARD_SUIT.DIAMOND:
                foundationPile = this.#foundationPileDiamond;
                break;
            default:
                exhaustiveGuard(card.suit);
        }
        return card.value === foundationPile.value + 1;
    }

    #isValidMoveToAddCardToTableau(card: Card, tableauPile: Card[]): boolean {
        // if tableau is empty, only allow king (13) to be placed
        if (tableauPile.length === 0) {
            return card.value === 13;
        }

        // get reference to the last card in the tableau pile
        const lastTableauCard = tableauPile[tableauPile.length - 1];

        // if last card in tableau is an ace (1), no cards can be added
        if (lastTableauCard.value === 1) {
            return false;
        }

        // validate next card in a tableau is the opposite color and next card in sequence, example red 8 -> black 7
        if (lastTableauCard.color === card.color) {
            return false;
        }
        if (lastTableauCard.value !== card.value + 1) {
            return false;
        }

        return true;
    }
}