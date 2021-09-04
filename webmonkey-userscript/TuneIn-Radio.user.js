// ==UserScript==
// @name         TuneIn Radio
// @description  Improve site usability. Listen to audio streams in external player.
// @version      1.0.0
// @match        *://tunein.com/*
// @match        *://*.tunein.com/*
// @icon         https://cdn-web.tunein.com/assets/img/apple-touch-icon-180.png
// @run-at       document-end
// @grant        unsafeWindow
// @homepage     https://github.com/warren-bank/crx-TuneIn-Radio/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-TuneIn-Radio/issues
// @downloadURL  https://github.com/warren-bank/crx-TuneIn-Radio/raw/webmonkey-userscript/es5/webmonkey-userscript/TuneIn-Radio.user.js
// @updateURL    https://github.com/warren-bank/crx-TuneIn-Radio/raw/webmonkey-userscript/es5/webmonkey-userscript/TuneIn-Radio.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- constants

var user_options = {
  "redirect_to_webcast_reloaded": true,
  "force_http":                   true,
  "force_https":                  false
}

// ----------------------------------------------------------------------------- helpers

// make GET request, parse JSON response, pass data to callback
var download_url = function(url, headers, callback, isJSON) {
  var xhr = new unsafeWindow.XMLHttpRequest()
  xhr.open("GET", url, true, null, null)

  if (headers && (typeof headers === 'object')) {
    var keys = Object.keys(headers)
    var key, val
    for (var i=0; i < keys.length; i++) {
      key = keys[i]
      val = headers[key]
      xhr.setRequestHeader(key, val)
    }
  }

  xhr.onload = function(e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          var text_data, json_data

          text_data = xhr.responseText

          if (isJSON) {
            json_data = JSON.parse(text_data)
            callback(json_data)
          }
          else {
            callback(text_data)
          }
        }
        catch(error) {
        }
      }
    }
  }

  xhr.send()
}

// -----------------------------------------------------------------------------

var resolve_url = function(url) {
  if (!url)
    return null

  if (url.substr(0,4).toLowerCase() === 'http')
    return url

  var loc = unsafeWindow.location

  if (url.substr(0,2) === '//')
    return loc.protocol + url

  if (url.substr(0,1) === '/')
    return loc.protocol + '//' + loc.hostname + url

  return null
}

// -----------------------------------------------------------------------------

var make_element = function(elementName, innerContent, isText) {
  var el = unsafeWindow.document.createElement(elementName)

  if (innerContent) {
    if (isText)
      el.innerText = innerContent
    else
      el.innerHTML = innerContent
  }

  return el
}

// ----------------------------------------------------------------------------- URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url = function(video_url, vtt_url, referer_url, force_http, force_https) {
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.force_https

  var encoded_video_url, encoded_vtt_url, encoded_referer_url, webcast_reloaded_base, webcast_reloaded_url

  encoded_video_url     = encodeURIComponent(encodeURIComponent(btoa(video_url)))
  encoded_vtt_url       = vtt_url ? encodeURIComponent(encodeURIComponent(btoa(vtt_url))) : null
  referer_url           = referer_url ? referer_url : unsafeWindow.location.href
  encoded_referer_url   = encodeURIComponent(encodeURIComponent(btoa(referer_url)))

  webcast_reloaded_base = {
    "https": "https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html",
    "http":  "http://webcast-reloaded.surge.sh/index.html"
  }

  webcast_reloaded_base = (force_http)
                            ? webcast_reloaded_base.http
                            : (force_https)
                               ? webcast_reloaded_base.https
                               : (video_url.toLowerCase().indexOf('http:') === 0)
                                  ? webcast_reloaded_base.http
                                  : webcast_reloaded_base.https

  webcast_reloaded_url  = webcast_reloaded_base + '#/watch/' + encoded_video_url + (encoded_vtt_url ? ('/subtitle/' + encoded_vtt_url) : '') + '/referer/' + encoded_referer_url
  return webcast_reloaded_url
}

// ----------------------------------------------------------------------------- URL redirect

var redirect_to_url = function(url) {
  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if (typeof GM_resolveUrl === 'function')
      url = GM_resolveUrl(url, unsafeWindow.location.href)

    GM_loadUrl(url, 'Referer', unsafeWindow.location.href)
  }
  else {
    try {
      unsafeWindow.top.location = url
    }
    catch(e) {
      unsafeWindow.window.location = url
    }
  }
}

var process_video_url = function(video_url, video_type, vtt_url, referer_url) {
  if (!referer_url)
    referer_url = unsafeWindow.location.href

  if (typeof GM_startIntent === 'function') {
    // running in Android-WebMonkey: open Intent chooser

    var args = [
      /* action = */ 'android.intent.action.VIEW',
      /* data   = */ video_url,
      /* type   = */ video_type
    ]

    // extras:
    if (vtt_url) {
      args.push('textUrl')
      args.push(vtt_url)
    }
    if (referer_url) {
      args.push('referUrl')
      args.push(referer_url)
    }

    GM_startIntent.apply(this, args)
    return true
  }
  else if (user_options.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website

    redirect_to_url(get_webcast_reloaded_url(video_url, vtt_url, referer_url))
    return true
  }
  else {
    return false
  }
}

var process_hls_url = function(hls_url, vtt_url, referer_url) {
  process_video_url(/* video_url= */ hls_url, /* video_type= */ 'application/x-mpegurl', vtt_url, referer_url)
}

var process_dash_url = function(dash_url, vtt_url, referer_url) {
  process_video_url(/* video_url= */ dash_url, /* video_type= */ 'application/dash+xml', vtt_url, referer_url)
}

// ----------------------------------------------------------------------------- process video for current channel

var obtain_live_audiostream_url = function(channel_id) {
  var api_url, callback

  api_url = 'https://opml.radiotime.com/Tune.ashx?id=' + channel_id + '&render=json&listenId=&itemToken=&formats=mp3,aac,ogg,hls&type=station&itemUrlScheme=secure&mode=embed&partnerId=qZjjnm85'

  callback = function(json_data) {
    try {
      var hls_url

      if ((json_data.head.status === '200') && json_data.body.length && json_data.body[0].url) {
        hls_url = json_data.body[0].url
        hls_url = hls_url.replace(/\?.*$/, '')

        process_hls_url(hls_url)
      }
    }
    catch(e) {}
  }

  download_url(api_url, null, callback, true)
}

var update_live_audiostream_DOM = function() {
  var body, style

  body  = unsafeWindow.document.body
  style = make_element('style', '.overlay.openOverlay {display:none;}', true)

  body.appendChild(style)
}

var process_embedded_player = function() {
  var pathname, regex, is_embedded_player, channel_id

  pathname           = unsafeWindow.location.pathname
  regex              = new RegExp('^/embed/player/([^/]+)/?.*$', 'i')
  is_embedded_player = regex.test(pathname)

  if (is_embedded_player) {
    channel_id       = pathname.replace(regex, '$1')

    obtain_live_audiostream_url(channel_id)
    update_live_audiostream_DOM()
  }
}

// ----------------------------------------------------------------------------- display index of channels

var redirect_to_embedded_player = function() {
  var meta, url

  meta = unsafeWindow.document.querySelector('meta[name="twitter:player"][content]')
  if (!meta) return false

  url = meta.getAttribute('content')
  url = resolve_url(url)
  redirect_to_url(url)
  return true
}

// ----------------------------------------------------------------------------- bootstrap

var init = function() {
  redirect_to_embedded_player() || process_embedded_player()
}

init()

// -----------------------------------------------------------------------------
