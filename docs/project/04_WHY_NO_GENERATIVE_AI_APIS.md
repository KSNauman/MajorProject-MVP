# 4. Why EduVision Uses No Generative-AI APIs or API Keys

EduVision runs every AI step on the school's own computer: the YOLOv8-Pose model (`best.pt`), the U²-Net background remover (rembg) and Meta's AnimatedDrawings engine. It calls no paid or hosted generative service (OpenAI, Gemini, Veo, Sora, ElevenLabs, Runway and so on), and the code contains no API key.

This was a deliberate decision. This document gives the evidence for it, not just the opinion: the providers' own terms, their published prices, and a mathematical property of our animation method that a generative model cannot offer.

> **Where the figures come from.** Prices and terms were read from the providers' own pages on **27 November 2026**:
> - Google pricing: <https://aistudio.google.com/docs/pricing> (the old address `ai.google.dev/gemini-api/docs/pricing` redirects there)
> - Google Gemini API Additional Terms, "Effective March 23, 2026": <https://aistudio.google.com/docs/terms>
> - OpenAI Terms of Use (Rest of World), "Effective January 1, 2026": <https://openai.com/policies/row-terms-of-use/>
>
> Prices change often; re-check them before quoting this document externally. OpenAI's API price page returned a business-plan page instead of API prices on that date, so no OpenAI price is quoted below.

---

## 4.1 The Short Answer

| Reason | Type | Strength |
|---|---|---|
| Google's API terms **forbid** using the API in a service likely to be used by people under 18 | Legal / contractual | **Decisive** |
| Children's drawings and names are personal data; sending them to a third party needs parental consent and creates training/human-review exposure on free tiers | Privacy / law | **Decisive** |
| A generative model **redraws** the child's picture; our method **moves the child's own pixels** (proved in §4.5) | Pedagogical / technical | **Decisive** for this project's purpose |
| Video generation costs about **₹2.4 lakh per class per year** (§4.4) | Cost | Strong |
| Needs reliable internet, an account, a card and a secret key in every school | Deployment | Strong |
| Output changes on every call and cannot be reproduced or tested | Engineering | Strong |
| Text and speech generation are cheap | Cost | **Weak** argument against those two |

We state the last row on purpose: cost alone does **not** rule out every API. Text and text-to-speech APIs are cheap (§4.4.3). The decisive reasons are the age terms, children's privacy, and authorship of the drawing.

---

## 4.2 Reason 1: The Provider Terms Do Not Allow It

### Google Gemini API (covers Gemini text, image, speech and video models)

The Additional Terms say, word for word:

> "You must be 18 years of age or older to use the APIs."

and that the developer "will not use the Services as part of a website, application, or other service" that is "directed towards or is likely to be accessed by individuals under the age of 18."

EduVision is built for children aged about 3 to 8. Every student screen would be such a service. **Using the Gemini API inside EduVision would breach Google's terms**, regardless of price.

The same terms also say the API "is for developers building with Google AI models for professional or business purposes" and "not for consumer use."

### OpenAI

OpenAI's Terms of Use say: "You must be at least 13 years old or the minimum age required in your country to consent to use the Services", and "If you are under 18 you must have your parent or legal guardian's permission to use the Services."

A kindergarten child is under 13, so the child cannot be the user at all. Any design would need a separate legal review and parental permission for every child.

**Conclusion:** the two largest providers either forbid the use case (Google) or exclude the age group (OpenAI). A school product cannot be built on a service whose terms it breaks.

---

## 4.3 Reason 2: Children's Data Must Not Leave the School

A drawing in EduVision is linked to a named child, their class and their parent. That makes it **personal data of a child**.

### What the providers do with it

From Google's Additional Terms, for the **free (unpaid)** tier:

> "Google uses the content you submit to the Services and any generated responses to provide, improve, and develop" Google products and services and machine learning technologies.

> "human reviewers may read, annotate, and process your API input and output."

> "Do not submit sensitive, confidential, or personal information to the Unpaid Services."

On the paid tier, Google states that prompts and responses are not used to improve its products, but they are still logged for a limited period to detect policy violations. OpenAI's terms say "We may use Content to provide, maintain, develop, and improve our Services", with an opt-out.

So a free tier is ruled out outright for children's drawings. A paid tier still sends the child's picture to another country and stores it there for a period.

### What Indian law requires

India's **Digital Personal Data Protection Act, 2023** defines a "child" as a person who has not completed 18 years (Section 2). Section 9 requires **verifiable consent of the parent** before processing a child's personal data. It also forbids **tracking, behavioural monitoring and targeted advertising** directed at children.

> We could not download the official text from the MeitY or India Code servers on 27 November 2026 (both returned HTTP 403), so these points are quoted from our knowledge of the Act. **Check them against the official gazette text before relying on them.**

Sending drawings to a foreign AI provider adds a **processor in another country** to every consent form. Keeping all processing on the school's computer means:
- the drawing never leaves the building (the web pages still fetch fonts, two libraries and avatar pictures from outside sites; see [08 §8.1](08_SECURITY_PRIVACY_AND_LICENSING.md), which also lists the fix);
- there is no third-party training or human review;
- deleting a child's account really deletes the data (`DELETE /api/admin/students/:id` removes results, stories and links in one transaction).

---

## 4.4 Reason 3: Cost (With the Numbers)

### 4.4.1 What would need replacing

Without our local pipeline, the only hosted way to turn a still drawing into motion is a **video-generation model**. The cheapest one Google listed on 27 November 2026:

| Model | Listed output price | Per second of 720p video (Google's own footnote) |
|---|---|---|
| Gemini Omni 1.2 Flash | "$12.00 (video)" per 1M tokens | **≈ $0.07 per second** |
| Gemini Omni 1.1 Flash | "$17.50 (video)" per 1M tokens | ≈ $0.10 per second |

No Veo price appeared on the page that day, so the cheaper Omni figure is used. This makes the estimate **favourable to the API**.

### 4.4.2 One classroom for one year

Assumptions (stated so they can be changed):
- 30 children in a class, 40 school weeks a year.
- Each child makes **1 story per week**. Our story video is 23.75 s long (set by the narration, see `compose_story.py`).
- Each child does **5 animation activities per week** (Color & Animate, Jigsaw), each a short clip of about **3 s**.
- Exchange rate **₹88 per US$** (assumed; adjust to the day's rate).

Seconds of generated video per child per week:

$$s = 23.75 + 5 \times 3 = 38.75 \text{ s}$$

Cost per class per year at $0.07 per second:

$$C = 30 \times 40 \times 38.75 \times 0.07 = \$3{,}255 \approx ₹2{,}86{,}000$$

That is about **₹2.9 lakh per class per year**. At the Omni 1.1 price it is about ₹4.1 lakh. A small school with 6 classes would pay roughly **₹17 to 25 lakh a year**, every year, for one feature.

A **failed or unwanted** result is also charged, and children often want to "try again". If half of the clips are regenerated, the cost rises by 50%.

**EduVision's cost for the same work:** ₹0 per use. It runs on one existing laptop with an RTX 2050 GPU and takes about 50 s for six characters (textbook chapter 14). The only costs are electricity and the one-time hardware the school already owns.

### 4.4.3 Where cost is **not** the reason

Being honest about the cheap cases:

- **Speech narration.** Gemini 3.8 Flash-Lite TTS listed "$6.00 (audio)" per 1M tokens, with "25 tokens per second of audio". Our 23.75 s narration is about 594 audio tokens, which costs **$0.0036, under half a rupee**. Even for every child every week it is about **₹38 per class per year**.
- **Story text.** A Flash-Lite text model costs cents per thousand stories.

So for narration and story text, the reasons not to use an API are the **age terms (§4.2) and privacy (§4.3)**, not cost. The current system uses a pre-recorded narration file (`assets/Rahim's Story/rahim_story_audio.mp3`), and the browser's built-in speech (`speechSynthesis`) for counting words in Count & Play. Neither needs an API key. (Some browsers use online voices for `speechSynthesis`; choosing a local voice keeps it on the device.)

---

## 4.5 Reason 4: A Generative Model Cannot Keep the Child's Drawing

This is the pedagogical core of EduVision: **the child must recognise their own drawing moving.**

A generative video or image model produces a new picture that *looks like* the input. It re-synthesises every pixel, so lines, colours, proportions and "mistakes" can change, and they change differently on every run.

Our pipeline only **moves** the drawing. Here is a short proof.

**Setting.** The character's mask is covered with a triangle mesh (Delaunay triangulation, `animated_drawing.py`). Each vertex $v_i$ has a texture coordinate $u_i$ into the child's original image $I$. Each animation frame moves only the vertex positions, $v_i \to v_i'$, using ARAP; the texture coordinates $u_i$ never change.

**Claim.** Every coloured pixel in every output frame is a sample of the child's original image, reached by a piecewise-affine map, and no new content is created.

**Proof.** Take an output pixel $p$ inside a deformed triangle $(v_a', v_b', v_c')$. The GPU writes it with barycentric coordinates $(\lambda_a, \lambda_b, \lambda_c)$, where $\lambda_a + \lambda_b + \lambda_c = 1$, $\lambda \ge 0$ and $p = \lambda_a v_a' + \lambda_b v_b' + \lambda_c v_c'$. The texture coordinate it reads is $u = \lambda_a u_a + \lambda_b u_b + \lambda_c u_c$. This point lies inside the *original* triangle $(u_a, u_b, u_c)$, because the weights are non-negative and sum to 1. The colour written is $I(u)$, up to bilinear filtering of neighbouring texels of the same image. Within one triangle, $p \mapsto u$ is affine. So every output colour comes from the child's image. ∎

**Consequence.** The output is a deterministic function of the child's drawing, the skeleton and the motion file:
- the same input gives the same animation every time (testable, and it was compared exactly in chapter 14 §6.4);
- no stroke is invented or removed;
- a teacher can trust that what moves is what the child drew.

A generative model gives none of these guarantees.

---

## 4.6 Reasons 5 and 6: Deployment and Engineering

| Concern | Hosted generative API | EduVision (local) |
|---|---|---|
| Internet | Required for every request | Not required for any AI step. The pages currently load fonts, Fabric.js and avatars from the web; bundling them locally removes that ([08 §8.1](08_SECURITY_PRIVACY_AND_LICENSING.md)) |
| Account, billing card, API key | Needed per school; a key in client code can be stolen and run up a bill | None |
| Latency | Video models typically take tens of seconds to minutes per clip, plus upload | ~0.014 s detection on GPU (`benchmarks.json`), ~50 s for six characters end to end |
| Reproducibility | Different output each call | Bit-identical mesh, deterministic render |
| Testing | Cannot write an exact test | 53 automated API tests run against fixed behaviour |
| Service changes | Models are renamed, re-priced or withdrawn: the pricing page already lists models that "route to" newer ones from December 2026 | We control the version (`best.pt` is committed to git) |

---

## 4.7 What This Decision Costs Us (Limitations)

Choosing local models has real downsides, and we list them:
- **Only humanoid figures.** A generative model can animate a cat, a car or a tree; ours needs a human-like skeleton.
- **Fixed motion library.** Children can only pick motions we have BVH files for.
- **Hardware.** A school needs a reasonably modern computer; a GPU helps a lot (13.7 ms vs 67.3 ms per detection, `benchmarks.json`).
- **Quality ceiling.** ARAP can tear when limbs overlap (textbook chapter 12, test UT_1.11).

These limits are acceptable for the project's goal: **animate the child's own drawing, privately, for free**.

---

## 4.8 If an API Is Ever Added

If a future version adds, for example, AI-written stories, the safe pattern would be:
1. a **teacher-only** feature, so no child uses it;
2. text only, never children's drawings or names;
3. a paid tier with no training on inputs;
4. a written parental-consent update;
5. a server-side key, never sent to the browser.

This is recorded as future work in [06_ADVANTAGES_LIMITATIONS_FUTURE.md](06_ADVANTAGES_LIMITATIONS_FUTURE.md).
