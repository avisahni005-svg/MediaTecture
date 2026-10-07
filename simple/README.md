# Face Projection: laptop sketch + iPad controller (no installs)

Two web pages that talk to each other directly over the internet (using PeerJS):

- `sketch.html` runs on the **laptop**: webcam, face tracking, the big canvas. It shows a 4-letter **pairing code** and a QR code.
- `controller.html` runs on the **iPad**: all the buttons and sliders.

You do not install anything and you do not use the terminal. The pages just need to be hosted on a web address
(step 1), and both devices need internet.

## Step 1: put the pages online (one time, about 3 minutes)

This uses GitHub Pages, which is free for public repositories.

1. Go to your repository on github.com: `avisahni005-svg/mediatecture`.
2. Click **Settings** (top row of tabs).
3. In the left sidebar click **Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
5. Under **Branch**, pick `claude/p5js-eye-tracking-square-qkv1h8` and leave the folder as `/ (root)`. Click **Save**.
6. Wait 1-2 minutes and refresh the page. A box at the top says **Your site is live at ...**
   It will look like `https://avisahni005-svg.github.io/mediatecture/`.

Your two pages are then:

- Laptop: `https://avisahni005-svg.github.io/mediatecture/simple/sketch.html`
- iPad: `https://avisahni005-svg.github.io/mediatecture/simple/controller.html`

(If Settings shows no Pages option, or says Pages needs a paid plan, the repository is private. Make it public
under Settings > General > Danger Zone > Change visibility, or tell Claude and we will use another host.)

## Step 2: every time you use it

1. On the **laptop**, open the sketch address in Chrome. Click **Allow** when it asks for the camera.
   The right side of the page shows a **4-letter code** and a **QR code**.
2. On the **iPad**, either:
   - point the iPad camera at the QR code on the laptop screen and tap the link that appears, or
   - open the controller address in Safari, type the 4-letter code, and tap **Connect**.
3. The top line on the iPad turns to **Connected to the sketch**. Everything you tap now changes the laptop.

The code stays the same when you refresh the laptop page, and the iPad remembers it, so next time you can
just open the controller address.

## If something goes wrong

- **"Can't find a sketch with code ..."**: the laptop page isn't open, or the code was typed wrong.
- **Stuck on "Connecting..."**: some Wi-Fi networks (school or office ones) block the direct link. Try a phone hotspot.
- **Red bar at the top of the laptop page**: a library didn't load. Check the internet connection.
- **No camera picture**: make sure you opened the `https://` address (not a file on disk) and clicked Allow.
- **The page looks old after you change something**: do a hard refresh (Cmd+Shift+R on a Mac).
