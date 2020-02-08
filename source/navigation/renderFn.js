module.exports = function viewerRenderFn() {
  if (!this.getViewer()) return ['']

  const activeView = this.getViewer().getActiveView()
  if (!activeView) return ['']

  const c = activeView.component

  return typeof c == 'function' ? c() : c
}
