// ==UserScript==
// @name         ASU Canvas Helper
// @version      1.1
// @description  1. fix video player size issue; 2. fix caption missing; 3. turn on caption by default; 4. add a button for downloading both video and caption with proper filenames
// @author       Nendo
// @homepage     https://nendo.dev
// @license MIT
// @match https://asuce.instructure.com/courses/*
// @match https://mediaplus.asu.edu/lti/*
// @grant GM_download
// @grant GM.xmlHttpRequest
// @grant unsafeWindow
// @require https://greasyfork.org/scripts/444680-my-waitforkeyelements/code/my-waitForKeyElements.js?version=1048347
// @require https://cdn.jsdelivr.net/npm/pdfjs-dist@2.13.216/build/pdf.min.js
// @namespace https://greasyfork.org/users/910724
// ==/UserScript==

// Warning: download made by GM_download won't show download progress, you might have to wait for video download while not knowing its progress

// convert srt text to cues
// copied from https://bl.ocks.org/denilsonsa/aeb06c662cf98e29c379
// note that there's a bug with the code in the link, 
// where parseTS might output 0, which should be a valid timestamp.
// however the condition of (start && end) will be false if a valid timestamp of 0 is present,
// since javascript treat both null and 0 as falsy value.
function parseTS(s) {
  var match = s.match(/^(?:([0-9]+):)?([0-5][0-9]):([0-5][0-9](?:[.,][0-9]{0,3})?)/);
  if (match == null) {
    throw 'Invalid timestamp format: ' + s;
  }
  var hours = parseInt(match[1] || "0", 10);
  var minutes = parseInt(match[2], 10);
  var seconds = parseFloat(match[3].replace(',', '.'));
  return seconds + 60 * minutes + 60 * 60 * hours;
}

function parseSrt(vtt) {
  var lines = vtt.replace('\r\n', '\n').split('\n').map(function (line) {
    return line.trim();
  });
  var cues = [];
  var start = null;
  var end = null;
  var payload = null;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('-->') >= 0) {
      var splitted = lines[i].split(/[ \t]+-->[ \t]+/);
      if (splitted.length != 2) {
        throw 'Error when splitting "-->": ' + lines[i];
      }
      start = parseTS(splitted[0]);
      end = parseTS(splitted[1]);
    } else if (lines[i] == '') {
      if (start !== null && end !== null) {
        var cue = new VTTCue(start, end, payload || '');
        cues.push(cue);
        start = null;
        end = null;
        payload = null;
      }
    } else if (start !== null && end !== null) {
      if (payload == null) {
        payload = lines[i];
      } else {
        payload += '\n' + lines[i];
      }
    }
  }
  if (start !== null && end !== null) {
    var _cue = new VTTCue(start, end, payload);
    cues.push(_cue);
  }
  return cues;
}

// fetch pdf and convert it to srt text
function getSrt(capUrl) {
  return _req({ url: capUrl, responseType: 'blob' })
    .then(resp => {
      const blob = resp.response
      const blobUrl = window.URL.createObjectURL(blob)
      return blobUrl
    })
    .then(url => _pdf.getDocument(url).promise)
    .then(async (doc) => {
      const numPages = doc.numPages
      let srt = ''
      for (let p = 1; p <= numPages; p++) {
        const page = await doc.getPage(p)
        const content = await page.getTextContent()
        srt += content.items.reduce((prev, curr) => {
          if (!isNaN(curr.str) && curr.str !== '' && curr.str !== '0') {
            curr.str = '\n' + curr.str
          }
          if (curr.hasEOL) {
            curr.str += '\n'
          }
          return prev + curr.str
        }, '') + '\n'
      }
      return srt
    })
}

// find the entry point for accessing react state
function getReactFiber(selector) {
  const dom = document.querySelector(selector)
  const key = Object.keys(dom).find(key => {
    return key.startsWith("__reactFiber$") // react 17+
      || key.startsWith("__reactInternalInstance$"); // react <17
  });
  return dom[key]
}

function main() {
  // expose CORS-ignored download/fetch functions and pdfjs functions to global 
  // to make them available in browser context
  unsafeWindow._dl = GM_download
  unsafeWindow._req = GM.xmlHttpRequest
  unsafeWindow._pdf = pdfjsLib
  // add this line below to make pdfjs works in browser context
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@2.13.216/build/pdf.worker.min.js"  

  // When runs in canvas page
  if (document.URL.startsWith('https://asuce.instructure.com/courses/')) {
    // give iframe the correct size and ratio
    waitForKeyElements('iframe[allowfullscreen]', function (iframe) {
      const iframeBox = iframe.parentNode

      Object.assign(iframeBox.style, {
        position: 'relative',
        margin: 0,
        height: 0,
        paddingTop: '56.25%'
      })
      Object.assign(iframe.style, {
        position: 'absolute',
        width: '100%',
        height: '100%',
        top: 0
      })
    })  

    // retrieve caption, and make a download button if both caption url and video url are available
    waitForKeyElements('span.instructure_file_link_holder', function (capBox) {
      const capTitle = capBox.querySelector('a:nth-child(1)').title
      const capUrl = capBox.querySelector('a:nth-child(2)').href
      const iframe = document.querySelector('iframe[allowfullscreen]')
      const savedName = capTitle.slice(11, 24)

      getSrt(capUrl)
        .then( srt => iframe && iframe.contentWindow.postMessage({ name: 'srt', value: srt }, '*') )

      const dlBtn = document.createElement("button")
      dlBtn.innerText = "Loading..."
      dlBtn.disabled = true
      capBox.appendChild(dlBtn)

      // when received vidUrl from iframe, enable dlBtn
      window.onmessage = (e) => {
        if (e.data && e.data.name === 'vidUrl') {
          const vidUrl = e.data.value
          dlBtn.innerText = "Download All"
          dlBtn.disabled = false
          dlBtn.onclick = () => {
            dlBtn.innerText = "Downloading..."
            dlBtn.disabled = true

            let vidFin = false
            let capFin = false
            const isFin = () => {
              if (vidFin && capFin) {
                dlBtn.innerText = "Finished!"
                dlBtn.disabled = false
              }
            }
            const handleErr = () => {
              dlBtn.innerText = "Error!"
              dlBtn.disabled = false
            }

            _dl({ url: vidUrl, name: savedName + '.mp4', onload: () => { vidFin = true; isFin() }, onerror: handleErr }) // use GM_download to set the filename, since <a download='filename'> do not work

            getSrt(capUrl)
              .then(srt => {
                // check if srt is valid
                if (parseSrt(srt).length === 0) {
                  capFin = true
                  throw "Caption Not Found!\nYou can instead turn on Live Caption in Chrome!"
                } else {
                  return srt
                }
              })
              .then(srt => 'data:text/plain;charset=utf-8,' + encodeURIComponent(srt))
              .then(uri => _dl({ url: uri, name: savedName + '.srt', onload: () => { capFin = true; isFin() }, onerror: handleErr }))
              .catch(err => alert(err))
          }
        }
      }
    })
  // When runs in iframe page
  } else if (document.URL.startsWith('https://mediaplus.asu.edu/lti/')) {

    waitForKeyElements("video > source", function (elem) {
      // make video player fully fill in the iframe box
      document.querySelector('div.MediaPlayerPageContainer').style.padding = 0
      document.querySelector('div.MediaPlayerFlex').style.maxWidth = 'none'
      // send video url to canvas page for the creation of download button
      const vidUrl = elem.src
      window.parent.postMessage({ name: 'vidUrl', value: vidUrl }, '*')
    })

    // receive caption text from canvas page, 
    window.onmessage = (e) => {
      if (e.data && e.data.name === 'srt') {
        const srt = e.data.value
        waitForKeyElements("video", function (elem) {
          console.log('video detected')
          // convert caption text to cues
          elem.querySelector('track').remove()
          const track = elem.addTextTrack('captions', 'Captions', '')
          track.mode = "hidden"
          const cues = parseSrt(srt)

          // if caption is valid
          if (cues.length !== 0) {
            // add caption to the track
            cues.forEach(cue => track.addCue(cue))
  
            // fix the first line caption missing bug (since cuechange event won't be tiggered for the first line caption)
            const capBox = document.querySelector('div.plyr__captions')
            const cap = document.createElement('span')
            cap.classList.add('plyr__caption')
            cap.innerHTML = track.cues[0].text
            capBox.appendChild(cap)
            
            // show the caption by default, through changing the caption states of plyr (a video playback control library)
            capBox.style.display = 'block'
            const fiber = getReactFiber('div.MediaPlayer')
            if (fiber) {
              console.log(fiber.child.ref.current.plyr.captions)
              fiber.child.ref.current.plyr.captions.currentTrack = 0
              fiber.child.ref.current.plyr.captions.active = true
              setTimeout(() => { fiber.child.ref.current.plyr.captions.toggled = true }, 0)
            }
          }
        })
      }
    }
  }
}

main()