// GET /music/models: the model fit review. Which AI model was used for which
// job on the "Sing Like a Human" music video, what each cost and where each
// fell short. One person's findings from one project, said so at the top.
import { MODELS, headTags } from "./share.js";

const R = '<span class="st st-yes">Recommended</span>';
const M = '<span class="st st-mix">Mixed results</span>';
const N = '<span class="st st-no">Not recommended</span>';

const table = (head, rows) =>
  `<div class="scroll"><table><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`)).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
const list = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

const QUICK = table(
  ["Task", "Model used", "Price", "Reason"],
  [
    ["First pass of a still image: layout, people and feeling", "GPT Image 2.5 Flare, image-to-image", "12 credits (2K, medium); 7 credits (1K, low)", "The lowest price. It follows layout references, and it produced the warmest face in the film."],
    ["Final face pass on a still image", "Seedream 5 Pro, image-to-image, 2K", "60 credits, plus about 2 per additional reference", "Raises the image to 2816 × 1584. Likeness was best when it was given only the face master."],
    ["Photographic look pass (the feel of a real candid photograph)", "Seedream 5 Pro, image-to-image, 2K, one input", "60 credits", "Keeps faces and layout. Adds grain, pores and muted colour."],
    ["Face correction on a crop; new face masters", "Seedream 5.5, image-to-image, 2K", "32 credits, plus about 5 per reference", "Softer, friendlier faces. Performs well on crops and masters."],
    ["Small edits (microphone, collar, background plate, closed mouth)", "GPT Image 2.5 Flare", "12 credits", "The default low-cost editing model."],
    ["Edits in which pose and face must not move", "Nano Banana Pro", "About 40 credits", "Stays closest to the source image."],
    ["Character views and background plates", "Wan 2.7 Image Pro", "15 credits", "Copies the reference closely."],
    ["Rap performance takes", "MiniMax H3 Max, image-to-video (fal)", "About $1 per 1080p take", "Takes a prompt and audio. The mouth tracks the words, and motion follows the still."],
    ["Mila's fully sung words and belted notes", "OmniHuman 2.0", "$0.10 per second", "Opens the mouth on full words. The most emotion of the models tried."],
    ["Soft, quiet sung words", "HeyGen Avatar IV", "$0.045 per second", "A natural, small mouth movement."],
    ["Two-person face-off lip sync", "InfiniteTalk Multi (WaveSpeed)", "$0.06 per second at 720p", "The only model tried with separate left and right audio. It kept the beard and the age of the face."],
    ["Silent motion, reactions and atmosphere", "Kling 3.0 Pro", "105 credits for 3 s; 175 for 5 s; 350 for 10 s", "Clean silent clips. It obeys a locked camera."],
    ["A short silent hero shot", "PixVerse V6, 1080p", "150 credits for 5 s", "Kept face ratios within 1–3 %."],
    ["Video from 720p to 1080p", "ByteDance video upscaler", "$0.0072 per second", "Keeps the face, lips and beard."],
    ["Audio stems and timing", "Demucs (run locally)", "Free", "The vocal stem sets the timing of the cuts."],
  ],
);

const UPSCALERS = table(
  ["Model", "Assessment", "Price", "Note"],
  [
    ["ByteDance video upscaler", `${R} The default for 720p to 1080p.`, "$0.0072 per second", "Beard and skin survive. No smoothing."],
    ["SeedVR (fal)", M, "About $0.001 per megapixel", "768p to near-native 1080p. Output is silent and 1920 × 1104."],
    ["SeedVR2", M, "$0.04 per second", "Exaggerates freckles and eyelashes."],
    ["FlashVSR", N, "$0.018 per second", "Oily skin; the lips were changed."],
    ["Topaz", "Not run", "$0.01 per second", "A possible final 4K pass."],
  ],
);

const fig = (name, h, alt, caption) =>
  `<figure class="fig"><img src="/art/tricks/${name}-800.jpg" srcset="/art/tricks/${name}-800.jpg 800w, /art/tricks/${name}-1600.jpg 1600w" sizes="(min-width: 960px) 820px, 100vw" width="1600" height="${h}" alt="${alt}" loading="lazy" decoding="async"><figcaption>${caption}</figcaption></figure>`;

const BODY = `
<section class="models-head">
  <div class="wrap">
    <p class="crumb"><a href="/music">Music</a> <span aria-hidden="true">/</span> Model review</p>
    <h1>Model fit review: which AI model was used for which task</h1>
    <p class="soft">A record of the AI image, video and audio models used to make the music video <a href="/music">Sing Like a Human</a> between 7 and 24 November 2026: what each was used for, what it cost, and where it fell short.</p>
    <aside class="disclaimer" aria-labelledby="disclaimer-h">
      <h2 id="disclaimer-h">Disclaimer</h2>
      <p>These findings are one person's experience on one music-video project, carried out between 7 and 24 November 2026. They are not benchmarks, and they were not produced under controlled test conditions. A different project, subject or prompt may give a different result.</p>
      <p>Models, prices and billing rules change. Please check the current price with the provider before running anything.</p>
    </aside>
    <p class="small soft">Compiled from the project's model notes (163 findings), its decision log and its run logs. Prices are given in OpenArt credits, or in US dollars as billed by fal or WaveSpeed. Last checked on 24 November 2026; prices on OpenArt were quoted again on that day.</p>
    <p class="small soft">Each model carries one of three assessments. ${R} means proven and used in the film. ${M} means mixed results or not fully tested. ${N} means rejected for this project.</p>
  </div>
</section>

<div class="wrap models-grid">
  <aside class="toc-side">
    <nav class="toc" aria-label="On this page"><p class="toc-h">On this page</p><ol>
      <li><a href="#quick">Summary of recommendations</a></li>
      <li><a href="#stills">Still-image models</a></li>
      <li><a href="#warm-face">The warm-face method</a></li>
      <li><a href="#video">Video: performance and lip sync</a></li>
      <li><a href="#upscalers">Upscalers</a></li>
      <li><a href="#local">Local tools</a></li>
      <li><a href="#prompts">Prompt rules</a></li>
      <li><a href="#methods">Methods that worked</a></li>
      <li><a href="#billing">Prices and billing</a></li>
      <li><a href="#open">Open questions</a></li>
    </ol></nav>
  </aside>
  <div class="models-body">
<section id="quick">
  <div class="wrap">
    <h2>1. Summary of recommendations</h2>
    ${QUICK}
  </div>
</section>

<section id="stills">
  <div class="wrap">
    <h2>2. Still-image models</h2>

    <h3>2.1 GPT Image 2.5 Flare: first pass and low-cost edits ${R}</h3>
    <p><b>Price.</b> 7 credits at 1K, low quality; 12 credits at 2K, medium quality. It was billed at 19–39 credits at 1K when several references were supplied.</p>
    <p><b>Strengths.</b></p>
    ${list([
      "Layout from words together with references. Positions given as measurements (for example, “face 62 % from the left edge, eye lines 38 % down”) were followed.",
      "Low-cost edits: background plates, collars, microphones, closed mouths, and doll versions of a 14-person choir, with every position kept.",
      "Holding face ratios on corrections to Ayaz (jaw-to-eye ratio 2.23–2.27 against 2.24 on the master).",
      "The candid photograph on the pier (credits photograph 11): Mila's face, from an unedited Flare first pass, is the warmest front-facing face in the project.",
    ])}
    <p><b>Weaknesses.</b></p>
    ${list([
      "It copies the head pose and size of the first image even when the text asks for another. To change the pose, the earlier still should be left out of the references.",
      "It lights skin more orange and darker (face saturation 30 against 17). This was corrected with a local colour grade.",
      "An edit described as a “face swap” barely changes the face.",
      "Edits can soften the light across the whole frame or widen a jaw (+8 %). The result should be measured afterwards, and only the changed region pasted back.",
      "Rebuilding a tilted three-quarter face widens the jaw (+9 %). Side stills should be built from a front still that has already passed.",
    ])}
    <p><b>Working rule.</b> Iterate at 1K until layout, costume and light are right. At that stage the face needs only to be approximately right.</p>

    <h3>2.2 Seedream 5 Pro: face pass and photographic look pass ${R}</h3>
    <p><b>Price.</b> At 2K, 60 credits with one reference and 64 credits with three references (quoted on 24 November). At 1K, 30 credits. In practice it was billed at 62–68 credits. On fal, $0.0675 per image.</p>
    <p><b>Face pass</b> (the workflow adopted on 21 November: work until the image is right, then apply Seedream over it).</p>
    ${list([
      "Inputs: the first image is the chosen Flare take, accompanied by the face master only (for Ayaz, with a second master for three-quarter views).",
      "Make-up is best preserved in words (“exactly as in image 1”). A make-up master made Mila's face fuller and older (likeness 0.635 with it, 0.658 without).",
      "Measured results: one still rose from 0.56 to 0.60; another rose from 0.665 to 0.704 against the face master, the best likeness for Mila in a face-off.",
    ])}
    <p><b>Photographic look pass</b> (the candid photographs in the credits).</p>
    ${list([
      "One input: the finished still. The prompt read: “Turn image 1 into a real candid photograph … change only the photographic look: natural skin with real texture and pores, fine film grain, colours natural and slightly muted … do not zoom out”.",
      "Used on credits photographs 9, 4, 10 and 11 (the pier).",
    ])}
    <p><b>Weaknesses.</b></p>
    ${list([
      "Head angle from text: 25–30° was requested, and 56°, 36° and 64° were returned. A picture with the correct angle should be supplied instead.",
      "It reframes the image despite the instruction “do not zoom or crop” (in one still the faces became about 10 % larger and the gap between them widened).",
      "A plain instruction to “fix the face” barely changes a visible face. The method that worked: paint the head flat green, let Seedream fill it, and paste the result back with a feathered mask.",
      "Certain words mislead it. “Raven” draws a real bird. A set described in words is reinvented on every run; a fixed plate image should be supplied.",
      "Words about wind remove a ponytail. It never returns the same still twice.",
      "It is too expensive for small edits such as a skirt; Flare should be used for those.",
      "It sometimes lists only two of three references. Whether the third is used has not been established.",
    ])}

    <h3>2.3 Seedream 5.5: soft face corrections and new masters ${R} <span class="when">since 22 November</span></h3>
    <p><b>Price.</b> It charges per reference. Quoted on 24 November at 2K, 16:9: 32 credits for text-to-image, 37 with one reference, 47 with three references. Billed at 42 credits with two references (in batches of 3 and 4) and 47 with three references.</p>
    <p><b>Sizes.</b> 1K, 1.5K and 2K. Up to 10 references. A transparent background is available.</p>
    <p><b>Results.</b></p>
    ${list([
      "Face masters for a supporting character from a single face crop: front view 0.669 against the original master, three-quarter view 0.624. By eye they are softer and friendlier than the Flare masters and the earlier ones.",
      "Face corrections on crops with one master: 0.554, 0.604, 0.664 and 0.680 (pass); 0.507 near profile (fail).",
      "End frames corrected for Kling first-and-last-frame runs: 4 of 4 passed (0.578–0.680), with only the oval of the face changed.",
      "First pass of credits photograph 10 (a park bench, 23 November): Ayaz 0.568 (pass), Mila 0.481 (laughing, near profile). It was chosen, then given the Seedream 5 Pro photographic look pass.",
    ])}
    <p><b>Not yet tested.</b> Use as the photographic look finisher. A one-input pass would cost 37 credits, against 60 on Seedream 5 Pro.</p>
    <p><b>Billing discrepancy.</b> The park-bench run of 23 November was billed at 37 credits per image with three references, where the quote on 24 November was 47. This has not been explained.</p>

    <h3>2.4 Seedream 5 Lite and Seedream 4.5 ${M}</h3>
    ${list([
      "15 credits at 2K. Up to 14 references. Seedream 4.5 goes to 4K for the same price; Seedream 5 Lite goes to 3K.",
      "Seedream 5 Lite made the two references behind the first version of the entry still, which was then passed through Seedream 5 Pro. Seedream 4.5 was used for edits only.",
      "The charge per reference was not checked.",
    ])}

    <h3>2.5 GPT Image 2.6 Sunburst ${M}</h3>
    ${list([
      "34–55 credits at 2K, high quality. It was often billed above the quote (55 against 40).",
      "The best retouching of skin and make-up. It made Mila's stage make-up master, and it changed apparent age where Wan could not (a younger master for Ayaz).",
      "It redraws the whole person on each pass: polished skin, a reshaped neck, and in one case a sneer that became a caricature. It should be run once from the master, and never chained.",
    ])}

    <h3>2.6 Nano Banana Pro ${R} <span class="when">for minimal edits</span></h3>
    ${list([
      "About 40 credits on OpenArt; $0.14–0.15 elsewhere.",
      "It holds pose, position and face best. Edits to props and backgrounds left the pixels of the face almost unchanged (a difference of about 4–5 in 255).",
      "It failed when asked to change how something was held, and returned a near copy. In a test of a turned head it produced a different, younger man, although the measured ratios were close.",
      `Nano Banana 2 Lite: the background edit was poor and the output only 1376 × 768. ${N}`,
    ])}

    <h3>2.7 Wan 2.7 Image Pro ${R} <span class="when">for character views only</span></h3>
    ${list([
      "15 credits at any aspect ratio.",
      "It copies the reference closely: three-quarter, profile and full-body views (face width within 2 %), and background plates.",
      "It cannot change apparent age. It copies an old face if one is among the references, and copies a previous take almost whole. A take should never be supplied as a reference.",
    ])}
  </div>
</section>

<section id="warm-face">
  <div class="wrap">
    <h2>3. The warm-face method (credits photograph 11, the pier)</h2>
    <p>The best warm, front-facing face in the project came from this sequence.</p>
    <ol>
      <li><b>19 November, GPT Image 2.5 Flare, image-to-image, 2K, medium quality.</b> Six references: a face and a body for each person. The prompt gave positions as measurements and one feeling per person: “laughing with her whole face”, “a warm, slightly embarrassed smile”, “a small real smile, a little shy of the camera”. It also read “Fresh-faced, light natural make-up, bare lips”, and asked for natural daylight only.</li>
      <li><b>20 November, a face correction for the album.</b> Ayaz's face was corrected on a crop (0.505 to 0.618). The correction to Mila's face scored lower, so her original Flare face was kept (0.536).</li>
      <li><b>22 November, Seedream 5 Pro photographic look pass.</b> The only input was the picture from step 2. The final file is this output, unchanged.</li>
    </ol>
    <p><b>Lessons.</b></p>
    ${list([
      "Ask for a feeling, not a pose.",
      "Once a face is warm, it should not be corrected again. A score below 0.55 can still be the best picture: the score measures identity, not warmth.",
      "Cost: 12 + 60 = 72 credits per still at 2K.",
    ])}
  </div>
</section>

<section id="video">
  <div class="wrap">
    <h2>4. Video: performance and lip sync</h2>

    <h3>4.1 MiniMax H3 Max, image-to-video (fal) ${R} <span class="when">for rap</span></h3>
    ${list([
      "It takes a prompt and the target audio. Output length is fixed at about 8.03 s or about 11.55 s, so the audio is padded and the result trimmed.",
      "Under the rap plan of 15 November, all 7 takes passed the face-drift check, with the mouth open on 61–79 % of frames. The first rap section was approved on these takes.",
      "The starting still drives the motion more than the prompt does. A tight, turned still gave head nods of 23–28°; a calm, centred still gave 8–10°.",
      "A seed reproduces only the same job.",
    ])}
    <p><b>Cautions.</b></p>
    ${list([
      "Billing: 1080p cost about 3.1 times the list price in practice (about $0.109 per second, or about $1 per take). A $10 top-up was used in 10 takes.",
      "Words describing mood lighting (“live performance on stage”, or named lights) make the background drift. “Dark” and “clean stage” removed a red rim light at 1080p. The light in the still should be preserved in words, and light events added in the edit.",
      "Words about air (breath, mist, vapour, fog) make vapour come out of mouths. They should never be used.",
      "A microphone in the still is always lifted to the lips.",
      "It overplays expression. One attitude should be requested for each part.",
      "A cue to lean in reads as a soft gesture in a face-off. No lean-in cues.",
      `Shots with two people lost Ayaz's beard and age. ${N} for face-offs.`,
    ])}

    <h3>4.2 MiniMax H3 Max Lip Sync (no prompt) ${M}</h3>
    ${list([
      "$0.05 per second. It takes an image and audio only. It keeps the face and age closer than HeyGen does.",
      "It is too still for rap (nods of 8–14°, against 23–28° on image-to-video). It suits calm sung lines; one of Mila's takes for the second chorus is in the final cut.",
      "Transcription should be off for singing and on for rap, and every word should then be checked (it once dropped “prove it”).",
      "Held vowels on a front-facing face become a round “oh”. OmniHuman should be used for those.",
    ])}

    <h3>4.3 OmniHuman 2.0 ${R} <span class="when">for Mila's fully sung words</span></h3>
    ${list([
      "$0.10 per second, billed per whole second. 720p at 24 frames per second only, so an upscale should be planned.",
      "It opens the mouth on full words and held belted notes, and gives the most emotion. 7 of Mila's 12 takes in the final cut were made with it.",
      "It is too dramatic for restrained rap (grins, sways, closed eyes). It is acceptable on a shouted peak.",
      "The content filter flags close, front-facing stills of Mila at random (these runs were refunded). A side or low-angle backup should be kept.",
    ])}

    <h3>4.4 HeyGen Avatar IV ${M} <span class="when">soft words only</span></h3>
    ${list([
      "$0.045 per second on WaveSpeed ($0.10 per second on fal, without a direction field). 1080p.",
      "Natural on soft words; it barely opens the mouth on full words. It adds a friendly smile and smoothing, and the background drifts towards grey-green. One face per run.",
      "Identity should be checked on every take: one take of Mila read as a different woman (jaw +24 %).",
    ])}

    <h3>4.5 InfiniteTalk and InfiniteTalk Multi (WaveSpeed) ${R} <span class="when">for face-offs</span></h3>
    ${list([
      "$0.06 per second at 720p. Multi is the only model tried with separate left and right audio (its “meanwhile” mode).",
      "A music-only track for the listening character keeps that character's lips closed.",
      "It kept Ayaz's beard and age in 6 of 6 frames where H3 failed. It was used for all 6 face-off slots, upscaled with the ByteDance upscaler.",
      "Single InfiniteTalk on a front-facing rap face snarls (teeth visible in 227 of 646 frames). Rap delivered straight to camera should never be run on it.",
      "Prompts should name only visible actions. “Natural” and “casually” have no effect, and words about breath produce vapour.",
    ])}

    <h3>4.6 Sync lipsync-3 ${M}</h3>
    ${list([
      "$0.135 per second ($8 per minute). A video-to-video mouth pass on one speaker.",
      "It reduced frames with visible teeth from 60 to 15 over a three-quarter InfiniteTalk take. It made a front-facing snarl worse (227 to 249). It should be used only over neutral three-quarter takes.",
    ])}

    <h3>4.7 Kling 3.0 ${R} <span class="when">for silent clips</span></h3>
    ${list([
      "Pro: 105 credits for 3 s, 175 for 5 s, 350 for 10 s. Standard: 125 credits for 5 s. It was billed above the quote once (276 against 250).",
      "In the film: the chrome dissolve, the back-to-back shots, the raven-cloth loop, Mila's reaction clips and the ending shot.",
      "It does not hear audio. Anything that must play or sing in time fails.",
      "It overdoes whatever is named (haze rolls in), and long lists of actions are exaggerated. The wording that held the camera: “Locked-off camera on a tripod, the camera does not move.”",
      "Orbits made from a first and a last frame pick a side at random. Morphs ignore timing; a local strobe of aligned stills worked better.",
      "Two people timed within one shared window move one after the other. The prompt should say that both start and finish on the same frame.",
      "The camera is as smooth as a gimbal. Handheld shake should be added locally for the feel of a phone.",
    ])}

    <h3>4.8 PixVerse V6 ${R} <span class="when">for one silent shot</span></h3>
    ${list(["1080p, 5 s, 150 credits. Used for the head-raise shot on the line “Can she?”, which was kept as generated."])}

    <h3>4.9 LTX 2.3, audio-to-video ${N}</h3>
    ${list(["It was the only model that made light events inside the scene from a prompt, but only about 6 of 14 runs were usable. The failures were frozen mouths, a cut to strangers, and a floating light bulb."])}
  </div>
</section>

<section id="upscalers">
  <div class="wrap">
    <h2>5. Upscalers</h2>
    ${UPSCALERS}
  </div>
</section>

<section id="local">
  <div class="wrap">
    <h2>6. Local tools (free)</h2>
    ${list([
      "<b>Teeth correction, version 6 (soft).</b> Calibrates glare and colour for each clip. It corrects colour, not the shape of teeth. Closed mouths and small faces should be skipped.",
      "<b>Apple Vision.</b> Face ratios, mouth opening, eye closure and person masks. It is misled by shadow and closed eyes, and cannot tell the earlier Ayaz face from the new one. Flagged frames should be judged by eye.",
      "<b>ArcFace face check.</b> A pass is 0.55 or higher against the masters. Near-profile and laughing faces score low and should be checked by eye.",
      "<b>ffmpeg light passes and strobes.</b> Frame-exact effects. Mist added locally looked like stains.",
      "<b>Demucs.</b> The vocal stem for timing (subtitle times were 0.15–0.34 s off), and band-only stems for the listening character's audio tracks.",
    ])}
  </div>
</section>

<section id="prompts">
  <div class="wrap">
    <h2>7. Prompt rules that held across models</h2>
    ${list([
      "Never use the words breath, mist, vapour, fog or haze. Vapour comes out of mouths, and haze builds up.",
      "Never use the word “raven” in a prompt for a still. A real bird appears.",
      "Do not use words for mood lighting, or the word “dark”, on video. Preserve the light of the still by naming it.",
      "Describe only what is visible. One attitude for each part, and one cue for each listening character.",
      "Give positions as measurements. Give angles as a picture, not as degrees.",
      "Ask for a feeling (“laughing with her whole face”), not a pose.",
      "Keep make-up with the words “exactly as in image 1”, not with a make-up reference.",
      "Never supply a different face as a pose reference.",
      "Pad lip-sync audio by 0.6–1 s, and cut before the mouth closes at the end.",
      "Do not ask Ayaz to stare to the left.",
    ])}
  </div>
</section>

<section id="methods">
  <div class="wrap">
    <h2>8. Methods that worked</h2>
    <p>These are working methods, not models. Each one was found during the project and used in the film. Where a point rests on observation only, the text says so.</p>

    <h3>8.1 Crop, change, paste back</h3>
    <p>When a face is small in the frame, the model is given too few pixels to work on, and an edit of the whole picture changes things that should stay. The area around the head is cut out, the model works on that crop alone, and the result is pasted back with a soft edge.</p>
    ${list([
      "The rest of the picture stays identical, pixel for pixel.",
      "The face is larger in the crop, so the model has more to work with. A crop of about three times the width of the face, enlarged to 1024 pixels, worked well.",
      "The result is aligned to the original before it is pasted, because the model may shift the head by a few pixels.",
      "On the market singer, the likeness score of one still rose from 0.17 to 0.66 in a single pass on Seedream 5.5.",
    ])}
    ${fig("trick-crop", 420, "Three pictures in a row. A wide night-market scene with a white square drawn around the singer's head; the cut-out square before the change; the same square after the change, with a different face.", "Left: the still, with the area that was cut out. Centre: the crop as it was. Right: the crop after the change, before it was pasted back.")}

    <h3>8.2 Green paint for a stronger change</h3>
    <p>A plain request to replace a face often changes almost nothing: the model protects a face it can see. Painting the face, or the whole head, in flat green removes what the model would protect, and it then draws the head from the reference.</p>
    ${list([
      "On Ayaz's profile, a plain face correction on Seedream 5 Pro changed almost nothing. With the whole head painted green, the same model drew the new face.",
      "On Mila's most difficult still, the green method reached 0.443 against 0.375 for a plain edit and 0.259 for the original.",
      "<b>The green shape sets the size of the head.</b> When the green was painted loosely, the model filled the whole patch and the head came out too large. Keeping the green close to the real outline of the head avoided this.",
      "With a loose patch, the prompt should ask for the face and the background inside the green area, not for a head that fills it. This wording is an observation from the work; it was not tested side by side.",
      "Paint only the person, never the background, when the background must stay.",
    ])}
    ${fig("trick-green", 529, "Three pictures in a row of a man in profile on a stage. The original; the same picture with his whole head painted flat green; the result, with a new head of the same size drawn in the green area.", "Left: the original crop. Centre: the head painted green, close to its real outline. Right: the head drawn by the model from the face reference.")}

    <h3>8.3 One run for several faces, mapped from left to right</h3>
    <p>MiniMax H3 Max Recast on fal replaces people in a video. It accepts one to four reference pictures, one for each person, and maps them to the people in the picture from left to right. The market singer appeared in four clips, with a different face in each. A first run on one whole clip failed: her face was 60–88 pixels tall and the model kept the old one.</p>
    <ol>
      <li>Her head was tracked in each clip, and a tall column was cut around it.</li>
      <li>The four columns were joined side by side into one video. Her face was now about 216 pixels tall in every column.</li>
      <li>Four references were supplied in the same order from left to right, each chosen for the angle of the head in its column: three-quarter, front, three-quarter mirrored, front.</li>
      <li>The prompt read: “Four people, left to right. Replace person 1 with reference 1, person 2 with reference 2, person 3 with reference 3, person 4 with reference 4.”</li>
      <li>The result was cut back into columns, and each was pasted into its own clip with a soft oval around the head.</li>
    </ol>
    ${list([
      "The mapping from left to right held, although all four columns show the same person.",
      "One run changed four clips. The list price was about $1.56 at 1080p; the amount charged was not confirmed.",
      "The median likeness score rose from about 0 to 0.15–0.33. The faces are below the size at which the score is reliable, so the result was also judged by eye.",
      "The references must have different addresses. Supplying the same picture twice was refused; the same file uploaded a second time was accepted.",
    ])}
    ${fig("trick-strip", 1810, "Two rows of four tall panels, each showing a singer with a guitar at a microphone. In the top row the four faces differ from each other. In the bottom row all four show the same face.", "Top: the four clips joined side by side, with four different faces. Bottom: the same frame after one run, with one face. The grey shape in the third column is a passer-by.")}

    <h3>8.4 One measure for each question</h3>
    ${list([
      "<b>Identity.</b> The ArcFace score against the masters; a pass is 0.55 or higher. Pictures of the same character scored 0.78–0.88 against each other.",
      "<b>Proportions and position.</b> Apple Vision landmarks. Jaw and chin ratios could not tell two different faces apart, so they were never used for identity.",
      "<b>Head size after an edit.</b> The face box before and after. A change of more than 5 % was flagged, because edit models often draw the head larger.",
      "<b>Comparison by eye.</b> Only on a sheet where every face is drawn at the same scale.",
      "The ArcFace score is weak on profiles and on faces under about 120 pixels. Those were judged by eye.",
    ])}

    <h3>8.5 Teeth correction, calibrated for each clip</h3>
    <p>Lip-sync models often draw teeth that glow. The correction is local and free, and it changes only a box around the lips.</p>
    ${list([
      "Each clip is measured in its own light. Fixed settings were wrong from one light to the next.",
      "Glare is brought halfway down towards the lit skin, and colour is moved halfway towards the white of the eye. A full correction met its targets but looked beige and grey.",
      "It cannot correct the shape of teeth, or flicker between frames. Those are hidden in the edit.",
    ])}
    ${fig("trick-teeth", 447, "Two close pictures of the same open mouth. On the left the teeth glow bright white. On the right they are slightly darker and warmer.", "The same frame before and after. Only the area inside the lips was changed.")}

    <h3>8.6 A continuous shot from loose endings</h3>
    <ol>
      <li>The video model is run from a start frame only, with a prompt that describes the whole move. It finds a natural camera move and a natural ending by itself.</li>
      <li>The last frame of that run has a good composition, and usually a face that has drifted. The face is corrected on that frame as a still.</li>
      <li>The corrected frame becomes the end frame of a new run, and then the start frame of the next clip.</li>
    </ol>
    ${list([
      "Every join is a still that can be controlled, so the face is exact where it is largest.",
      "With only a start frame, Kling 3.0 replaced a face within 0.5–1 s. Fixing the end frame as well roughly doubled how well the face held; it did not lock it.",
    ])}

    <h3>8.7 Word order is action order</h3>
    ${list([
      "Two clauses are performed as two beats. Actions that happen together should be written as one action with both people: “they take each other's hand at the same moment”.",
      "When a model fails an action, the prompt should be corrected first. Extra stills and masks come second.",
      "Describe the actual motion (bounces, sways, stamps in puddles). “Dances slowly” freezes the pose.",
      "Do not name parts of the face in a video prompt. The model acts on what is named.",
      "The start and end frames should carry the same expression, or the model moves the brows to travel from one to the other.",
    ])}
  </div>
</section>

<section id="billing">
  <div class="wrap">
    <h2>9. Prices and billing: points to watch</h2>
    ${list([
      "Quotes on OpenArt depend on the references, the resolution and the number of images. The exact configuration should be quoted again before every run.",
      "Seedream 5.5 adds about 5 credits per reference. Seedream 5 Pro adds about 2 credits per additional reference.",
      "Flare at 1K was billed at 19–39 credits with several references, well above the base price of 7 credits.",
      "MiniMax H3 Max at 1080p on fal cost about 3.1 times the list price. The usage export (CSV) should be treated as the record of what was charged.",
      "Video was two to three times cheaper per second on fal than on OpenArt. Stills remained on OpenArt.",
      "Unexplained differences: 14 credits and 34 credits on 23 November, and the Seedream 5.5 park-bench run billed at 37 credits against a quote of 47 on 24 November.",
    ])}
  </div>
</section>

<section id="open">
  <div class="wrap">
    <h2>10. Open questions</h2>
    ${list([
      "Seedream 5.5 as the photographic look finisher (37 credits against 60): not tested.",
      "The charge per reference on Seedream 4.5 and Seedream 5 Lite: not checked.",
      "Whether Seedream uses a third reference when OpenArt lists only two: not established.",
      "The warm face on the pier has no likeness score after the Seedream pass.",
      "Whether a loose green patch gives a normal head when the prompt asks for the face and the background: not tested side by side.",
    ])}
    <p class="small soft">Product and company names belong to their owners and are used here only to identify the tools. See how the film was made on the <a href="/music">music page</a>.</p>
  </div>
</section>
  </div>
</div>`;

const CSS = `
.models-head{padding:56px 0 32px;border-bottom:0}
.models-head h1{margin:0 0 14px;font-size:clamp(32px,4.6vw,50px);line-height:1.08;max-width:820px}
.crumb{margin:0 0 10px;font-size:14px;color:var(--ink-soft)}
.crumb a{text-decoration:none;font-weight:600}
.disclaimer{margin:22px 0 18px;padding:16px 20px;max-width:688px;background:#fff;border:1px solid var(--line);border-left:4px solid var(--human);border-radius:8px}
main.models .disclaimer h2{margin:0 0 6px;padding:0;border:0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--human-deep)}
.disclaimer p{margin:0 0 8px;font-size:15px}
.disclaimer p:last-child{margin:0}
.models-grid{display:grid;gap:28px 56px;padding-bottom:56px}
.toc{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:16px 18px}
.toc-h{margin:0 0 8px;font-size:12.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--ink)}
.toc ol{margin:0;padding-left:22px;font-size:15px}
main.models .toc li{margin:0;padding:3px 0}
.toc a{color:var(--ink-soft)}
.toc a:hover{color:var(--machine-deep)}
.models-body{min-width:0}
.models-body .wrap{max-width:none;padding:0}
@media (min-width:960px){.models-grid{grid-template-columns:248px minmax(0,1fr)}.toc-side{position:sticky;top:calc(var(--bar) + 24px);align-self:start;max-height:calc(100vh - var(--bar) - 48px);overflow:auto}.toc{background:none;border:0;border-left:1px solid var(--line);border-radius:0;padding:2px 0 2px 18px}}
.toc a{text-decoration:none}
.toc a:hover{text-decoration:underline}
.models-body section{padding:0 0 44px;border-bottom:0}
.models-body section:last-child{padding-bottom:0}
main.models h2{margin:0 0 18px;font-size:clamp(24px,2.6vw,30px);padding-top:28px;border-top:1px solid var(--line)}
.models-body section:first-child h2{padding-top:0;border-top:0}
main.models h3{margin:30px 0 10px;font-size:18px;line-height:1.35}
main.models section .wrap>p,main.models section .wrap>ul,main.models section .wrap>ol{max-width:688px}
main.models li{margin:0 0 6px}
main.models ul,main.models section ol{padding-left:22px;margin:0 0 14px}
.st{display:inline-block;vertical-align:.12em;margin-left:4px;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;font-family:Inter,Helvetica,Arial,sans-serif}
.st-yes{background:var(--machine-tint);color:var(--machine-deep)}
.st-mix{background:#FBE8D8;color:var(--human-deep)}
.st-no{background:#F1F2F4;color:var(--ink)}
td .st,p .st{margin-left:0}
.fig{margin:18px 0 26px}
.fig img{display:block;width:100%;height:auto;border-radius:var(--r);border:1px solid var(--line)}
.fig figcaption{margin-top:8px;max-width:688px;font-size:14px;color:var(--ink-soft)}
.when{font-size:13px;font-weight:400;color:var(--ink-soft);white-space:nowrap}
.scroll{overflow-x:auto;margin:0 0 8px;border:1px solid var(--line);border-radius:var(--r);background:#fff}
.scroll table{border-collapse:collapse;width:100%;min-width:680px;font-size:14px;line-height:1.45}
.scroll th,.scroll td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--line)}
.scroll thead th{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);background:var(--paper)}
.scroll tbody th{font-weight:600;width:26%}
.scroll tbody tr:last-child th,.scroll tbody tr:last-child td{border-bottom:0}
`;

// shell: { head, nav, footer } cut from page.html, as for /places.
export function handleModels(shell, csp) {
  const html = `${shell.head.replace(/<title>.*<\/title>/, `<title>${MODELS.title}</title>`).replace("__HEAD_TAGS__", headTags(MODELS))}${CSS}</style>
</head>
<body>
${shell.nav}
<main id="top" class="models">${BODY}
</main>
${shell.footer}
</body>
</html>
`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Content-Security-Policy": csp,
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
