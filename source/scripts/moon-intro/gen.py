"""Moon intro: keyframes (Nano Banana Pro via fal) -> Kling v3 image-to-video -> mp4.
Run: <rashid>/.venv/bin/python gen.py sheet | frames NAME... | video NAME... | all
Raw output goes to $MOON_OUT (default ./out). Keys from ../rashid/.env, never printed."""
import os, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import fal_client, requests
from dotenv import load_dotenv

load_dotenv(Path("/Users/mac/Desktop/magic/rashid/.env"))
OUT = Path(os.environ.get("MOON_OUT", Path(__file__).resolve().parent / "out"))
OUT.mkdir(parents=True, exist_ok=True)

LOOK = ("Premium 3D animated feature film look (Pixar / DreamWorks quality), soft cinematic lighting, rich but gentle colours, "
        "navy and teal with warm orange accents, kid-friendly, wide 16:9 frame, the main subject centred so it survives a vertical crop, "
        "clean shapes, no text, no letters, no numbers, no logos, no watermark.")
TOBISH = ("Tobish: the same character as in image 1 (character sheet) - same face, short dark messy hair, big warm brown eyes, friendly smile, "
          "light tan skin. ")
SUIT = ("white spacesuit with orange and blue accents, a small round generic space-agency patch on the chest (no letters), orange gloves and boots. ")

SHEET = ("Character design sheet on a plain soft grey background: on the left Tobish as a 10-year-old boy in blue pyjamas with little stars, "
         "on the right the same person as a 24-year-old young man, same face and same short dark messy hair, big warm brown eyes, kind friendly "
         "smile, light tan skin, wearing a " + SUIT + "full body, front view, both standing, 3D animated film style, Pixar quality, no text. wide 16:9.")

FRAMES = {
 "a_room": TOBISH + "Scene: a cozy dark bedroom at night. The 10-year-old boy sits on the floor in blue star pyjamas, seen from the front, "
     "watching an old retro TV in front of him; the TV shows a rocket launching with fire and smoke; the blue-white TV glow lights his face "
     "and his eyes are wide with wonder. A window with a starry night sky behind, toy rocket and globe on a shelf. Boy and TV centred. " + LOOK,
 "b1_study": TOBISH + "Scene: the boy aged about 12 studies at a wooden desk at night, warm desk lamp light, stacks of books, a notebook, glasses on, "
     "glowing blue formulas as abstract symbols and little planets floating in the air around him, starry window behind. Seen from the front, centred. " + LOOK,
 "b2_study": TOBISH + "Scene: the same person now aged about 17, taller, studies at the same wooden desk at night, warm desk lamp, many more tall stacks of books, "
     "a model rocket and a star map pinned on the wall, glowing abstract formulas and planets floating around him, determined smile, window with stars. Seen from the front, centred. " + LOOK,
 "c_grad": TOBISH + "Scene: Tobish at 24 years old, proud, wearing a " + SUIT + "holding his white helmet under one arm, standing on a stage at golden hour, "
     "colourful confetti falling, soft sun rays, blurred cheering crowd and bunting in the background, big happy smile. Centred. " + LOOK,
 "d_pad": "Scene: a rocket launch pad at dawn, a tall white rocket with a red nose cone and orange and blue stripes standing upright on the pad "
     "beside a service tower, steam venting at its base, pink and orange sunrise sky, calm and majestic, rocket exactly in the centre of the frame, "
     "full rocket visible with sky above. The rocket matches the cute design in image 1's style only; no character needed. " + LOOK,
 "e_lift": "Image 1 is the rocket on the pad. Same rocket, same pad, same dawn sky. Now the engines are ignited: huge bright orange flames and billowing "
     "white smoke clouds spread at the base and the rocket has just lifted off, rising slowly, epic and exciting, rocket centred. " + LOOK,
 "f1_earth": "Image 1 is the rocket. Same rocket design. Scene in space: the white rocket with red nose flies upward through space, tiny engine flame, "
     "a huge beautiful blue Earth curves in the lower background glowing with a thin atmosphere, a small grey Moon far away ahead in the upper area, "
     "stars, rocket centred, seen from behind and slightly from the side. " + LOOK,
 "f2_moon": "Image 1 is the rocket in space. Same rocket, same style. Now the rocket has travelled far: a big detailed grey Moon with craters fills the "
     "upper background ahead of it, Earth is now a small blue ball in the lower corner, stars, rocket centred, engine flame glowing. " + LOOK,
 "g_cockpit": TOBISH + "Scene: inside a spaceship cockpit, Tobish at 24 in his white orange-blue spacesuit and helmet with the visor open, seated and gripping the controls "
     "with both hands, worried and determined, red emergency alarm lights flashing, sparks flying from a console, small warning panels with abstract symbols (no text), "
     "through the round window the Moon in the dark sky. Face visible, centred. " + LOOK,
 "h1_fall": "Image 1 is the rocket. Same rocket design. The rocket tilted and tumbling out of control, trailing smoke and sparks and a flicker of flame, falling toward "
     "a grey cratered lunar surface below, Earth small in the black starry sky, dramatic but not scary, centred. " + LOOK,
 "h2_crash": "Image 1 is the rocket. Same rocket design. The moment after crashing: the rocket lies on its side half-buried on the grey cratered lunar surface, "
     "a big soft cloud of grey-beige moon dust billowing around it, small debris in the air, black starry sky with Earth, centred. " + LOOK,
 "i_alone": TOBISH + "Scene: a quiet moment on the Moon. Tobish in his white orange-blue spacesuit with helmet on stands small and alone next to the crashed white rocket "
     "lying on its side, he looks up at the huge blue Earth in the black starry sky, grey cratered ground, fine dust floating slowly in the air, soft blue light, "
     "emotional and calm. Seen from a distance, centred. " + LOOK,
 "j_find": TOBISH + "Scene: on the Moon next to the crashed rocket, Tobish in his spacesuit kneels and holds up a small glowing green seed pouch in one hand "
     "(soft green glow on his visor), beside him a metal case of materials and a small salvaged computer monitor whose screen is glowing with a soft cyan light, "
     "Earth in the black sky behind, hopeful mood. Centred. " + LOOK,
 "k_screen": "Dim interior of a wrecked spaceship cabin seen out of focus (shallow depth of field), a soft cyan-teal glow in the middle from an unseen screen, "
     "warm orange emergency light at the edges, bokeh lights, floating dust motes in the light beams, calm empty uncluttered centre, full frame edge to edge with no black bars. " + LOOK,
}

VIDEOS = {  # name: (start, end or None, prompt)
 "a_room": ("a_room", None, "Slow gentle push-in toward the boy. The TV light flickers softly across his face, his eyes sparkle with wonder, he breathes and slightly leans forward, tiny dust motes float. Smooth, no morphing, same face."),
 "b1_study": ("b1_study", None, "Slow gentle camera drift. The boy turns a page and writes, the lamp glows warmly, glowing formulas and little planets float and drift slowly around him, books stay still. Smooth, no morphing, same face."),
 "b2_study": ("b2_study", None, "Slow gentle push-in. The young man looks up from his book with a determined smile, glowing formulas and planets drift slowly, the lamp flickers softly. Smooth, no morphing, same face."),
 "c_grad": ("c_grad", None, "Slow gentle camera move. Confetti falls softly, he smiles proudly and looks toward the sky, soft sun rays shimmer, the crowd cheers blurred behind. Smooth, no morphing, same face."),
 "d_pad": ("d_pad", None, "Very slow camera push-in toward the rocket. Steam vents hiss and drift at the base, the sunrise glow slowly brightens, clouds move gently. The rocket stays perfectly still and upright. Smooth, no morphing."),
 "e_lift": ("e_lift", None, "The rocket rises steadily and accelerates upward, bright flames and huge billowing white smoke clouds expand below, camera tilts up slightly following it. Smooth, powerful, no morphing, rocket keeps its shape."),
 "f_journey": ("f1_earth", "f2_moon", "The rocket flies steadily forward through space away from Earth toward the Moon, the Moon slowly grows larger ahead, Earth shrinks behind, stars drift past, engine flame flickers softly. Smooth camera following the rocket, no morphing, rocket keeps its shape."),
 "g_cockpit": ("g_cockpit", None, "The cockpit shakes strongly, red alarm lights pulse, sparks fly from the console, Tobish grips the controls hard and strains, hair and loose items float and shake. Smooth, no morphing, same face."),
 "h_fall": ("h1_fall", "h2_crash", "The rocket tumbles and spirals down toward the lunar surface trailing smoke and sparks and then crashes, a big cloud of moon dust billows outward and rises. Smooth, no morphing, rocket keeps its shape."),
 "i_alone": ("i_alone", None, "Very slow gentle push-in. Fine moon dust settles slowly through the air, the astronaut stands still looking up at Earth, the Earth glows softly, stars twinkle. Calm, smooth, no morphing."),
 "j_find": ("j_find", None, "Slow gentle push-in. The green seeds glow and pulse softly, the computer screen flickers and then lights up bright cyan, Tobish looks at it with growing hope. Smooth, no morphing, same face."),
 "k_screen": ("k_screen", None, "Very slow gentle drift. The cyan glow pulses softly, dust motes float slowly through the light, out-of-focus bokeh lights twinkle. Calm, smooth, no new objects, no text."),
}
REFS = {  # extra references per frame
 "d_pad": [], "e_lift": ["d_pad"], "f1_earth": ["e_lift"], "f2_moon": ["f1_earth"], "h1_fall": ["f1_earth"], "h2_crash": ["h1_fall"],
 "k_screen": [], "i_alone": ["h2_crash"], "j_find": ["i_alone"],
}
NEEDS_SHEET = {"a_room", "b1_study", "b2_study", "c_grad", "g_cockpit", "i_alone", "j_find"}


def up(p: Path) -> str:
    for a in range(6):
        try:
            return fal_client.upload_file(str(p))
        except Exception:
            if a == 5: raise
            time.sleep(4 * (a + 1))


def get(url, dst: Path):
    dst.write_bytes(requests.get(url, timeout=600).content)


def sheet():
    r = fal_client.subscribe("fal-ai/nano-banana-pro", arguments={"prompt": SHEET, "aspect_ratio": "16:9", "resolution": "1K", "output_format": "png"})
    get(r["images"][0]["url"], OUT / "sheet.png"); print("ok sheet", flush=True)


def frame(name: str, v: int = 1):
    refs = []
    if name in NEEDS_SHEET: refs.append("sheet")
    refs += REFS.get(name, [])
    prompt = FRAMES[name]
    try:
        if refs:
            r = fal_client.subscribe("fal-ai/nano-banana-pro/edit", arguments={"prompt": prompt, "image_urls": [up(OUT / f"{x}.png") for x in refs], "aspect_ratio": "16:9", "resolution": "2K", "output_format": "png"})
        else:
            r = fal_client.subscribe("fal-ai/nano-banana-pro", arguments={"prompt": prompt, "aspect_ratio": "16:9", "resolution": "2K", "output_format": "png"})
        get(r["images"][0]["url"], OUT / f"{name}.png"); print("ok", name, flush=True)
    except Exception as e:
        print("FAIL frame", name, str(e)[:200], flush=True)


def video(name: str):
    s, e, prompt = VIDEOS[name]
    args = {"start_image_url": up(OUT / f"{s}.png"), "prompt": prompt, "duration": "5", "generate_audio": False}
    if e: args["end_image_url"] = up(OUT / f"{e}.png")
    try:
        r = fal_client.subscribe("fal-ai/kling-video/v3/pro/image-to-video", arguments=args)
        get(r["video"]["url"], OUT / f"{name}.mp4"); print("ok video", name, flush=True)
    except Exception as ex:
        print("FAIL video", name, str(ex)[:200], flush=True)


if __name__ == "__main__":
    mode, *names = sys.argv[1:]
    if mode == "sheet": sheet()
    elif mode == "frames":
        names = names or list(FRAMES)
        # ordering: independent first, then dependents
        first = [n for n in names if not REFS.get(n)]
        rest = [n for n in names if REFS.get(n)]
        with ThreadPoolExecutor(5) as ex: list(ex.map(frame, first))
        for chain in (["e_lift"], ["f1_earth", "h1_fall"], ["f2_moon", "h2_crash"], ["i_alone"], ["j_find"]):
            todo = [n for n in chain if n in rest]
            with ThreadPoolExecutor(3) as ex: list(ex.map(frame, todo))
    elif mode == "video":
        names = names or list(VIDEOS)
        with ThreadPoolExecutor(4) as ex: list(ex.map(video, names))
