var editor = window.cledit(
  document.querySelector('.content'),
  // Optional (pass a second arg if scrollbar is not on the first arg)
  document.querySelector('.scroller')
)
var prismGrammar = window.mdGrammar({
  fences: true,
  tables: true,
  footnotes: true,
  abbrs: true,
  deflists: true,
  tocs: true,
  dels: true,
  subs: true,
  sups: true
})
editor.init({
  highlighter: function (text) {
    return window.Prism.highlight(text, prismGrammar)
  },
  // Optional (increases performance on large documents)
  sectionParser: function (text) {
    var offset = 0
    var sectionList = []
    ;(text + '\n\n').replace(/^.+[ \t]*\n=+[ \t]*\n+|^.+[ \t]*\n-+[ \t]*\n+|^\#{1,6}[ \t]*.+?[ \t]*\#*\n+/gm, function (match, matchOffset) {
      sectionList.push(text.substring(offset, matchOffset))
      offset = matchOffset
    })
    sectionList.push(text.substring(offset))
    return sectionList
  }
})

var prev;
document.addEventListener('selectionchange', event => {
  var sel = document.getSelection();
  var curr = sel.anchorNode &&
    sel.anchorNode.parentElement.closest('.link');
  if (prev === curr) { return; }
  if (prev) { prev.classList.remove('active'); }
  if (curr) { curr.classList.add('active'); }
  prev = curr;
});

// var body = document.body;
// var div = document.createElement('div');
// div.classList.add('selection');
// body.appendChild(div);
// document.addEventListener('selectionchange', event => {
//   var sel = document.getSelection();
//
//   if (!sel.rangeCount || sel.type === 'None') {
//     div.classList.remove('caret', 'range');
//     div.classList.add('none');
//     return;
//   }
//
//   var range = sel.getRangeAt(0);
//   var rect = range.getBoundingClientRect();
//
//   var { top, left, width, height } = rect;
//   top += window.scrollY;
//   left += window.scrollX;
//
//   switch (sel.type) {
//     case 'Range':
//       div.style = `top: ${top}px; left: ${left}px; width: ${width}px; height: ${height}px;`
//       div.classList.remove('caret', 'none');
//       div.classList.add('range');
//       break;
//     case 'Caret':
//       div.style = `top: ${top}px; left: ${left - 1}px; height: ${height}px;`
//       div.classList.remove('range', 'none');
//       div.classList.add('caret');
//       break;
//   }
// });
