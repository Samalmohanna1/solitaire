export class Solitaire {
    public newGame(): void {

    }

    public drawCard(): boolean {
        return true
    }

    public shuffleDiscardPile(): boolean {
        return true
    }

    public playDiscardPileToFoundation(): boolean {
        return true
    }

    public playDiscardPileToTableau(targetTableauPileIndex: number): boolean {
        return true
    }

    public moveTableauCardToFoundation(tableauPileIndex: number): boolean {
        return true
    }

    public moveTableauCardToAnotherTableau(
        initialTableauIndex: number,
        cardIndex: number,
        targetTableauPileIndex: number
    ): boolean {
        return true
    }

    public flipTopTableauCard(tableauPileIndex: number): boolean {
        return true
    }
}