# ASU Canvas Helper

A helper to fix video player issues of [ASU Canvas](https://asuce.instructure.com/) (the website to take ASU online courses)

[See discussions on r/ASU](https://www.reddit.com/r/ASU/comments/ukvuai/i_wrote_a_plugin_to_fix_the_damn_canvas/)

## Features
1. Correct the video player size
2. Convert pdf caption to srt caption
3. And turn the caption on by default
4. Provide a download button to download both the caption and the video with appropriate filenames
5. Pass keypress from Canvas to the video player, so you can use keyboard shortcuts immediately, without the need of clicking to focus the video player at first
6. Supported youtube style keyboard shortcuts

## Keyboard Shortcuts
| Action                | Key         |
| --------------------- | ----------- |
| Play/Pause            | k           |
| Rewind 5s             | j           |
| Forward 5s            | l           |
| Decrease Speed        | < (SHIFT+,) |
| Increase Speed        | > (SHIFT+.) |
| Prev Video            | P (SHIFT+p) |
| Next Video            | N (SHIFT+n) |
| Fullscreen            | f           |
| Toggle Mute           | m           |
| Decrease Volumn       | ↓           |
| Increase Volumn       | ↑           |
| Toggle Caption        | c           |
| Decrease Caption Size | - or _      |
| Increase Caption Size | + or =      |

## Usage (TLDR)
1. Install [Tampermonkey Plugin](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) for Chrome 
2. Go to [Greasyfork](https://greasyfork.org/en/scripts/444645-asu-canvas-helper) and install the script

## Usage (For Dummies)
Assumed that you're using chrome and know what's ASU Canvas (the website u take your ASU online courses)

1. Install Tampermonkey: **[Click this to open the link](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)**, then hit **"Add to Chrome"** -> **"Add Extension"**

2. Install ASU Canvas Helper: **[Click this to open the link](https://greasyfork.org/en/scripts/444645-asu-canvas-helper)**, then hit **"Install this script"** -> **"Install"**

3. Go to your ASU course link and log in, for example [this course](https://asuce.instructure.com/courses/2567/pages/2-dot-3-leftmost-and-rightmost-derivations?module_item_id=126914), then a tab will popup warning **"A userscript wants to access a cross-origin resource."**, click **"Always allow domain"** button in the bottom-left corner. Then chrome will jump back to the course tab. 
> The warning is due to the domain of the video is different than the domain of the web page, thus downloading the video would make a cross domain request. It's safe to allow it.)

4. Under the video, there will have a new button "Download All", hit that button to download both video and subtitle (the download progress might not immediately show up, just keep waiting until both files are downloaded, and the "Download All" button will become "Finished!"

5. Play the online video or downloaded video, enjoy !

## Story
Having just joined the ASU online Master of CS program, I found that its online course system -- the Canvas, is buggy and hard to use:

1. The video player size is too small, you have to fullscreen it to watch.

2. Some video is in India accent, it's a little difficult for someone who's not been exposed to India accent a lot to follow what the video speaks. I have to turn on captions.

3. But the caption is always broken, you can't turn it on since the link to the caption is dead.

4. Sometimes there're captions in pdf format for downloading which is very weird. And availability is not guaranteed.

5. If no caption pdf is provided, I have to turn on Live Caption in Chrome. But when I fullscreen the player, it'll block the live caption.

So I dig into source code of the website and write a script that helps with these player issues. It's been tested on [these courses](https://courses.cpe.asu.edu/browse/mcs).

## Development Setup
I use combinations of *VScode*(with nvim plugin), *Tampermonkey*, *Greasyfork*, *Chrome*, *entr*, *chrome-cli* on *MacOS* to develop the script.

1. In Chrome, Go to Settings -> Extensions -> Tampermonkey -> Details -> Allow access to file URLs, and turn it on
2. In Tampermonkey, create a new script and delete the template content
3. Clone the repo, copy only the userscript headers from helper.user.js into Tampermonkey's editor, then copy below line into the headers in Tampermonkey editor. 
> `// @require file://<absolute path to the cloned repo folder>/helper.user.js`
4. Install *entr* and *chrome-cli* by `brew install entr; brew install chrome-cli`
4. Open an ASU online course link, make sure Chrome only have a single window and the course tab is active
5. Find the tab's ID by running `chrome-cli info`
6. Cd to the repo folder, run `ls *.js | entr zsh -c 'chrome-cli reload -t <tabId>'`
7. Do your edit to helper.user.js with any IDE, the course tab will refresh on every save of the script, and test your work in the course tab.
8. To debug player state, *opt+cmd+i* to open devtools, *shift+cmd+c* and click on the video player (to make iframe context available in devtools console), then paste below code to get the player instance
```js
function getReactFiber(selector) {
    const dom = document.querySelector(selector)
    const key = Object.keys(dom).find(key=>{
        return key.startsWith("__reactFiber$") // react 17+
            || key.startsWith("__reactInternalInstance$"); // react <17
    });
    return dom[key]
}
player = getReactFiber('div.MediaPlayer').child.ref.current.plyr
```

## To-Do List
- [ ] Save Caption Size setting for next video
- [ ] Fix Toggle Caption shortcut (not properly working)
- [ ] Fix Volumn UP/DOWN shortcut (not properly working)
- [ ] Draw an icon. e.g. A devil stabs a big hole on a canvas from behind.
- [ ] Make a comparison video showing the difference before/after applying this userscript
- [ ] Add an 'Install Script' button to this landing page, similar to the Greasyfork one
- [ ] Github action to autoly publish the script to Greasyfork on git push