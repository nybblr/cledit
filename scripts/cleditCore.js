;(function (diff_match_patch) {
  function cledit (contentElt, scrollElt, windowParam) {
    scrollElt = scrollElt || contentElt
    var editor = {
      $contentElt: contentElt,
      $scrollElt: scrollElt,
      $window: windowParam || window,
      $keystrokes: [],
      $markers: {}
    }
    editor.$document = editor.$window.document
    cledit.Utils.createEventHooks(editor)
    var debounce = cledit.Utils.debounce

    function getScrollTop() {
      return scrollElt.scrollTop || scrollElt.scrollY;
    }

    function setScrollTop(y) {
      if (scrollElt === window) {
        scrollElt.scrollTo(0, y);
      } else {
        scrollElt.scrollTop = y;
      }
    }

    function getScrollHeight() {
      return scrollElt.clientHeight || scrollElt.innerHeight;
    }

    editor.getScrollTop = getScrollTop
    editor.setScrollTop = setScrollTop
    editor.getScrollHeight = getScrollHeight

    editor.toggleEditable = function (isEditable) {
      if (isEditable === undefined) {
        isEditable = !contentElt.contentEditable
      }
      contentElt.contentEditable = isEditable
    }
    editor.toggleEditable(true)

    function getTextContent () {
      var textContent = contentElt.textContent.replace(/\r\n?/g, '\n') // Mac/DOS to Unix
      if (textContent.slice(-1) !== '\n') {
        textContent += '\n'
      }
      return textContent
    }

    var lastTextContent = getTextContent()
    var highlighter = new cledit.Highlighter(editor)

    var sectionList

    function parseSections (content, isInit) {
      sectionList = highlighter.parseSections(content, isInit)
      editor.$allElements = Array.prototype.slice.call(contentElt.querySelectorAll('.cledit-section *'))
      return sectionList
    }

    // Used to detect editor changes
    var watcher = new cledit.Watcher(editor, checkContentChange)
    var watcherExt = new cledit.Watcher(editor, checkContentChangeExt)

    watcherExt.startWatching()
    watcher.startWatching()

    function noWatch (cb) {
      watcher.noWatch(() => {
        watcherExt.noWatch(cb);
      })
    }

    /* eslint-disable new-cap */
    var diffMatchPatch = new window.diff_match_patch()
    /* eslint-enable new-cap */
    var selectionMgr = new cledit.SelectionMgr(editor)

    function differ(a, b) {
      var suffixLength = diffMatchPatch.diff_commonSuffix(a, b)
      var prefixLength = diffMatchPatch.diff_commonPrefix(a, b)

      suffixLength = Math.min(
        suffixLength,
        a.length - prefixLength,
        b.length - prefixLength
      )

      var prefix = a.slice(0, prefixLength)
      var suffix = suffixLength ? a.slice(-suffixLength) : ''

      var aOnly  = a.slice(prefixLength, -suffixLength || undefined)
      var bOnly  = b.slice(prefixLength, -suffixLength || undefined)

      return [
        [0, prefix],
        [-1, aOnly],
        [1, bOnly],
        [0, suffix]
      ].filter(([op, text]) => !!text.length);
    }

    window.differ = differ;

    function adjustCursorPosition (force) {
      selectionMgr.saveSelectionState(true, true, force)
    }

    function replaceContent (selectionStart, selectionEnd, replacement) {
      var min = Math.min(selectionStart, selectionEnd)
      var max = Math.max(selectionStart, selectionEnd)
      var range = selectionMgr.createRange(min, max)
      var rangeText = '' + range
      // Range can contain a br element, which is not taken into account in rangeText
      if (rangeText.length === max - min && rangeText === replacement) {
        return
      }
      range.deleteContents()
      range.insertNode(editor.$document.createTextNode(replacement))
      return range
    }

    var ignoreUndo = false
    var noContentFix = false

    function setContent (value, noUndo, maxStartOffset) {
      var textContent = getTextContent()
      maxStartOffset = maxStartOffset !== undefined && maxStartOffset < textContent.length ? maxStartOffset : textContent.length - 1
      var startOffset = Math.min(
        diffMatchPatch.diff_commonPrefix(textContent, value),
        maxStartOffset
      )
      var endOffset = Math.min(
        diffMatchPatch.diff_commonSuffix(textContent, value),
        textContent.length - startOffset,
        value.length - startOffset
      )
      var replacement = value.substring(startOffset, value.length - endOffset)
      var range = replaceContent(startOffset, textContent.length - endOffset, replacement)
      if (range) {
        ignoreUndo = noUndo
        noContentFix = true
      }
      return {
        start: startOffset,
        end: value.length - endOffset,
        range: range
      }
    }

    function replace (selectionStart, selectionEnd, replacement, autoScroll) {
      if (autoScroll == null) { autoScroll = true; }
      undoMgr.setDefaultMode('single')
      replaceContent(selectionStart, selectionEnd, replacement)
      var endOffset = selectionStart + replacement.length
      selectionMgr.setSelectionStartEnd(endOffset, endOffset)
      selectionMgr.updateCursorCoordinates(autoScroll)
    }

    function replaceAll (search, replacement, autoScroll) {
      if (autoScroll == null) { autoScroll = true; }
      undoMgr.setDefaultMode('single')
      var textContent = getTextContent()
      var value = textContent.replace(search, replacement)
      if (value !== textContent) {
        var offset = editor.setContent(value)
        selectionMgr.setSelectionStartEnd(offset.end, offset.end)
        selectionMgr.updateCursorCoordinates(autoScroll)
      }
    }

    function focus () {
      selectionMgr.restoreSelection()
    }

    var undoMgr = new cledit.UndoMgr(editor)

    function addMarker (marker) {
      editor.$markers[marker.id] = marker
    }

    function removeMarker (marker) {
      delete editor.$markers[marker.id]
    }

    var triggerSpellCheck = debounce(function () {
      var selection = editor.$window.getSelection()
      if (!selectionMgr.hasFocus || highlighter.isComposing || selectionMgr.selectionStart !== selectionMgr.selectionEnd || !selection.modify) {
        return
      }
      // Hack for Chrome to trigger the spell checker
      if (selectionMgr.selectionStart) {
        selection.modify('move', 'backward', 'character')
        selection.modify('move', 'forward', 'character')
      } else {
        selection.modify('move', 'forward', 'character')
        selection.modify('move', 'backward', 'character')
      }
    }, 10)

    function fixupSections(mutations) {
      noWatch(function () {
        var removedSections = []
        var modifiedSections = []

        function markModifiedSection (node) {
          while (node && node !== contentElt) {
            if (node.section) {
              var array = node.parentNode ? modifiedSections : removedSections
              return array.indexOf(node.section) === -1 && array.push(node.section)
            }
            node = node.parentNode
          }
        }

        mutations.cl_each(function (mutation) {
          markModifiedSection(mutation.target)
          mutation.addedNodes.cl_each(markModifiedSection)
          mutation.removedNodes.cl_each(markModifiedSection)
        })
        highlighter.fixContent(modifiedSections, removedSections, noContentFix)
        noContentFix = false
      })
    }

    var runChangedExt = false;
    function resetChangedExt() {
      runChangedExt = false;
    }

    function checkContentChangeExt (mutations) {
      runChangedExt = true;
    }

    function changed(mutations) {
      var newTextContent = getTextContent()
      var diffs = differ(lastTextContent, newTextContent)
      editor.$markers.cl_each(function (marker) {
        marker.adjustOffset(diffs)
      })

      selectionMgr.saveSelectionState()
      var sectionList = parseSections(newTextContent)
      editor.$trigger('contentChanged', newTextContent, diffs, sectionList)
      if (runChangedExt) {
        editor.$trigger('contentChangedExt', newTextContent, diffs, sectionList)
      }
      if (!ignoreUndo) {
        undoMgr.addDiffs(lastTextContent, newTextContent, diffs)
        undoMgr.setDefaultMode('typing')
        undoMgr.saveState()
      }
      ignoreUndo = false
      lastTextContent = newTextContent
      triggerSpellCheck()
    }

    function checkContentChange (mutations) {
      noContentFix = true
      fixupSections(mutations);

      changed(mutations);

      resetChangedExt()
    }

    function setSelection (start, end) {
      end = end === undefined ? start : end
      selectionMgr.setSelectionStartEnd(start, end)
      selectionMgr.updateCursorCoordinates()
    }

    function keydownHandler (handler) {
      return function (evt) {
        if (
          evt.which !== 17 && // Ctrl
          evt.which !== 91 && // Cmd
          evt.which !== 18 && // Alt
          evt.which !== 16 // Shift
        ) {
          handler(evt)
        }
      }
    }

    function tryDestroy () {
      if (!editor.$window.document.contains(contentElt)) {
        watcher.stopWatching()
        watcherExt.stopWatching()
        editor.$window.removeEventListener('keydown', windowKeydownListener)
        editor.$window.removeEventListener('mouseup', windowMouseupListener)
        editor.$trigger('destroy')
        return true
      }
    }

    // In case of Ctrl/Cmd+A outside the editor element
    function windowKeydownListener (evt) {
      if (!tryDestroy()) {
        keydownHandler(function () {
          adjustCursorPosition()
        })(evt)
      }
    }
    editor.$window.addEventListener('keydown', windowKeydownListener, false)

    // Mouseup can happen outside the editor element
    function windowMouseupListener () {
      if (!tryDestroy()) {
        selectionMgr.saveSelectionState(true, false)
      }
    }
    editor.$window.addEventListener('mouseup', windowMouseupListener)
    // This can also provoke selection changes and does not fire mouseup event on Chrome/OSX
    contentElt.addEventListener('contextmenu', selectionMgr.saveSelectionState.cl_bind(selectionMgr, true, false))

    contentElt.addEventListener('keydown', keydownHandler(function (evt) {
      selectionMgr.saveSelectionState()
      adjustCursorPosition()

      // Perform keystroke
      var textContent = getTextContent()
      var min = Math.min(selectionMgr.selectionStart, selectionMgr.selectionEnd)
      var max = Math.max(selectionMgr.selectionStart, selectionMgr.selectionEnd)
      var state = {
        before: textContent.slice(0, min),
        after: textContent.slice(max),
        selection: textContent.slice(min, max),
        isBackwardSelection: selectionMgr.selectionStart > selectionMgr.selectionEnd
      }
      editor.$keystrokes.cl_some(function (keystroke) {
        if (keystroke.handler(evt, state, editor)) {
          editor.setContent(state.before + state.selection + state.after, false, min)
          min = state.before.length
          max = min + state.selection.length
          selectionMgr.setSelectionStartEnd(
            state.isBackwardSelection ? max : min,
            state.isBackwardSelection ? min : max
          )
          return true
        }
      })
    }), false)

    contentElt.addEventListener('compositionstart', function () {
      highlighter.isComposing++
    }, false)

    contentElt.addEventListener('compositionend', function () {
      setTimeout(function () {
        highlighter.isComposing && highlighter.isComposing--
      }, 0)
    }, false)

    contentElt.addEventListener('paste', function (evt) {
      undoMgr.setCurrentMode('single')
      evt.preventDefault()
      var data
      var clipboardData = evt.clipboardData
      if (clipboardData) {
        data = clipboardData.getData('text/plain')
      } else {
        clipboardData = editor.$window.clipboardData
        data = clipboardData && clipboardData.getData('Text')
      }
      if (!data) {
        return
      }
      replace(selectionMgr.selectionStart, selectionMgr.selectionEnd, data)
      adjustCursorPosition()
    }, false)

    contentElt.addEventListener('cut', function () {
      undoMgr.setCurrentMode('single')
      adjustCursorPosition()
    }, false)

    contentElt.addEventListener('focus', function () {
      selectionMgr.hasFocus = true
      editor.$trigger('focus')
    }, false)

    contentElt.addEventListener('blur', function () {
      selectionMgr.hasFocus = false
      editor.$trigger('blur')
    }, false)

    function addKeystroke (keystrokes) {
      if (!Array.isArray(keystrokes)) {
        keystrokes = [keystrokes]
      }
      editor.$keystrokes = editor.$keystrokes.concat(keystrokes).sort(function (keystroke1, keystroke2) {
        return keystroke1.priority - keystroke2.priority
      })
    }
    addKeystroke(cledit.defaultKeystrokes)

    editor.selectionMgr = selectionMgr
    editor.undoMgr = undoMgr
    editor.highlighter = highlighter
    editor.watcher = watcher
    editor.watcherExt = watcherExt
    editor.noWatch = noWatch
    editor.adjustCursorPosition = adjustCursorPosition
    editor.setContent = setContent
    editor.replace = replace
    editor.replaceAll = replaceAll
    editor.getContent = getTextContent
    editor.focus = focus
    editor.setSelection = setSelection
    editor.addKeystroke = addKeystroke
    editor.addMarker = addMarker
    editor.removeMarker = removeMarker

    editor.init = function (options) {
      options = ({
        cursorFocusRatio: 0.5,
        highlighter: function (text) {
          return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ')
        },
        sectionDelimiter: ''
      }).cl_extend(options || {})
      editor.options = options

      if (options.content !== undefined) {
        lastTextContent = options.content.toString()
        if (lastTextContent.slice(-1) !== '\n') {
          lastTextContent += '\n'
        }
      }

      var sectionList = parseSections(lastTextContent, true)
      editor.$trigger('contentChanged', lastTextContent, [0, lastTextContent], sectionList)
      editor.$trigger('contentChangedExt', lastTextContent, [0, lastTextContent], sectionList)
      if (options.selectionStart !== undefined && options.selectionEnd !== undefined) {
        editor.setSelection(options.selectionStart, options.selectionEnd)
      } else {
        selectionMgr.saveSelectionState()
      }
      undoMgr.init(options)

      if (options.scrollTop !== undefined) {
        setScrollTop(options.scrollTop)
      }
    }

    return editor
  }

  window.cledit = cledit
})(window.diff_match_patch)
