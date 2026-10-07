# Face Projection Remote (laptop sketch + iPad controller)

The sketch (webcam, face tracking, canvas) runs on your **laptop**.
All the buttons and sliders live on your **iPad**.
A tiny Node server on the laptop passes messages between them.

```
iPad  controller.html  --(Wi-Fi)-->  server.js (laptop)  -->  sketch.html (laptop)
                       <------------------ state ------------------
```

## Setup (one time)

1. **Install Node.js** (version 18 or newer) from https://nodejs.org. Check it worked:
   `node --version`
2. **Get the code** onto the laptop (clone this repo and check out the branch).
3. **Install the one dependency.** In a terminal:
   ```
   cd MediaTecture/remote
   npm install
   ```

## Every time you use it

1. **Put the laptop and iPad on the same Wi-Fi network.**
   (Guest or "client isolation" networks often block device-to-device traffic. A phone hotspot works as a fallback.)
2. **Start the server** on the laptop:
   ```
   cd MediaTecture/remote
   npm start
   ```
   It prints two addresses, for example:
   ```
   On the laptop (the sketch):   http://localhost:3000/sketch
   On the iPad (the controller): http://192.168.1.23:3000/controller
   ```
3. **Open the sketch on the laptop** in Chrome (or Edge/Firefox): `http://localhost:3000/sketch`.
   Use `localhost`, not the Wi-Fi address, so the browser allows the webcam. Click **Allow** for the camera.
   The right-hand side of the page also shows the controller address.
4. **Open the controller on the iPad** in Safari by typing the iPad address the server printed
   (the one ending in `/controller`).
   The top line should say **Connected to the sketch**.
5. Use the iPad. Everything you tap changes the sketch on the laptop right away, and the iPad
   always shows the real state (which features are on, the people count, the camera list).

Tip: on the iPad, tap Share > **Add to Home Screen** for a full-screen controller.

## Things you can do from the iPad

- Pick the camera (built-in or external webcam) from the dropdown at the top.
- **Randomize** and **Shuffle Features** (also shuffles by itself when people enter or leave the frame).
- Turn features on and off, **Full View**, **Labels**, inside/outside **Monochrome** and **Duotone**.
- **Box Size** (for the feature you touched last) and **Zoom** sliders.

On the laptop you can still press the left/right arrow keys or space to jump between features.
A fullscreen browser window (F11, or Cmd+Ctrl+F on a Mac) works well for showing the sketch.

## Troubleshooting

- **iPad says "Not connected to the server"**: the iPad can't reach the laptop. Check both are on the same
  Wi-Fi, and re-type the address exactly as the server printed it. If a firewall prompt appeared on the laptop
  when you started the server, choose **Allow**. On Windows, allow Node.js on "Private networks".
- **iPad says "Waiting for the sketch page..."**: open `http://localhost:3000/sketch` on the laptop.
- **The server printed no address**: the laptop isn't on a network. Connect to Wi-Fi and restart the server.
- **Port 3000 already in use**: start it on another port, e.g. `PORT=3001 npm start`
  (Windows PowerShell: `$env:PORT=3001; npm start`), and use that number in the addresses.
- **Sketch page shows a red bar**: the p5/ml5 libraries couldn't load. The laptop needs internet for those
  (and for the face-tracking model).
- **No camera picture**: make sure you opened the sketch through `localhost` and clicked Allow. Browsers block
  the camera on plain `http://<ip-address>` pages.
- To stop the server, press `Ctrl+C` in its terminal.

## Files

- `server.js` - the relay (serves the two pages and passes messages)
- `sketch.html` - the sketch: webcam, tracking, canvas, preview. No buttons.
- `controller.html` - the buttons and sliders (a p5.js page for the iPad)
- `index.html` - a plain page with links to both
- `package.json` - lists the one dependency (`ws`)
