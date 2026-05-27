class SelectionStore {
  hash: string | null = $state(null);
  setByHash(h: string | null) {
    this.hash = h;
  }
}
export const selectionStore = new SelectionStore();
