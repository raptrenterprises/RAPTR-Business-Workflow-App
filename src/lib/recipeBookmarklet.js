// This function's source is embedded as-is into a `javascript:` bookmarklet
// href (see getBookmarkletHref below), so it must be fully self-contained —
// no imports, no references to anything outside its own body. It runs in
// the browser tab that's actually showing the recipe page (with the
// visitor's own cookies/session/JS already rendered), which is why it
// succeeds on sites that block our server's automated fetch.
function raptrRecipeClipper() {
  function findRecipeNode(node) {
    if (!node) return null;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        var f = findRecipeNode(node[i]);
        if (f) return f;
      }
      return null;
    }
    if (typeof node !== "object") return null;
    var t = node["@type"];
    var isRecipe = t === "Recipe" || (Array.isArray(t) && t.indexOf("Recipe") !== -1);
    if (isRecipe) return node;
    if (node["@graph"]) return findRecipeNode(node["@graph"]);
    return null;
  }

  var scripts = document.querySelectorAll('script[type="application/ld+json"]');
  var recipe = null;
  for (var i = 0; i < scripts.length; i++) {
    try {
      var data = JSON.parse(scripts[i].textContent);
      var found = findRecipeNode(data);
      if (found) { recipe = found; break; }
    } catch (e) { /* some sites ship slightly-broken JSON-LD; skip it */ }
  }

  if (!recipe) {
    window.alert('No recipe data found on this page.\n\nTry the "Paste ingredients" option in RAPTR Ops instead \u2014 just copy the ingredient list from the page.');
    return;
  }

  var title = typeof recipe.name === "string" ? recipe.name : document.title;
  var ing = recipe.recipeIngredient || recipe.ingredients || [];
  if (!Array.isArray(ing)) ing = [ing];
  ing = ing.filter(function (x) { return typeof x === "string" && x.trim(); });

  if (ing.length === 0) {
    window.alert('Found a recipe but no ingredients on this page.\n\nTry the "Paste ingredients" option in RAPTR Ops instead.');
    return;
  }

  var text = "RECIPE: " + title + "\n" + ing.join("\n");

  function copyToClipboard(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt);
    var ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  copyToClipboard(text).then(function () {
    window.alert(
      "Copied " + ing.length + ' ingredients from "' + title + '"!\n\n' +
      "Go to RAPTR Ops \u2192 RAPTRMeet \u2192 Food & Grocery \u2192 Add recipe \u2192 Paste ingredients, and paste."
    );
  }).catch(function () {
    window.prompt("Couldn't copy automatically \u2014 copy this text manually:", text);
  });
}

export function getBookmarkletHref() {
  return "javascript:(" + raptrRecipeClipper.toString() + ")();";
}
