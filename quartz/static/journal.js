function updateThemeControl() {
  const dark = document.documentElement.getAttribute("saved-theme") === "dark"
  for (const button of document.querySelectorAll(".journal-tools .darkmode")) {
    const label = dark ? "Heller Modus" : "Dunkler Modus"
    button.setAttribute("aria-label", label)
    button.setAttribute("title", label)
    for (const icon of button.querySelectorAll("svg")) icon.setAttribute("aria-hidden", "true")
  }
}
document.addEventListener("themechange", updateThemeControl)
document.addEventListener("nav", updateThemeControl)
updateThemeControl()
