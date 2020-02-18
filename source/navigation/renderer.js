module.exports = function renderer() {
  if (!this.getRouter()) return ['']

  const activeView = this.getRouter().getActiveView()
  if (!activeView) return ['']

  const c = activeView.component

  return typeof c == 'function' ? c() : c
}
