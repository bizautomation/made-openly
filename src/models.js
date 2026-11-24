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
export const list = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

const QUICK = table(
  ["Task", "Model used", "Price", "Reason"],
  [
    ["First pass of a still image: layout, people and feeling", `<a href="#m2-1">GPT Image 2.5 Flare, image-to-image</a>`, "12 credits (2K, medium); 7 credits (1K, low)", "The lowest price. It follows layout references, and it produced the warmest face in the film."],
    ["Final face pass on a still image", `<a href="#m2-2">Seedream 5 Pro, image-to-image, 2K</a>`, "60 credits, plus about 2 per additional reference", "Raises the image to 2816 × 1584. Likeness was best when it was given only the face master."],
    ["Photographic look pass (the feel of a real candid photograph)", `<a href="#m2-2">Seedream 5 Pro, image-to-image, 2K, one input</a>`, "60 credits", "Keeps faces and layout. Adds grain, pores and muted colour."],
    ["Face correction on a crop; new face masters", `<a href="#m2-3">Seedream 5.5, image-to-image, 2K</a>`, "32 credits, plus about 5 per reference", "Softer, friendlier faces. Performs well on crops and masters."],
    ["Small edits (microphone, collar, background plate, closed mouth)", `<a href="#m2-1">GPT Image 2.5 Flare</a>`, "12 credits", "The default low-cost editing model."],
    ["Edits in which pose and face must not move", `<a href="#m2-6">Nano Banana Pro</a>`, "About 40 credits", "Stays closest to the source image."],
    ["Character views and background plates", `<a href="#m2-7">Wan 2.7 Image Pro</a>`, "15 credits", "Copies the reference closely."],
    ["Rap performance takes", `<a href="#m4-1">MiniMax H3 Max, image-to-video (fal)</a>`, "About $1 per 1080p take", "Takes a prompt and audio. The mouth tracks the words, and motion follows the still."],
    ["Mila's fully sung words and belted notes", `<a href="#m4-3">OmniHuman 2.0</a>`, "$0.10 per second", "Opens the mouth on full words. The most emotion of the models tried."],
    ["Soft, quiet sung words", `<a href="#m4-4">HeyGen Avatar IV</a>`, "$0.045 per second", "A natural, small mouth movement."],
    ["Two-person face-off lip sync", `<a href="#m4-5">InfiniteTalk Multi (WaveSpeed)</a>`, "$0.06 per second at 720p", "The only model tried with separate left and right audio. It kept the beard and the age of the face."],
    ["Silent motion, reactions and atmosphere", `<a href="#m4-7">Kling 3.0 Pro</a>`, "105 credits for 3 s; 175 for 5 s; 350 for 10 s", "Clean silent clips. It obeys a locked camera."],
    ["A short silent hero shot", `<a href="#m4-8">PixVerse V6, 1080p</a>`, "150 credits for 5 s", "Kept face ratios within 1–3 %."],
    ["Video from 720p to 1080p", `<a href="#upscalers">ByteDance video upscaler</a>`, "$0.0072 per second", "Keeps the face, lips and beard."],
    ["Audio stems and timing", `<a href="#local">Demucs (run locally)</a>`, "Free", "The vocal stem sets the timing of the cuts."],
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

// The two pages of the review share one strip of tabs under the heading.
export const tabs = (here) =>
  `<nav class="tabs" aria-label="Model review">${[
    ["/music/models", "Models and prices"],
    ["/music/methods", "Methods"],
  ]
    .map(([href, text]) => `<a href="${href}"${href === here ? ' aria-current="page"' : ""}>${text}</a>`)
    .join("")}</nav>`;

export const DISCLAIMER = `<aside class="disclaimer" aria-labelledby="disclaimer-h">
      <h2 id="disclaimer-h">Disclaimer</h2>
      <p>These findings are one person's experience on one music-video project, carried out between 7 and 24 November 2026. They are not benchmarks, and they were not produced under controlled test conditions. A different project, subject or prompt may give a different result.</p>
      <p>Models, prices and billing rules change. Please check the current price with the provider before running anything.</p>
    </aside>`;

// The list of sections, drawn twice: beside the text on wide screens, and as
// one closed row that stays under the header on phones.
// items: [href, text, [[href, text], ...]?]
export const toc = (items) => {
  const ol = `<ol>${items
    .map(([href, text, sub]) => `<li><a href="${href}">${text}</a>${sub ? `<ul>${sub.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join("")}</ul>` : ""}</li>`)
    .join("")}</ol>`;
  return {
    side: `<aside class="toc-side"><nav class="toc" aria-label="On this page"><p class="toc-h">On this page</p>${ol}</nav></aside>`,
    row: `<details class="toc-m"><summary>On this page</summary><nav aria-label="On this page, short">${ol}</nav></details>`,
  };
};
export const TOP = '<p class="top"><a href="#top">Back to top</a></p>';

const TOC = toc([
  ["#quick", "Summary of recommendations"],
  ["#stills", "Still-image models", [["#m2-1", "GPT Image 2.5 Flare"], ["#m2-2", "Seedream 5 Pro"], ["#m2-3", "Seedream 5.5"], ["#m2-4", "Seedream 5 Lite and 4.5"], ["#m2-5", "GPT Image 2.6 Sunburst"], ["#m2-6", "Nano Banana Pro"], ["#m2-7", "Wan 2.7 Image Pro"]]],
  ["#warm-face", "The warm-face method"],
  ["#video", "Video: performance and lip sync", [["#m4-1", "MiniMax H3 Max"], ["#m4-2", "H3 Max Lip Sync"], ["#m4-3", "OmniHuman 2.0"], ["#m4-4", "HeyGen Avatar IV"], ["#m4-5", "InfiniteTalk"], ["#m4-6", "Sync lipsync-3"], ["#m4-7", "Kling 3.0"], ["#m4-8", "PixVerse V6"], ["#m4-9", "LTX 2.3"]]],
  ["#upscalers", "Upscalers"],
  ["#local", "Local tools"],
  ["#prompts", "Prompt rules"],
  ["#methods", "Methods that worked"],
  ["#billing", "Prices and billing"],
  ["#open", "Open questions"],
]);

const BODY = `
<section class="models-head">
  <div class="wrap">
    <p class="crumb"><a href="/music">Music</a> <span aria-hidden="true">/</span> Model review</p>
    <h1>Model fit review: which AI model was used for which task</h1>
    <p class="soft">A record of the AI image, video and audio models used to make the music video <a href="/music">Sing Like a Human</a> between 7 and 24 November 2026: what each was used for, what it cost, and where it fell short.</p>
    ${tabs("/music/models")}
    ${DISCLAIMER}
    <p class="small soft">Compiled from the project's model notes (163 findings), its decision log and its run logs. Prices are given in OpenArt credits, or in US dollars as billed by fal or WaveSpeed. Last checked on 24 November 2026; prices on OpenArt were quoted again on that day.</p>
    <p class="small soft">Each model carries one of three assessments. ${R} means proven and used in the film. ${M} means mixed results or not fully tested. ${N} means rejected for this project.</p>
  </div>
</section>

${TOC.row}
<div class="wrap models-grid">
  ${TOC.side}
  <div class="models-body">
<section id="quick">
  <div class="wrap">
    <h2>1. Summary of recommendations</h2>
    ${QUICK}
    ${TOP}
  </div>
</section>

<section id="stills">
  <div class="wrap">
    <h2>2. Still-image models</h2>

    <h3 id="m2-1">2.1 GPT Image 2.5 Flare: first pass and low-cost edits ${R}</h3>
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

    <h3 id="m2-2">2.2 Seedream 5 Pro: face pass and photographic look pass ${R}</h3>
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

    <h3 id="m2-3">2.3 Seedream 5.5: soft face corrections and new masters ${R} <span class="when">since 22 November</span></h3>
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

    <h3 id="m2-4">2.4 Seedream 5 Lite and Seedream 4.5 ${M}</h3>
    ${list([
      "15 credits at 2K. Up to 14 references. Seedream 4.5 goes to 4K for the same price; Seedream 5 Lite goes to 3K.",
      "Seedream 5 Lite made the two references behind the first version of the entry still, which was then passed through Seedream 5 Pro. Seedream 4.5 was used for edits only.",
      "The charge per reference was not checked.",
    ])}

    <h3 id="m2-5">2.5 GPT Image 2.6 Sunburst ${M}</h3>
    ${list([
      "34–55 credits at 2K, high quality. It was often billed above the quote (55 against 40).",
      "The best retouching of skin and make-up. It made Mila's stage make-up master, and it changed apparent age where Wan could not (a younger master for Ayaz).",
      "It redraws the whole person on each pass: polished skin, a reshaped neck, and in one case a sneer that became a caricature. It should be run once from the master, and never chained.",
    ])}

    <h3 id="m2-6">2.6 Nano Banana Pro ${R} <span class="when">for minimal edits</span></h3>
    ${list([
      "About 40 credits on OpenArt; $0.14–0.15 elsewhere.",
      "It holds pose, position and face best. Edits to props and backgrounds left the pixels of the face almost unchanged (a difference of about 4–5 in 255).",
      "It failed when asked to change how something was held, and returned a near copy. In a test of a turned head it produced a different, younger man, although the measured ratios were close.",
      `Nano Banana 2 Lite: the background edit was poor and the output only 1376 × 768. ${N}`,
    ])}

    <h3 id="m2-7">2.7 Wan 2.7 Image Pro ${R} <span class="when">for character views only</span></h3>
    ${list([
      "15 credits at any aspect ratio.",
      "It copies the reference closely: three-quarter, profile and full-body views (face width within 2 %), and background plates.",
      "It cannot change apparent age. It copies an old face if one is among the references, and copies a previous take almost whole. A take should never be supplied as a reference.",
    ])}
    ${TOP}
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
    ${TOP}
  </div>
</section>

<section id="video">
  <div class="wrap">
    <h2>4. Video: performance and lip sync</h2>

    <h3 id="m4-1">4.1 MiniMax H3 Max, image-to-video (fal) ${R} <span class="when">for rap</span></h3>
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

    <h3 id="m4-2">4.2 MiniMax H3 Max Lip Sync (no prompt) ${M}</h3>
    ${list([
      "$0.05 per second. It takes an image and audio only. It keeps the face and age closer than HeyGen does.",
      "It is too still for rap (nods of 8–14°, against 23–28° on image-to-video). It suits calm sung lines; one of Mila's takes for the second chorus is in the final cut.",
      "Transcription should be off for singing and on for rap, and every word should then be checked (it once dropped “prove it”).",
      "Held vowels on a front-facing face become a round “oh”. OmniHuman should be used for those.",
    ])}

    <h3 id="m4-3">4.3 OmniHuman 2.0 ${R} <span class="when">for Mila's fully sung words</span></h3>
    ${list([
      "$0.10 per second, billed per whole second. 720p at 24 frames per second only, so an upscale should be planned.",
      "It opens the mouth on full words and held belted notes, and gives the most emotion. 7 of Mila's 12 takes in the final cut were made with it.",
      "It is too dramatic for restrained rap (grins, sways, closed eyes). It is acceptable on a shouted peak.",
      "The content filter flags close, front-facing stills of Mila at random (these runs were refunded). A side or low-angle backup should be kept.",
    ])}

    <h3 id="m4-4">4.4 HeyGen Avatar IV ${M} <span class="when">soft words only</span></h3>
    ${list([
      "$0.045 per second on WaveSpeed ($0.10 per second on fal, without a direction field). 1080p.",
      "Natural on soft words; it barely opens the mouth on full words. It adds a friendly smile and smoothing, and the background drifts towards grey-green. One face per run.",
      "Identity should be checked on every take: one take of Mila read as a different woman (jaw +24 %).",
    ])}

    <h3 id="m4-5">4.5 InfiniteTalk and InfiniteTalk Multi (WaveSpeed) ${R} <span class="when">for face-offs</span></h3>
    ${list([
      "$0.06 per second at 720p. Multi is the only model tried with separate left and right audio (its “meanwhile” mode).",
      "A music-only track for the listening character keeps that character's lips closed.",
      "It kept Ayaz's beard and age in 6 of 6 frames where H3 failed. It was used for all 6 face-off slots, upscaled with the ByteDance upscaler.",
      "Single InfiniteTalk on a front-facing rap face snarls (teeth visible in 227 of 646 frames). Rap delivered straight to camera should never be run on it.",
      "Prompts should name only visible actions. “Natural” and “casually” have no effect, and words about breath produce vapour.",
    ])}

    <h3 id="m4-6">4.6 Sync lipsync-3 ${M}</h3>
    ${list([
      "$0.135 per second ($8 per minute). A video-to-video mouth pass on one speaker.",
      "It reduced frames with visible teeth from 60 to 15 over a three-quarter InfiniteTalk take. It made a front-facing snarl worse (227 to 249). It should be used only over neutral three-quarter takes.",
    ])}

    <h3 id="m4-7">4.7 Kling 3.0 ${R} <span class="when">for silent clips</span></h3>
    ${list([
      "Pro: 105 credits for 3 s, 175 for 5 s, 350 for 10 s. Standard: 125 credits for 5 s. It was billed above the quote once (276 against 250).",
      "In the film: the chrome dissolve, the back-to-back shots, the raven-cloth loop, Mila's reaction clips and the ending shot.",
      "It does not hear audio. Anything that must play or sing in time fails.",
      "It overdoes whatever is named (haze rolls in), and long lists of actions are exaggerated. The wording that held the camera: “Locked-off camera on a tripod, the camera does not move.”",
      "Orbits made from a first and a last frame pick a side at random. Morphs ignore timing; a local strobe of aligned stills worked better.",
      "Two people timed within one shared window move one after the other. The prompt should say that both start and finish on the same frame.",
      "The camera is as smooth as a gimbal. Handheld shake should be added locally for the feel of a phone.",
    ])}

    <h3 id="m4-8">4.8 PixVerse V6 ${R} <span class="when">for one silent shot</span></h3>
    ${list(["1080p, 5 s, 150 credits. Used for the head-raise shot on the line “Can she?”, which was kept as generated."])}

    <h3 id="m4-9">4.9 LTX 2.3, audio-to-video ${N}</h3>
    ${list(["It was the only model that made light events inside the scene from a prompt, but only about 6 of 14 runs were usable. The failures were frozen mouths, a cut to strangers, and a floating light bulb."])}
    ${TOP}
  </div>
</section>

<section id="upscalers">
  <div class="wrap">
    <h2>5. Upscalers</h2>
    ${UPSCALERS}
    ${TOP}
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
    ${TOP}
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
    ${TOP}
  </div>
</section>

<section id="methods">
  <div class="wrap">
    <h2>8. Methods that worked</h2>
    <p>The working methods found during the project now have a page of their own, with pictures: cropping and pasting back, green paint, one run for several faces, what the likeness score does not see, and more.</p>
    <p><a class="more" href="/music/methods">Read the eight methods</a> <span aria-hidden="true">→</span></p>
    ${TOP}
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
    ${TOP}
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
    ])}
    <p class="small soft">Product and company names belong to their owners and are used here only to identify the tools. See how the film was made on the <a href="/music">music page</a>.</p>
    ${TOP}
  </div>
</section>
  </div>
</div>`;

export const CSS = `
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
.tabs{display:inline-flex;gap:4px;margin:20px 0 0;padding:4px;background:var(--band);border:1px solid var(--line);border-radius:999px}
.tabs a{padding:8px 16px;border-radius:999px;font-size:15px;font-weight:600;text-decoration:none;color:var(--ink-soft)}
.tabs a:hover{color:var(--ink)}
.tabs a[aria-current]{background:#fff;color:var(--machine-deep);box-shadow:0 1px 2px rgba(22,27,34,.12)}
.toc ul{list-style:none;margin:4px 0 6px;padding:0 0 0 2px;font-size:14px}
main.models .toc ul li{padding:2px 0}
.toc-m{position:sticky;top:var(--bar);z-index:5;background:var(--paper);border-bottom:1px solid var(--line)}
.toc-m summary{cursor:pointer;padding:12px 20px;font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.toc-m nav{max-height:60vh;overflow:auto;padding:0 20px 14px}
.toc-m ol{margin:0;padding-left:22px}
.toc-m ul{list-style:none;margin:2px 0 6px;padding:0;font-size:15px}
main.models .toc-m li{margin:0;padding:5px 0}
.toc-m a{text-decoration:none}
.toc-side{display:none}
@media (max-width:959px){html{scroll-padding-top:calc(var(--bar) + 60px)}}
@media (min-width:960px){.toc-m{display:none}.toc-side{display:block}}
main.models section .wrap>p.top{margin:22px 0 0;font-size:14px}
.top a{color:var(--ink-soft)}
.more{font-weight:600}
.when{font-size:13px;font-weight:400;color:var(--ink-soft);white-space:nowrap}
.scroll{overflow-x:auto;margin:0 0 8px;border:1px solid var(--line);border-radius:var(--r);background:#fff}
.scroll table{border-collapse:collapse;width:100%;min-width:680px;font-size:14px;line-height:1.45}
.scroll th,.scroll td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--line)}
.scroll thead th{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);background:var(--paper)}
.scroll tbody th{font-weight:600;width:26%}
.scroll tbody tr:last-child th,.scroll tbody tr:last-child td{border-bottom:0}
`;

// Closes the phone's "On this page" row once a link in it is followed.
const TOC_SCRIPT = `<script>
document.querySelector(".toc-m")?.addEventListener("click", (e) => { if (e.target.closest("a")) e.currentTarget.open = false; });
</script>`;

// One page of the review. shell: { head, nav, footer } cut from page.html, as for /places.
export function reviewPage(shell, csp, meta, body, css = "") {
  const html = `${shell.head.replace(/<title>.*<\/title>/, `<title>${meta.title}</title>`).replace("__HEAD_TAGS__", headTags(meta))}${CSS}${css}</style>
</head>
<body>
${shell.nav}
<main id="top" class="models">${body}
</main>
${shell.footer}
${TOC_SCRIPT}
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

export const handleModels = (shell, csp) => reviewPage(shell, csp, MODELS, BODY);
