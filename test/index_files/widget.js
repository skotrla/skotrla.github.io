"use strict";
/* exported receptivePublicLib */
/* global XMLHttpRequest */
/* global intercomSettings */
/* global receptiveAppSettings */
/* global window */
/* global document */
var receptivePublicLib = (function() {
  var vendorApiHome = undefined;
  var apiHome = "https://api.feedback.eu.pendo.io";
  var siteUrl = "https://feedback.eu.pendo.io";
  var widgetInitialSrc = siteUrl + "/html/widget/notLoaded.html";
  var receptiveLoginHost = "";
  var widgetLoaded = false;

  var regExp = function(name) {
    return new RegExp("(^| )"+ name +"( |$)");
  };

  function forEach(list, fn) {
    for (var i = 0; i < list.length; i++) {
      fn(list[i]);
    }
  }

  function hasClass(elem, klass) {
    return (" " + elem.className + " ").indexOf(" " + klass + " ") > -1;
  }

  function addClass(elem, klass) {
    if (!hasClass(elem, klass)) {
      elem.className += " "+ klass;
    }
  }

  function removeClass(elem, klass) {
    elem.className = elem.className.replace(regExp(klass), "");
  }

  function makeRequest(url, method, data, callback, errorCallback) {
    if (window.XMLHttpRequest) {
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            callback(xhr);
          } else {
            if(errorCallback !== undefined) {
              errorCallback(xhr);
            }
          }
        }
      };
      xhr.open(method, url);
      xhr.setRequestHeader('Content-type', 'application/json');
      xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
      xhr.send(data);
    }
    return null;
  }

  function makeApiRequest(url, method, originalData, toSend, callback, errorCallback) {
    var apiRequest = function() {
      makeRequest(vendorApiHome + url, method, toSend, callback, errorCallback);
    };
    if(vendorApiHome === undefined) {
      var apiGetUrl = apiHome + "/widget/vendor_api_endpoint?data=" + encodeURIComponent(originalData);
      makeRequest(apiGetUrl, "GET", {}, function(result) {
        if(result.status == 204) {
          errorCallback()
        } else {
          vendorApiHome = result.response;
          apiRequest();
        };
      }, errorCallback);
    } else {
      apiRequest();
    }
  }

  function getJson(url, data, callback, errorCallback) {
    var urlToSend = url + "?data=" + encodeURIComponent(data);
    makeApiRequest(urlToSend, "GET", data, {}, callback, errorCallback);
  }

  function postJson(url, toSend, callback, errorCallback) {
    makeApiRequest(url, "POST", toSend.data, JSON.stringify(toSend), callback, errorCallback);
  }

  function getData(data) {
    if ((typeof data === "undefined") && (typeof receptiveAppSettings !== "undefined")) {
      data = receptiveAppSettings;
    }
    if ((typeof data === "string") || (data instanceof String)) {
      return data;
    } else if (JSON.stringify) {
      return JSON.stringify(data);
    } else {
      return null;
    }
  }

  function storeLastPingTime() {
    var d = new Date();
    d.setTime(d.getTime() + 3600000);
    document.cookie = "receptivePingSent=true; expires="+d.toUTCString();
  }

  function wasPingSentRecently() {
    return document.cookie.indexOf("receptivePingSent=") !== -1;
  }

  function ping(data) {
    if (! wasPingSentRecently()) {
      var toSend = {data: getData(data)};
      if(toSend.data && toSend.data !== "{}" && toSend.data !== "null") {
        postJson("/widget/ping", toSend, onWidgetPingResponse, function() {});
      }
    }
  }

  function getCookie(name) {
    var value = "; " + document.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length == 2) return parts.pop().split(";").shift();
  }

  function getNotificationCount() {
    var notificationCount = getCookie("receptiveNotificationCount") || 0;
    return parseInt(notificationCount);
  }

  function showNotificationsFromCookie() {
    var notificationCountElems = document.querySelectorAll(".receptive-notification");
    if(notificationCountElems.length === 0) { return; }
    var notificationCount = getNotificationCount();
    if (notificationCount > 0) {
      forEach(notificationCountElems, function(elem) {
        elem.style.visibility = "visible";
      });
    } else {
      forEach(notificationCountElems, function(elem) {
        elem.style.visibility = "hidden";
      });
    }
  }

  function onWidgetPingResponse(xhr) {
    storeLastPingTime();
    var res = JSON.parse(xhr.responseText);
    document.cookie = "receptiveNotificationCount=" + res.notifications;
    showNotificationsFromCookie();
  }

  function loginAndRedirect(options, data) {
    if(typeof options === "undefined" ) {
      options = {};
    }
    if(options.anchor !== undefined && options.anchor.nodeName.toUpperCase() === "A") {
      openNewAjaxTab();
      return false;
    } else {
      getReceptiveLoginUrl(data, function(loginUrl) {
        window.location.href = loginUrl;
      });
    }
  }

  function openNewAjaxTab(data) {
    var tabOpen = window.open(widgetInitialSrc, Math.random().toString(36).substring(7));

    getReceptiveLoginUrl(data, function(loginurl) {
      tabOpen.location = loginurl;
    });
  }

  function getUrlHost(url) {
    var parser = document.createElement("a");
    parser.href = url;
    return parser.host;
  }

  function saveLoginHost(url) {
    receptivePublicLib.receptiveLoginHost = getUrlHost(url);
  }

  function getReceptiveLoginUrl(data, callback) {
    var toSend = {data: getData(data)};
    postJson("/widget/token", toSend, function(xhr) {
      if (JSON.parse) {
        var r = JSON.parse(xhr.responseText);
        saveLoginHost(r.login_url);
        callback(r.login_url);
      }
    });
  }

  function widgetElem() {
    return document.getElementById("receptive-widget");
  }

  function openReceptive(e){
    if(e) { e.preventDefault(); }
    var widgetIframe = getWidgetFrame();
    if(!widgetIframe.src || widgetIframe.src === widgetInitialSrc) {
      getReceptiveLoginUrl(undefined, function(loginUrl) {
        widgetIframe.src = loginUrl + "&inWidget=true";
      });
    }
    addOverlay();
    addClass(widgetElem(), "visible");
  }

  function widgetFrameElem() {
    return document.getElementById("receptive-widget_iframe");
  }

  function getWidgetFrame() {
    var widgetIframe = widgetFrameElem();
    if(!widgetIframe) {
      initialiseWidgetFrame();
      widgetIframe = widgetFrameElem();
    }
    return widgetIframe;
  }

  function closeReceptive() {
    removeOverlay();
    removeClass(widgetElem(), "visible");
  }

  function addOverlay() {
    var widget = document.getElementById("receptive-widget");
    if(!widget) {return;}
    var overlay = document.createElement("div");
    var parentNode = widget.parentNode;
    overlay.id = "receptive-overlay";
    parentNode.insertBefore(overlay, widget);
  }

  function removeOverlay() {
    var widget = document.getElementById("receptive-widget");
    var overlay = document.getElementById("receptive-overlay");
    if(!widget || !overlay) {return;}
    widget.parentNode.removeChild(overlay);
  }

  function originIsReceptive(origin){
    if (receptivePublicLib.receptiveLoginHost) {
      return getUrlHost(origin) === receptivePublicLib.receptiveLoginHost;
    }
    return getUrlHost(origin) === getUrlHost(siteUrl);
  }

  function subscribeToIframeMessages() {
    window.addEventListener("message", function(event) {
      var origin = event.origin || event.originalEvent.origin;
      if(!originIsReceptive(origin)) { return; }
      processIframeMessage(event.data.message, event.data.data);
    }, false);
  }

  function processIframeMessage(message, data) {
    switch(message) {
    case "close-receptive-widget":
      closeReceptive();
      break;
    case "open-receptive":
      loginAndRedirect();
      break;
    case "update-receptive-notification-count":
      document.cookie = "receptiveNotificationCount=" + data.count;
      showNotificationsFromCookie();
      break;
    case "handle-logout":
      widgetFrameElem().src = widgetInitialSrc;
      closeReceptive();
      break;
    case "loaded-receptive-widget":
      widgetLoaded = true;
      break;
    }
  }

  function loadWidgetCss() {
    if(!document.getElementById("receptiveCss")) {
      var head = document.getElementsByTagName("head")[0];
      var link = document.createElement("link");
      link.id = "receptiveCss";
      link.rel = "stylesheet";
      link.type = "text/css";
      link.href = siteUrl + "/css/widget/widget.css";
      link.media = "all";
      head.appendChild(link);
    }
  }

  function validReceptiveAppSettings() {
    if(!receptiveAppSettings.jwt && !receptiveAppSettings.user.id) { return false }
    return true;
  }

  function initialiseWidget(settings) {
    if (!validReceptiveAppSettings()) { return; }
    registerTurbolinksHook();
    var positions = settings.integrationTriggerPosition.toLowerCase().split('_');
    if(settings.integrationCustomTrigger !== "true") {
      var position_styles = 'receptive-trigger--' + positions[0] + ' receptive-trigger--' + positions[1];
      var receptiveTrigger = '<div style="opacity: 0" id="receptive-trigger" class="receptive-trigger ' + position_styles + '" data-turbolinks-permanent>' +
      '<span class="receptive-notification"></span>' +
      '<button style="background: #' + settings.integrationTriggerColor + ';" onClick="receptivePublicLib.openReceptive(event)">' +
      '<span class="r-button__text">' + settings.integrationTriggerText + '</span>' +
      '</button>' +
      '</div>';
      insertOrReplace("receptive-trigger", receptiveTrigger);
    }
    initialiseWidgetFrame(positions[1]);
  }

  function registerTurbolinksHook() {
    //Turbolinks copies the src of the old iframe to the new iframe on page transitions.
    //This causes the browser to re-request a receptive login using the same token.
    //Before page transition blank out the iframe src to force the widget to re auth.
    document.addEventListener("turbolinks:before-visit", function(event) {
      var iframe = document.getElementById("receptive-widget_iframe");
      if(iframe) {
        iframe.src = widgetInitialSrc;
      }
    });
  }

  function insertOrReplace(id, html) {
    var existingElem = document.getElementById(id);
    if(existingElem){
      var template = document.createElement('template');
      template.innerHTML = html;
      existingElem.parentNode.replaceChild(template.content.firstChild, existingElem);
    } else {
      document.body.insertAdjacentHTML('beforeend', html);
    }
  }

  function initialiseWidgetFrame(side) {
    loadWidgetCss();
    var receptiveIframe = '<div style="display: none" id="receptive-widget" class="buttonIs-' + side + '" data-turbolinks-permanent>' +
      '<iframe id="receptive-widget_iframe" src="' + widgetInitialSrc + '" ></iframe>' +
      '</div>';
    insertOrReplace("receptive-widget", receptiveIframe);
    subscribeToIframeMessages();
  }

  function getSettings(callback) {
    var data = getData();
    if(data && data !== "{}") {
      getJson("/widget/integration_settings", data, function(xhr){
        var settings = JSON.parse(xhr.response).settings;
        callback(settings);
      });
    }
  }

  var isReceptiveLoaded = function() {
    return widgetLoaded;
  };

  function init() {
    try {
      if (typeof intercomSettings !== "undefined") {
        receptiveAppSettings.intercom = intercomSettings;
      }
      if (typeof receptiveAppSettings !== "undefined") {
        getSettings(function(settings){
          if(settings.integrationType === "WIDGET") {
            initialiseWidget(settings);
          }
          showNotificationsFromCookie();
        });
        ping(receptiveAppSettings);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    initialised: init(),
    ping: ping,
    init: init,
    loginAndRedirect: loginAndRedirect,
    openReceptive: openReceptive,
    isReceptiveLoaded: isReceptiveLoaded
  };
})();
