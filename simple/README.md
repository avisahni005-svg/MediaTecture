# Face Projection: laptop sketch + iPad controller (no installs)

Two web pages that talk to each other directly over the internet (using PeerJS):

- `sketch.html` runs on the **laptop**: webcam, face tracking, and the big canvas. The page shows nothing else (no text, no QR code).
- `controller.html` runs on the **iPad**: the small camera preview, all the buttons and sliders.

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
   Only the big canvas is shown, and it fills the whole window in any shape (wide, tall, or square), even if you
   resize the window. (Press F11, or Cmd+Ctrl+F on a Mac, for full screen.)
2. On the **iPad**, open the controller address in Safari.
3. The top line on the iPad says **Connected to the sketch**, the small camera preview appears, and
   everything you tap now changes the laptop.

The two pages find each other with a built-in pairing code, so there is nothing to type. If you want to keep
other people from connecting, add your own secret word to the end of both addresses, the same on both:

- Laptop: `.../simple/sketch.html#mysecretword`
- iPad: `.../simple/controller.html#mysecretword`

## Body Trace

The **Body Trace** button (top of the right column on the iPad) turns the laptop picture into a mosaic of tiles that
fills your outline. The feature buttons choose what the tiles show: with only Right Eye on, every tile is a right eye;
with Right Eye and Nose on, the tiles are a random mix of the two; with none on, all six features are mixed.
The first time you press it the body model has to download, so the button says "loading model..." for a few seconds
and the laptop shows the normal camera until the outline is ready. The zoom slider and the inside filters apply to the
tiles too. When you are small in the frame, the body model is automatically zoomed in on you (it finds you from your
face), so the outline stays accurate from further away.

**Screen Trace** (next to Body Trace) uses the same mosaic but fills the whole screen instead of only your outline.
It needs no body model, so it starts instantly. Only one of the two can be on at a time, and the Tile Size slider
works for both.

## Arms, legs, hands and fingers

Besides the six face features there are now **Left/Right Hand**, **Left/Right Arm**, **Left/Right Leg** and **Fingers**
(the ten fingertips). They work exactly like the face features: boxes, Full View, the sliders, filters and the mosaic
(Body Trace and Screen Trace). They use two extra models (pose and hands) that only download and run while a feature
or Body Trace needs them, and the iPad shows "loading pose + hands model..." the first time. Body Trace also uses them
to make the outline follow your arms, legs, hands and fingers more closely. These models make the sketch heavier, so on
a slower laptop switch them off (turn those buttons off) when you do not need them.

## If something goes wrong

- **"Can't find the sketch"** on the iPad: the laptop page isn't open yet, or the two addresses use different secret words.
- **Stuck on "Connecting..."**: some Wi-Fi networks (school or office ones) block the direct link. Try a phone hotspot.
- **Red bar at the top of the laptop page**: a library didn't load. Check the internet connection. (The bar only appears when something is wrong.)
- **No camera picture**: make sure you opened the `https://` address (not a file on disk) and clicked Allow.
- **The page looks old after you change something**: do a hard refresh (Cmd+Shift+R on a Mac).
