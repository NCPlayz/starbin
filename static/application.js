/* global $, hljs, window, document */

///// represents a single document

class haste_document {
  constructor() {
    this.locked = false;
  }
  // Get this document from the server and lock it here
  load(key, callback, lang) {
    fetch(`/documents/${key}`).then(
      async (result) => {
        let json = await result.json();
        let data = json.data;

        try {
          if (lang === "txt") {
            high = { value: htmlEscape(data) };
          } else if (lang) {
            high = hljs.highlight(lang, data);
          }
        } catch {}

        if (!high) {
          high = hljs.highlightAuto(data);
        }

        callback({
          value: high.value,
          key: key,
          language: high.language || lang,
          lineCount: res.data.split("\n").length,
        });
      },
      () => callback(false)
    );
  }
  // Save this document to the server and lock it here
  save(data, callback) {
    if (this.locked) {
      return false;
    }
    this.data = data;
    var _this = this;
    $.ajax("/documents", {
      type: "post",
      data: data,
      dataType: "json",
      contentType: "text/plain; charset=utf-8",
      success: function (res) {
        _this.locked = true;
        _this.key = res.key;
        var high = hljs.highlightAuto(data);
        callback(null, {
          value: high.value,
          key: res.key,
          language: high.language,
          lineCount: data.split("\n").length,
        });
      },
      error: function (res) {
        try {
          callback($.parseJSON(res.responseText));
        } catch (e) {
          callback({ message: "Something went wrong!" });
        }
      },
    });
  }
}

// Escapes HTML tag characters
htmlEscape = function (s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/>/g, "&gt;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
};

///// represents the paste application

class haste {
  constructor(appName, options) {
    this.appName = appName;
    /** @type {HTMLTextAreaElement} */
    this.$textarea = document.getElementById("textarea");
    this.$box = document.getElementById("box");
    /** @type {HTMLSpanElement} */
    this.$code = this.$box.querySelector("code");
    this.$linenos = document.getElementById("linenos");
    this.options = options;
    this.configureShortcuts();
    this.configureButtons();
    // If twitter is disabled, hide the button
    if (!options.twitter) {
      let twitterbox = document.querySelector("#box2 .twitter");
      twitterbox.display = "none";
    }
  }
  // Set the page title - include the appName
  setTitle(ext) {
    var title = ext ? this.appName + " - " + ext : this.appName;
    document.title = title;
  }
  // Show a message box
  showMessage(msg, cls) {
    var msgBox = document.createElement("li");
    msgBox.classList.add(cls || info);
    msgBox.classList.add("hide-messages");
    msgBox.innerText = msg;

    var messages = document.querySelector("#messages");

    document.insertBefore(msgBox, messages);
    setTimeout(() => {
      msgBox.classList.toggle("messages-hide");
      setTimeout(() => {
        msgBox.remove();
      }, 200);
    }, 3000);
  }
  // Show the light key
  lightKey() {
    this.configureKey(["new", "save"]);
  }
  // Show the full key
  fullKey() {
    this.configureKey(["new", "duplicate", "twitter", "raw"]);
  }
  // Set the key up for certain things to be enabled
  configureKey(enable) {
    let element = document.querySelectorAll("#box2 .function");
    element.forEach((v) => {
      enable.forEach((item) => {
        if (v.classList.contains(item)) {
          v.classList.add("enabled");
        } else {
          v.classList.remove("enabled");
        }
      });
    });
  }
  // Remove the current document (if there is one)
  // and set up for a new one
  newDocument(hideHistory) {
    this.$box.hide();
    this.doc = new haste_document();
    if (!hideHistory) {
      window.history.pushState(null, this.appName, "/");
    }
    this.setTitle();
    this.lightKey();
    this.$textarea.value = "";
    this.$textarea.display = "block";
    this.$textarea.focus();
    this.removeLineNumbers();
  }
  // Look up the extension preferred for a type
  // If not found, return the type itself - which we'll place as the extension
  lookupExtensionByType(type) {
    for (var key in haste.extensionMap) {
      if (haste.extensionMap[key] === type) return key;
    }
    return type;
  }
  // Look up the type for a given extension
  // If not found, return the extension - which we'll attempt to use as the type
  lookupTypeByExtension(ext) {
    return haste.extensionMap[ext] || ext;
  }
  // Add line numbers to the document
  // For the specified number of lines
  addLineNumbers(lineCount) {
    /** @type {HTMLDivElement} */
    let linenos = document.getElementById("linenos");

    for (var i = 1; i <= lineCount; i++) {
      let t = document.createTextNode(i.toString());
      let br = document.createElement("br");
      linenos.appendChild(t);
      linenos.appendChild(br);
    }
  }
  // Remove the line numbers
  removeLineNumbers() {
    /** @type {HTMLDivElement} */
    let linenos = document.getElementById("linenos");

    linenos.replaceChildren();
  }
  // Load a document and show it
  loadDocument(key) {
    // Split the key up
    var parts = key.split(".", 2);
    // Ask for what we want
    var _this = this;
    _this.doc = new haste_document();
    _this.doc.load(
      parts[0],
      function (ret) {
        if (ret) {
          _this.$code.html(ret.value);
          _this.setTitle(ret.key);
          _this.fullKey();
          _this.$textarea.value = "";
          _this.$textarea.display = "none";
          _this.$box.display = "block";
          _this.$box.focus();
          _this.addLineNumbers(ret.lineCount);
        } else {
          _this.newDocument();
        }
      },
      this.lookupTypeByExtension(parts[1])
    );
  }
  // Duplicate the current document - only if locked
  duplicateDocument() {
    if (this.doc.locked) {
      var currentData = this.doc.data;
      this.newDocument();
      this.$textarea.val(currentData);
    }
  }
  // Lock the current document
  lockDocument() {
    var _this = this;
    this.doc.save(this.$textarea.val(), function (err, ret) {
      if (err) {
        _this.showMessage(err.message, "error");
      } else if (ret) {
        _this.$code.html(ret.value);
        _this.setTitle(ret.key);
        var file = "/" + ret.key;
        if (ret.language) {
          file += "." + _this.lookupExtensionByType(ret.language);
        }
        window.history.pushState(null, _this.appName + "-" + ret.key, file);
        _this.fullKey();
        _this.$textarea.val("").hide();
        _this.$box.show().focus();
        _this.addLineNumbers(ret.lineCount);
      }
    });
  }
  configureButtons() {
    var _this = this;
    this.buttons = [
      {
        $where: $("#box2 .save"),
        label: "Save",
        shortcutDescription: "control + s",
        shortcut: function (evt) {
          return evt.ctrlKey && evt.keyCode === 83;
        },
        action: function () {
          if (_this.$textarea.val().replace(/^\s+|\s+$/g, "") !== "") {
            _this.lockDocument();
          }
        },
      },
      {
        $where: $("#box2 .new"),
        label: "New",
        shortcut: function (evt) {
          return evt.ctrlKey && evt.keyCode === 78;
        },
        shortcutDescription: "control + n",
        action: function () {
          _this.newDocument(!_this.doc.key);
        },
      },
      {
        $where: $("#box2 .duplicate"),
        label: "Duplicate & Edit",
        shortcut: function (evt) {
          return _this.doc.locked && evt.ctrlKey && evt.keyCode === 68;
        },
        shortcutDescription: "control + d",
        action: function () {
          _this.duplicateDocument();
        },
      },
      {
        $where: $("#box2 .raw"),
        label: "Just Text",
        shortcut: function (evt) {
          return evt.ctrlKey && evt.shiftKey && evt.keyCode === 82;
        },
        shortcutDescription: "control + shift + r",
        action: function () {
          window.location.href = "/raw/" + _this.doc.key;
        },
      },
      {
        $where: $("#box2 .twitter"),
        label: "Twitter",
        shortcut: function (evt) {
          return (
            _this.options.twitter &&
            _this.doc.locked &&
            evt.shiftKey &&
            evt.ctrlKey &&
            evt.keyCode == 84
          );
        },
        shortcutDescription: "control + shift + t",
        action: function () {
          window.open(
            "https://twitter.com/share?url=" + encodeURI(window.location.href)
          );
        },
      },
    ];
    for (var i = 0; i < this.buttons.length; i++) {
      this.configureButton(this.buttons[i]);
    }
  }
  configureButton(options) {
    // Handle the click action
    options.$where.click(function (evt) {
      evt.preventDefault();
      if (!options.clickDisabled && $(this).hasClass("enabled")) {
        options.action();
      }
    });
    // Show the label
    options.$where.mouseenter(function () {
      $("#box3 .label").text(options.label);
      $("#box3 .shortcut").text(options.shortcutDescription || "");
      $("#box3").show();
      $(this).append($("#pointer").remove().show());
    });
    // Hide the label
    options.$where.mouseleave(function () {
      $("#box3").hide();
      $("#pointer").hide();
    });
  }
  // Configure keyboard shortcuts for the textarea
  configureShortcuts() {
    var _this = this;
    $(document.body).keydown(function (evt) {
      var button;
      for (var i = 0; i < _this.buttons.length; i++) {
        button = _this.buttons[i];
        if (button.shortcut && button.shortcut(evt)) {
          evt.preventDefault();
          button.action();
          return;
        }
      }
    });
  }
}

// Map of common extensions
// Note: this list does not need to include anything that IS its extension,
// due to the behavior of lookupTypeByExtension and lookupExtensionByType
// Note: optimized for lookupTypeByExtension
haste.extensionMap = {
  rb: "ruby",
  py: "python",
  pl: "perl",
  php: "php",
  scala: "scala",
  go: "go",
  xml: "xml",
  html: "xml",
  htm: "xml",
  css: "css",
  js: "javascript",
  vbs: "vbscript",
  lua: "lua",
  pas: "delphi",
  java: "java",
  cpp: "cpp",
  cc: "cpp",
  m: "objectivec",
  vala: "vala",
  sql: "sql",
  sm: "smalltalk",
  lisp: "lisp",
  ini: "ini",
  diff: "diff",
  bash: "bash",
  sh: "bash",
  tex: "tex",
  erl: "erlang",
  hs: "haskell",
  md: "markdown",
  txt: "",
  coffee: "coffee",
  swift: "swift",
};

///// Tab behavior in the textarea - 2 spaces per tab
$(function () {
  $("textarea").keydown(function (evt) {
    if (evt.keyCode === 9) {
      evt.preventDefault();
      var myValue = "  ";
      // http://stackoverflow.com/questions/946534/insert-text-into-textarea-with-jquery
      // For browsers like Internet Explorer
      if (document.selection) {
        this.focus();
        var sel = document.selection.createRange();
        sel.text = myValue;
        this.focus();
      }
      // Mozilla and Webkit
      else if (this.selectionStart || this.selectionStart == "0") {
        var startPos = this.selectionStart;
        var endPos = this.selectionEnd;
        var scrollTop = this.scrollTop;
        this.value =
          this.value.substring(0, startPos) +
          myValue +
          this.value.substring(endPos, this.value.length);
        this.focus();
        this.selectionStart = startPos + myValue.length;
        this.selectionEnd = startPos + myValue.length;
        this.scrollTop = scrollTop;
      } else {
        this.value += myValue;
        this.focus();
      }
    }
  });
});
