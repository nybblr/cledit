var editor = window.cledit(
  document.querySelector('.content'), window
)

var $content = $(editor.$contentElt);
$content.on('click', '.img .preview', (event) => {
  var selection = window.getSelection();
  var range = document.createRange();
  range.selectNodeContents(event.target.closest('.img'));
  selection.removeAllRanges();
  selection.addRange(range);
})

var imgSrc;
Prism.hooks.add('wrap', (env) => {
  switch (env.type) {
    case 'cl cl-src':
      imgSrc = env.content;
      break;
    case 'img':
      env.content += `<img class="preview" src="${imgSrc}">`
      imgSrc = undefined;
      break;
  }
});

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

// editor.on('contentChangedExt', (_, diffs) => {
//   console.log(diffs)
//   console.log(diffsToDiff(diffs));
// })

var signs = {
  "-1": '-',
  "0": ' ',
  "1": '+'
};

var diffsToDiff = (diffs) =>
  diffs.map(([type, text]) => {
    var sign = signs[type];
    return text.split('\n').map(line => sign + line).join('\n');
  }).join('\n');

var prev;
var run = event => {
  var sel = document.getSelection();
  var curr = sel.anchorNode &&
    sel.anchorNode.parentElement.closest('.link, .img');
  if (prev === curr) { return; }
  if (prev) { prev.classList.remove('active'); }
  if (curr) { curr.classList.add('active'); }
  prev = curr;
};

document.addEventListener('selectionchange', run);
editor.on('contentChanged', run)

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
