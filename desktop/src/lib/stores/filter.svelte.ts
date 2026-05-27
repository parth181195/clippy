class FilterStore {
  search = $state('');
  type: string | null = $state(null);
  favoritesOnly = $state(false);
  private order: (string | null)[] = [null, 'text', 'image', 'link', 'code', 'color', 'emoji', 'file'];
  cycleType() {
    const i = this.order.indexOf(this.type);
    this.type = this.order[(i + 1) % this.order.length];
  }
  cycleTypeReverse() {
    const i = this.order.indexOf(this.type);
    this.type = this.order[(i - 1 + this.order.length) % this.order.length];
  }
  reset() {
    this.search = '';
    this.type = null;
    this.favoritesOnly = false;
  }
}
export const filterStore = new FilterStore();
