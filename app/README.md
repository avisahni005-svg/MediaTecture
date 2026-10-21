# Face Projection (Mac app)

A downloadable Mac app that runs the face projection sketch and lets you:

- send the picture to **any screen** (a projector, a second monitor, a TV),
- send it into **MadMapper** (through Syphon),
- use **any device as the camera** (phone, tablet, another laptop),
- use **any device as the control panel** (iPad, phone, another laptop).

## Get the app (no terminal needed)

The app is built for you by GitHub.

1. On github.com open your repository, then the **Actions** tab.
2. In the list on the left click **Build Mac app**, then the **Run workflow** button (right side), then the green **Run workflow**.
3. Wait about 5-10 minutes until the run has a green tick.
4. Go to the repository's main page and click **Releases** (right side). Open **Face Projection app (latest build)**.
5. Download the right file:
   - **-arm64.dmg**: Macs with an M1, M2, M3 or M4 chip (most Macs since 2020)
   - **-x64.dmg**: older Intel Macs
   (Not sure? Apple menu > About This Mac. "Chip: Apple M..." means arm64.)
6. Open the downloaded file and drag **Face Projection** into **Applications**.

### First time you open it
The app is not signed with an Apple developer account, so macOS is cautious the first time:
- Try **right-click** (or Control-click) the app in Applications, choose **Open**, then click **Open** again.
- On newer macOS versions (Sequoia and later) that may not offer Open. Then open the app once, close the warning,
  go to **System Settings > Privacy & Security**, scroll down and click **Open Anyway** next to Face Projection.
- If it says the app is **damaged**, open Terminal once and run these two lines (use Cancel on the warning, not Move to Trash):
  ```
  xattr -cr "/Applications/Face Projection.app"
  codesign --force --deep --sign - "/Applications/Face Projection.app"
  ```
When it asks for camera access, click **OK**.

## Using it

The app opens two windows:

- **The output** is a normal window: drag it, resize it from its edges, or minimize it with the yellow button. By default it opens on
  your second screen if you have one, otherwise your main screen, and it remembers its size and place for next time.
  For a projector or TV, drag it there and turn **Full screen** on (the green button works too). Esc or Cmd+F leaves full screen.
- **The control window** (this is where you set things up). Reopen it any time from the menu: Output > Show Control Window (Cmd+1).
  Bring back the output window with Output > Show Output Window (Cmd+2).

### Any screen as the main display
In the control window, pick the screen in **OUTPUT SCREEN** (the window moves there), or just drag the window yourself.
Turn on **Full screen** to fill that screen.

### MadMapper
1. In the control window turn on **Send to MadMapper**.
2. In MadMapper add a **Syphon** input and choose **Face Projection**.

What MadMapper receives is exactly what the output window shows, at that window's size, so resize the output window to the
size you want in MadMapper (or use full screen). Keep the output window open and not minimized while MadMapper is using it:
a minimized window may stop sending new pictures.
If the colours look wrong tick **Swap red and blue**; if the picture is upside down tick or untick **Flip vertically**.
This app is for Mac only.

### Any device as the control panel
In the control window, scan the **CONTROL PANEL** QR code with a phone or iPad (or open the link under it on any
computer). All the buttons and sliders appear on that device. You can have several at once.
**Open control panel in this app** shows the same panel on this computer.

### Any device as the camera
On the device you want as the camera, scan the **CAMERA** QR code (or open the link under it), and allow the camera.
The app switches to that camera by itself. Choose between cameras (this computer's, or the connected devices) from the
camera list on the control panel. On a phone, **Flip camera** swaps front and back. If the device disconnects, the app
goes back to this computer's camera.

The QR codes open pages hosted on GitHub Pages (the same ones as before, turned on in your repository settings),
so the phone or iPad and this Mac both need internet. They connect straight to each other.

## If something does not work

- **The QR code opens a "404" page:** GitHub Pages is not turned on. Repository Settings > Pages > Deploy from a branch > pick
  the branch > Save. Or change the address under **ADVANCED** in the control window.
- **The control panel / camera never connects:** some networks (school, office) block devices talking to each other. Try a
  phone hotspot. Make sure the code on the device matches the one in the control window.
- **No camera picture on this Mac:** System Settings > Privacy & Security > Camera > turn **Face Projection** on, then reopen.
- **Body Trace is slow:** it runs several models at once. Turn it off when you don't need it, or use a faster Mac.
- **Output is on the wrong screen:** choose another one under **OUTPUT SCREEN**.

## For developers

```
cd app
npm install
npm start            # runs the app (needs internet the first time to fetch ml5)
npm run dist:mac     # builds the .dmg files into app/dist (on a Mac)
```
The sketch and control pages are not copied by hand: `scripts/prepare.js` takes `../simple/sketch.html` and
`../simple/controller.html`, points them at local copies of p5, ml5 and PeerJS, and writes them to `renderer/`. So the browser version and the
app always run the same code.
`npx electron --no-sandbox test/smoke.js <folder>` (under xvfb on Linux) starts the app, and saves screenshots and a report.
