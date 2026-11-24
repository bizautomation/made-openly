// GET /music/methods: the working methods found while making the "Sing Like a
// Human" music video. The second page of the model review; /music/models is
// the first. The pictures come from the music Worker under /art/tricks/.
import { METHODS } from "./share.js";
import { DISCLAIMER, TOP, fig, list, reviewPage, tabs, toc } from "./models.js";

const TOC = toc([
  ["#crop", "Crop, change, paste back"],
  ["#green", "Green paint for a stronger change"],
  ["#strip", "One run for several faces, mapped from left to right"],
  ["#measure", "One measure for each question"],
  ["#score", "What the likeness score does not see"],
  ["#teeth", "Teeth correction, calibrated for each clip"],
  ["#loose", "A continuous shot from loose endings"],
  ["#wording", "Word order is action order"],
]);

const BODY = `
<section class="models-head">
  <div class="wrap">
    <p class="crumb"><a href="/music">Music</a> <span aria-hidden="true">/</span> <a href="/music/models">Model review</a> <span aria-hidden="true">/</span> Methods</p>
    <h1>Methods that worked</h1>
    <p class="soft">Eight working methods found while making the music video <a href="/music">Sing Like a Human</a>. They are methods, not models. Each one was used in the film. Where a point rests on observation only, the text says so.</p>
    ${tabs("/music/methods")}
    ${DISCLAIMER}
    <p class="small soft">Likeness scores are ArcFace scores against the character's face masters; a pass is 0.55 or higher. Prices are in OpenArt credits, or in US dollars as listed or billed by fal. Last checked on 24 November 2026.</p>
  </div>
</section>

${TOC.row}
<div class="wrap models-grid">
  ${TOC.side}
  <div class="models-body">
<section id="crop">
  <div class="wrap">
    <h2>1. Crop, change, paste back</h2>
    <p>When a face is small in the frame, the model is given too few pixels to work on, and an edit of the whole picture changes things that should stay. The area around the head is cut out, the model works on that crop alone, and the result is pasted back with a soft edge.</p>
    ${list([
      "The rest of the picture stays identical, pixel for pixel.",
      "The face is larger in the crop, so the model has more to work with. A crop of about three times the width of the face, enlarged to 1024 pixels, worked well.",
      "The result is aligned to the original before it is pasted, because the model may shift the head by a few pixels.",
      "On the market singer, the likeness score of one still rose from 0.17 to 0.66 in a single pass on Seedream 5.5.",
    ])}
    ${fig("trick-crop", 420, "Three pictures in a row. A wide night-market scene with a white square drawn around the singer's head; the cut-out square before the change; the same square after the change, with a different face.", "Left: the still, with the area that was cut out. Centre: the crop as it was. Right: the crop after the change, before it was pasted back.")}
    ${TOP}
  </div>
</section>

<section id="green">
  <div class="wrap">
    <h2>2. Green paint for a stronger change</h2>
    <p>A plain request to replace a face often changes almost nothing: the model protects a face it can see. Painting the face, or the whole head, in flat green removes what the model would protect, and it then draws the head from the reference.</p>
    ${list([
      "On Ayaz's profile, a plain face correction on Seedream 5 Pro changed almost nothing. With the whole head painted green, the same model drew a new face.",
      "<b>The result is only as close as its reference.</b> That first head came out too young, because the side reference was too young. It was replaced two days later with a head drawn from a better reference.",
      "On Mila's most difficult still, the green method reached 0.443 against 0.375 for a plain edit and 0.259 for the original.",
      "In the album, faces turned more than about 25 degrees were corrected this way on GPT Image 2.5 Flare.",
      "<b>The taxi driver was recast this way</b> (shown below), on Nano Banana Pro. His head and the phone on the dashboard were painted green. The prompt named each green area in turn: the first to be filled with the glass behind it, the second with the new driver at “the same head size, position and angle as the original driver”.",
      "<b>The green shape sets the size of the head.</b> When the green was painted loosely, the model filled the whole patch and the head came out too large. Keeping the green close to the real outline of the head helped.",
      "The prompt should also say so. The wording that held was: “paint his head so that it fits entirely inside this green shape … the head must not be bigger than the green area”. A prompt that asks the model to fill the area invites a larger head.",
      "Where background had to be repainted as well, a second colour was used: green for the heads, and magenta for areas that are “background only, never part of a head, hair or body”.",
      "Paint only the person, never the background, when the background must stay.",
    ])}
    ${fig("trick-paint", 397, "Three pictures in a row of a man driving a turquoise taxi at night in the rain. The original, with an older driver and a phone mounted by the windscreen; the same picture with a green square over the phone and a loose green shape over the head; the result, with a different man at the same size and the phone gone.", "Left: the frame before. Centre: the picture sent to the model, with the phone and the head painted green. Right: the result, which became the start frame of the shot in the film after a light colour correction.")}
    ${TOP}
  </div>
</section>

<section id="strip">
  <div class="wrap">
    <h2>3. One run for several faces, mapped from left to right</h2>
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

    <p><b>The same idea on stills (24 November).</b> Replacing a face in several pictures normally costs one paid run for each picture. Three pictures were corrected in one run of Seedream 5.5.</p>
    <ol>
      <li>Free and local: the head in each picture was cut out as a 3:4 box, 3.2 times the width of the face, and the three boxes were laid side by side with grey gaps on one 21:9 strip. The position of each box was saved.</li>
      <li>One paid run: Seedream 5.5, image-to-image, 2K, 21:9, with the strip and the face masters. The prompt asked for the face to be replaced in each panel, for the size, angle, gaze, hair, light and framing of each head to be kept, for the grey gaps to be kept, and for the panels not to be merged.</li>
      <li>Free and local: each panel was cut back out, aligned to its original crop, and pasted back as a soft oval over the face only.</li>
    </ol>
    ${list([
      "One run was billed at 47 credits and corrected three faces. Three separate runs of the same kind were billed at 126 credits on 22 November. The model kept all three panels and the gaps.",
      "The likeness score against the three-quarter master rose in all three: 0.165 to 0.350, 0.596 to 0.624 and 0.558 to 0.598. No seam was visible.",
      "A face that is small in its source (about 100 pixels) comes back soft and still fails. Faces in the strip should be large, over about 200 pixels.",
      "One set of masters must suit the angle of every panel. The model could merge the panels; it did not here.",
    ])}
    ${TOP}
  </div>
</section>

<section id="measure">
  <div class="wrap">
    <h2>4. One measure for each question</h2>
    ${list([
      "<b>Identity.</b> The ArcFace score against the masters; a pass is 0.55 or higher. Pictures of the same character scored 0.78–0.88 against each other.",
      "<b>Proportions and position.</b> Apple Vision landmarks. Jaw and chin ratios could not tell two different faces apart, so they were never used for identity.",
      "<b>Head size after an edit.</b> The face box before and after. A change of more than 5 % was flagged, because edit models often draw the head larger.",
      "<b>Comparison by eye.</b> Only on a sheet where every face is drawn at the same scale.",
      "The ArcFace score is weak on profiles and on faces under about 120 pixels. Those were judged by eye.",
    ])}
    ${TOP}
  </div>
</section>

<section id="score">
  <div class="wrap">
    <h2>5. What the likeness score does not see</h2>
    <p>The pass mark is an ArcFace score of 0.55 against the character's masters. The score compares the layout of the eyes, nose and mouth. It does not see hair colour or texture, skin tone, freckles or make-up, and it is weak on faces near profile.</p>
    ${list([
      "One picture passed at 0.598 against Mila's three-quarter master, and to the eye it still did not look like her. The likely reasons, on inspection: near-black, sleek hair where hers is mid-brown and wavy; a face lit from behind, so that her eyes and freckles barely showed; a head turned near profile; and smoother, younger skin. The face had been corrected, but only inside its oval; everything around it came from the base picture.",
      "On 24 November the same prompt and references were run on GPT Image 2.5 Flare and on Seedream 5 Pro. The scores were nearly equal (0.535 and 0.543 on average). By eye the Flare picture was closer to Mila: freckles, brow and nose. In the Seedream picture the face was turned near profile and lit from behind.",
      "Flare also kept the real place in the background, where Seedream drew a generic one. Seedream gave neater hair and more realistic skin. The runs were billed at 36 and 64 credits.",
      "Mila's own front master scores only 0.63 against her stills from the film, and the warmest picture of her in the project scored 0.536. A pass means “not a stranger”. It does not mean “reads as her”.",
      "What followed in practice: light the face from the front or the side; a three-quarter view at most; name the colour and texture of the hair in the prompt; use the cheaper model for first passes; and let a person's eye make the final decision.",
    ])}
    ${TOP}
  </div>
</section>

<section id="teeth">
  <div class="wrap">
    <h2>6. Teeth correction, calibrated for each clip</h2>
    <p>Lip-sync models often draw teeth that glow. The correction is local and free, and it changes only a box around the lips.</p>
    ${list([
      "Each clip is measured in its own light. Fixed settings were wrong from one light to the next.",
      "Glare is brought halfway down towards the lit skin, and colour is moved halfway towards the white of the eye. A full correction met its targets but looked beige and grey.",
      "It cannot correct the shape of teeth, or flicker between frames. Those are hidden in the edit.",
    ])}
    ${fig("trick-teeth", 447, "Two close pictures of the same open mouth. On the left the teeth glow bright white. On the right they are slightly darker and warmer.", "The same frame before and after. Only the area inside the lips was changed.")}
    ${TOP}
  </div>
</section>

<section id="loose">
  <div class="wrap">
    <h2>7. A continuous shot from loose endings</h2>
    <ol>
      <li>The video model is run from a start frame only, with a prompt that describes the whole move. It finds a natural camera move and a natural ending by itself.</li>
      <li>The last frame of that run has a good composition, and usually a face that has drifted. The face is corrected on that frame as a still.</li>
      <li>The corrected frame becomes the end frame of a new run, and then the start frame of the next clip.</li>
    </ol>
    ${list([
      "Every join is a still that can be controlled, so the face is exact where it is largest.",
      "With only a start frame, Kling 3.0 replaced a face within 0.5–1 s. Fixing the end frame as well roughly doubled how well the face held; it did not lock it.",
    ])}
    ${TOP}
  </div>
</section>

<section id="wording">
  <div class="wrap">
    <h2>8. Word order is action order</h2>
    ${list([
      "Two clauses are performed as two beats. Actions that happen together should be written as one action with both people: “they take each other's hand at the same moment”.",
      "When a model fails an action, the prompt should be corrected first. Extra stills and masks come second.",
      "Describe the actual motion (bounces, sways, stamps in puddles). “Dances slowly” freezes the pose.",
      "Do not name parts of the face in a video prompt. The model acts on what is named.",
      "The start and end frames should carry the same expression, or the model moves the brows to travel from one to the other.",
    ])}
    ${TOP}
  </div>
</section>
  </div>
</div>`;

export const handleMethods = (shell, csp) => reviewPage(shell, csp, METHODS, BODY);
