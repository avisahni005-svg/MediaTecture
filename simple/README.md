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

## If something goes wrong

- **"Can't find the sketch"** on the iPad: the laptop page isn't open yet, or the two addresses use different secret words.
- **Stuck on "Connecting..."**: some Wi-Fi networks (school or office ones) block the direct link. Try a phone hotspot.
- **Red bar at the top of the laptop page**: a library didn't load. Check the internet connection. (The bar only appears when something is wrong.)
- **No camera picture**: make sure you opened the `https://` address (not a file on disk) and clicked Allow.
- **The page looks old after you change something**: do a hard refresh (Cmd+Shift+R on a Mac).
