// Copyright: Hiroshi Ichikawa <http://gimite.net/en/>
// License: New BSD License
// Reference: http://dev.w3.org/html5/websockets/
// Reference: http://tools.ietf.org/html/rfc6455

(function() {
  window.WEB_SOCKET_FORCE_FLASH = false;
  
	//Web Server 경로설정
  window.WEB_SOCKET_SWF_LOCATION = "./js/websocket.swf";
  
  var SCRAPING_FLASH_DOWN_URL = "https://get.adobe.com/kr/flashplayer/";
  
  if (window.WEB_SOCKET_FORCE_FLASH) {
    // Keeps going.
  } else if (window.WebSocket) {
		window.WebSocket2 = window.WebSocket;
    return;
  } else if (window.MozWebSocket) {
    // Firefox.
    window.WebSocket2 = MozWebSocket;
	//window.WebSocket2 = window.WebSocket;
    return;
  }
  
  var logger;
  try{
	  if (window.WEB_SOCKET_LOGGER) {
	    logger = WEB_SOCKET_LOGGER;
	  } else if (window.console && window.console.log && window.console.error) {
	    logger = window.console;
	  } else {
	    logger = {log: function(){ }, error: function(){ }};
	  }
  }catch(e){
  	logger = {log: function(){ }, error: function(){ }};
  }
  // swfobject.hasFlashPlayerVersion("10.0.0") doesn't work with Gnash.
  if ( swfobject.getFlashPlayerVersion().major < 10 && !window.WebSocket && !window.MozWebSocket ) {
//	  alert('웹소켓이 가능한 브라우저이거나 플래시 플레이어 10.0.0 이상 설치된 브라우저에서 이용 가능합니다.');
	  logger.error("Flash Player >= 10.0.0 is required.");
	  //window.open(SCRAPING_FLASH_DOWN_URL);
	  return;
  }
  if (location.protocol == "file:") {
    logger.error(
      "WARNING: web-socket-js doesn't work in file:///... URL " +
      "unless you set Flash Security Settings properly. " +
      "Open the page via Web server i.e. http://...");
  }

  /**
   * Our own implementation of WebSocket2 class using Flash.
   * @param {string} url
   * @param {array or string} protocols
   * @param {string} proxyHost
   * @param {int} proxyPort
   * @param {string} headers
   */
  //window.WebSocket2 = function(url, protocols, proxyHost, proxyPort, headers) {
  WebSocket2 = function(url, protocols, proxyHost, proxyPort, headers) {
    var self = this;
    self.__id = WebSocket2.__nextId++;
    WebSocket2.__instances[self.__id] = self;
    self.readyState = WebSocket2.CONNECTING;
    self.bufferedAmount = 0;
    self.__events = {};
    if (!protocols) {
      protocols = [];
    } else if (typeof protocols == "string") {
      protocols = [protocols];
    }
    // Uses setTimeout() to make sure __createFlash() runs after the caller sets ws.onopen etc.
    // Otherwise, when onopen fires immediately, onopen is called before it is set.
    self.__createTask = setTimeout(function() {
      WebSocket2.__addTask(function() {
        self.__createTask = null;
        WebSocket2.__flash.create(
            self.__id, url, protocols, proxyHost || null, proxyPort || 0, headers || null);
      });
    }, 0);
  };

  /**
   * Send data to the web socket.
   * @param {string} data  The data to send to the socket.
   * @return {boolean}  True for success, false for failure.
   */
  WebSocket2.prototype.send = function(data) {
    if (this.readyState == WebSocket2.CONNECTING) {
      throw "INVALID_STATE_ERR: Web Socket connection has not been established";
    }
    // We use encodeURIComponent() here, because FABridge doesn't work if
    // the argument includes some characters. We don't use escape() here
    // because of this:
    // https://developer.mozilla.org/en/Core_JavaScript_1.5_Guide/Functions#escape_and_unescape_Functions
    // But it looks decodeURIComponent(encodeURIComponent(s)) doesn't
    // preserve all Unicode characters either e.g. "\uffff" in Firefox.
    // Note by wtritch: Hopefully this will not be necessary using ExternalInterface.  Will require
    // additional testing.
    var result = WebSocket2.__flash.send(this.__id, encodeURIComponent(data));
    if (result < 0) { // success
      return true;
    } else {
      this.bufferedAmount += result;
      return false;
    }
  };

  /**
   * Close this web socket gracefully.
   */
  WebSocket2.prototype.close = function() {
    if (this.__createTask) {
      clearTimeout(this.__createTask);
      this.__createTask = null;
      this.readyState = WebSocket2.CLOSED;
      return;
    }
    if (this.readyState == WebSocket2.CLOSED || this.readyState == WebSocket2.CLOSING) {
      return;
    }
    this.readyState = WebSocket2.CLOSING;
    WebSocket2.__flash.close(this.__id);
  };

  /**
   * Implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-registration">DOM 2 EventTarget Interface</a>}
   *
   * @param {string} type
   * @param {function} listener
   * @param {boolean} useCapture
   * @return void
   */
  WebSocket2.prototype.addEventListener = function(type, listener, useCapture) {
    if (!(type in this.__events)) {
      this.__events[type] = [];
    }
    this.__events[type].push(listener);
  };

  /**
   * Implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-registration">DOM 2 EventTarget Interface</a>}
   *
   * @param {string} type
   * @param {function} listener
   * @param {boolean} useCapture
   * @return void
   */
  WebSocket2.prototype.removeEventListener = function(type, listener, useCapture) {
    if (!(type in this.__events)) return;
    var events = this.__events[type];
    for (var i = events.length - 1; i >= 0; --i) {
      if (events[i] === listener) {
        events.splice(i, 1);
        break;
      }
    }
  };

  /**
   * Implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-registration">DOM 2 EventTarget Interface</a>}
   *
   * @param {Event} event
   * @return void
   */
  WebSocket2.prototype.dispatchEvent = function(event) {
    var events = this.__events[event.type] || [];
    for (var i = 0; i < events.length; ++i) {
      events[i](event);
    }
    var handler = this["on" + event.type];
    if (handler) handler.apply(this, [event]);
  };

  /**
   * Handles an event from Flash.
   * @param {Object} flashEvent
   */
  WebSocket2.prototype.__handleEvent = function(flashEvent) {
    
    if ("readyState" in flashEvent) {
      this.readyState = flashEvent.readyState;
    }
    if ("protocol" in flashEvent) {
      this.protocol = flashEvent.protocol;
    }
    
    var jsEvent;
    if (flashEvent.type == "open" || flashEvent.type == "error") {
      jsEvent = this.__createSimpleEvent(flashEvent.type);
    } else if (flashEvent.type == "close") {
      jsEvent = this.__createSimpleEvent("close");
      jsEvent.wasClean = flashEvent.wasClean ? true : false;
      jsEvent.code = flashEvent.code;
      jsEvent.reason = flashEvent.reason;
    } else if (flashEvent.type == "message") {
      var data = decodeURIComponent(flashEvent.message);
      jsEvent = this.__createMessageEvent("message", data);
    } else {
      throw "unknown event type: " + flashEvent.type;
    }
    
    this.dispatchEvent(jsEvent);
    
  };
  
  WebSocket2.prototype.__createSimpleEvent = function(type) {
    if (document.createEvent && window.Event) {
      var event = document.createEvent("Event");
      event.initEvent(type, false, false);
      return event;
    } else {
      return {type: type, bubbles: false, cancelable: false};
    }
  };
  
  WebSocket2.prototype.__createMessageEvent = function(type, data) {
    if (window.MessageEvent && typeof(MessageEvent) == "function" && !window.opera) {
      return new MessageEvent("message", {
        "view": window,
        "bubbles": false,
        "cancelable": false,
        "data": data
      });
    } else if (document.createEvent && window.MessageEvent && !window.opera) {
      var event = document.createEvent("MessageEvent");
    	event.initMessageEvent("message", false, false, data, null, null, window, null);
      return event;
    } else {
      // Old IE and Opera, the latter one truncates the data parameter after any 0x00 bytes.
      return {type: type, data: data, bubbles: false, cancelable: false};
    }
  };
  
  /**
   * Define the WebSocket2 readyState enumeration.
   */
  WebSocket2.CONNECTING = 0;
  WebSocket2.OPEN = 1;
  WebSocket2.CLOSING = 2;
  WebSocket2.CLOSED = 3;

  // Field to check implementation of WebSocket2.
  WebSocket2.__isFlashImplementation = true;
  WebSocket2.__initialized = false;
  WebSocket2.__flash = null;
  WebSocket2.__instances = {};
  WebSocket2.__tasks = [];
  WebSocket2.__nextId = 0;
  
  /**
   * Load a new flash security policy file.
   * @param {string} url
   */
  WebSocket2.loadFlashPolicyFile = function(url){
    WebSocket2.__addTask(function() {
      WebSocket2.__flash.loadManualPolicyFile(url);
    });
  };

  /**
   * Loads WebSocketMain.swf and creates WebSocketMain object in Flash.
   */
  WebSocket2.__initialize = function() {
    
    if (WebSocket2.__initialized) return;
    WebSocket2.__initialized = true;
    
    if (WebSocket2.__swfLocation) {
      // For backword compatibility.
      window.WEB_SOCKET_SWF_LOCATION = WebSocket2.__swfLocation;
    }
    
    //window.WEB_SOCKET_SWF_LOCATION = "/js/WebSocket/WebSocket2.swf";
    if (!window.WEB_SOCKET_SWF_LOCATION) {
      logger.error("[WebSocket2] set WEB_SOCKET_SWF_LOCATION to location of WebSocketMain.swf");
      return;
    }
    if (!window.WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR &&
        !WEB_SOCKET_SWF_LOCATION.match(/(^|\/)websocket\.swf(\?.*)?$/) &&
        WEB_SOCKET_SWF_LOCATION.match(/^\w+:\/\/([^\/]+)/)) {
      var swfHost = RegExp.$1;
      if (location.host != swfHost) {
        logger.error(
            "[WebSocket2] You must host HTML and WebSocketMain.swf in the same host " +
            "('" + location.host + "' != '" + swfHost + "'). " +
            "See also 'How to host HTML file and SWF file in different domains' section " +
            "in README.md. If you use WebSocket2.swf, you can suppress this message " +
            "by WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR = true;");
      }
    }
    var container = document.createElement("div");
    container.id = "webSocketContainer";
    // Hides Flash box. We cannot use display: none or visibility: hidden because it prevents
    // Flash from loading at least in IE. So we move it out of the screen at (-100, -100).
    // But this even doesn't work with Flash Lite (e.g. in Droid Incredible). So with Flash
    // Lite, we put it at (0, 0). This shows 1x1 box visible at left-top corner but this is
    // the best we can do as far as we know now.
    container.style.position = "absolute";
    if (WebSocket2.__isFlashLite()) {
      container.style.left = "0px";
      container.style.top = "0px";
    } else {
      container.style.left = "-100px";
      container.style.top = "-100px";
    }
    var holder = document.createElement("div");
    holder.id = "webSocketFlash";
    container.appendChild(holder);
    document.body.appendChild(container);
    // See this article for hasPriority:
    // http://help.adobe.com/en_US/as3/mobile/WS4bebcd66a74275c36cfb8137124318eebc6-7ffd.html
    swfobject.embedSWF(
      WEB_SOCKET_SWF_LOCATION,
      "webSocketFlash",
      "1" /* width */,
      "1" /* height */,
      "10.0.0" /* SWF version */,
      null,
      null,
      {hasPriority: true, swliveconnect : true, allowScriptAccess: "samedomain"},
      null,
      function(e) {
        if (!e.success) {
          alert("[WebSocket2] swfobject.embedSWF failed");
          logger.error("[WebSocket2] swfobject.embedSWF failed");
        }
      }
    );
    
  };
  
  /**
   * Called by Flash to notify JS that it's fully loaded and ready
   * for communication.
   */
  WebSocket2.__onFlashInitialized = function() {
    // We need to set a timeout here to avoid round-trip calls
    // to flash during the initialization process.
    setTimeout(function() {
      WebSocket2.__flash = document.getElementById("webSocketFlash");
      WebSocket2.__flash.setCallerUrl(location.href);
      WebSocket2.__flash.setDebug(!!window.WEB_SOCKET_DEBUG);
      for (var i = 0; i < WebSocket2.__tasks.length; ++i) {
        WebSocket2.__tasks[i]();
      }
      WebSocket2.__tasks = [];
    }, 0);
  };
  
  /**
   * Called by Flash to notify WebSockets events are fired.
   */
  WebSocket2.__onFlashEvent = function() {
    setTimeout(function() {
      try {
        // Gets events using receiveEvents() instead of getting it from event object
        // of Flash event. This is to make sure to keep message order.
        // It seems sometimes Flash events don't arrive in the same order as they are sent.
        var events = WebSocket2.__flash.receiveEvents();
        for (var i = 0; i < events.length; ++i) {
          WebSocket2.__instances[events[i].webSocketId].__handleEvent(events[i]);
        }
      } catch (e) {
        logger.error(e);
      }
    }, 0);
    return true;
  };
  
  // Called by Flash.
  WebSocket2.__log = function(message) {
    logger.log(decodeURIComponent(message));
  };
  
  // Called by Flash.
  WebSocket2.__error = function(message) {
    logger.error(decodeURIComponent(message));
  };
  
  WebSocket2.__addTask = function(task) {
    if (WebSocket2.__flash) {
      task();
    } else {
      WebSocket2.__tasks.push(task);
    }
  };
  
  /**
   * Test if the browser is running flash lite.
   * @return {boolean} True if flash lite is running, false otherwise.
   */
  WebSocket2.__isFlashLite = function() {
    if (!window.navigator || !window.navigator.mimeTypes) {
      return false;
    }
    var mimeType = window.navigator.mimeTypes["application/x-shockwave-flash"];
    if (!mimeType || !mimeType.enabledPlugin || !mimeType.enabledPlugin.filename) {
      return false;
    }
    return mimeType.enabledPlugin.filename.match(/flashlite/i) ? true : false;
  };
  
  if (!window.WEB_SOCKET_DISABLE_AUTO_INITIALIZATION) {
    // NOTE:
    //   This fires immediately if web_socket.js is dynamically loaded after
    //   the document is loaded.
    swfobject.addDomLoadEvent(function() {
      WebSocket2.__initialize();
    });
  }
  
})();
